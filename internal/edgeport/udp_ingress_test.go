/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr.
 *
 * Licensed under the MIT License (the "License");
 * you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *    https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package edgeport

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/sipconv"
)

func discardLog() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func containsAll(s string, parts ...string) bool {
	for _, p := range parts {
		if !strings.Contains(s, p) {
			return false
		}
	}
	return true
}

type nullPacketConn struct{}

func (nullPacketConn) ReadFrom([]byte) (int, net.Addr, error) { return 0, nil, net.ErrClosed }
func (nullPacketConn) WriteTo(b []byte, _ net.Addr) (int, error) {
	return len(b), nil
}
func (nullPacketConn) Close() error { return nil }
func (nullPacketConn) LocalAddr() net.Addr {
	return &net.UDPAddr{IP: net.IPv4(10, 0, 0, 1), Port: 5060}
}
func (nullPacketConn) SetDeadline(time.Time) error      { return nil }
func (nullPacketConn) SetReadDeadline(time.Time) error  { return nil }
func (nullPacketConn) SetWriteDeadline(time.Time) error { return nil }

type packetRecorder struct {
	nullPacketConn
	mu   sync.Mutex
	sent [][]byte
}

func (r *packetRecorder) WriteTo(b []byte, _ net.Addr) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sent = append(r.sent, append([]byte(nil), b...))
	return len(b), nil
}
func (r *packetRecorder) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.sent)
}
func (r *packetRecorder) last() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return string(r.sent[len(r.sent)-1])
}

func TestCallIDOfDatagram(t *testing.T) {
	cases := []struct{ name, text, want string }{
		{"plain", "OPTIONS sip:a SIP/2.0\r\nVia: x\r\nCall-ID: abc@host\r\n\r\n", "abc@host"},
		{"any case", "OPTIONS sip:a SIP/2.0\r\ncall-id:abc\r\n\r\n", "abc"},
		{"compact", "OPTIONS sip:a SIP/2.0\r\ni:  abc \r\n\r\n", "abc"},
		{"space before the colon", "OPTIONS sip:a SIP/2.0\r\nCall-ID : abc\r\n\r\n", "abc"},
		{"only in the body", "OPTIONS sip:a SIP/2.0\r\nVia: x\r\n\r\nCall-ID: body\r\n", ""},
		{"none", "OPTIONS sip:a SIP/2.0\r\nVia: x\r\n\r\n", ""},
		{"bare newlines", "OPTIONS sip:a SIP/2.0\nCall-ID: abc\n\n", "abc"},
		{"empty", "", ""},
		{"cut short", "OPTIONS sip:a SIP/2.0\r\nCall-I", ""},
		{"a colon in the start line", "INVITE sip:i:1@a SIP/2.0\r\nCall-ID: abc\r\n\r\n", "abc"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := string(callIDOfDatagram([]byte(c.text))); got != c.want {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}

// The same Call-ID whatever form it arrives in must reach the same worker.
func TestSameCallSameWorker(t *testing.T) {
	long := []byte("X\r\nCall-ID: same\r\n\r\n")
	short := []byte("Y\r\ni: same\r\n\r\n")
	if !bytes.Equal(callIDOfDatagram(long), callIDOfDatagram(short)) {
		t.Fatal("the forms differ")
	}
}

func sampleDatagram(callID string, seq int) []byte {
	return []byte(fmt.Sprintf("OPTIONS sip:a@10.0.0.1 SIP/2.0\r\nVia: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-%s-%d\r\n"+
		"From: <sip:a@b>;tag=f\r\nTo: <sip:c@d>\r\nCall-ID: %s\r\nCSeq: %d OPTIONS\r\nContent-Length: 0\r\n\r\n", callID, seq, callID, seq+1))
}

func TestIngressKeepsEachCallInOrder(t *testing.T) {
	var mu sync.Mutex
	got := map[string][]uint32{}
	var wg sync.WaitGroup
	const calls, each = 20, 200
	wg.Add(calls * each)
	in := newUDPIngress(discardLog(), sipconv.NewParser(), 4, each*calls,
		func(msg sip.Message) {
			mu.Lock()
			got[msg.CallID().Value()] = append(got[msg.CallID().Value()], msg.CSeq().SeqNo)
			mu.Unlock()
			wg.Done()
		},
		func() { t.Error("nothing should drop") }, func(error) {})
	source := netip.MustParseAddrPort("10.0.0.2:5070")
	for seq := range each {
		for c := range calls {
			in.enqueue(sampleDatagram("call-"+strconv.Itoa(c), seq), source)
		}
	}
	wg.Wait()
	in.wait()
	for id, seqs := range got {
		for i, seq := range seqs {
			if seq != uint32(i+1) {
				t.Fatalf("%s out of order at %d: %v", id, i, seqs[:i+1])
			}
		}
	}
}

func TestIngressFullQueueDropsAndCounts(t *testing.T) {
	block := make(chan struct{})
	started := make(chan struct{}, 1)
	var dropped sync.WaitGroup
	const over = 5
	dropped.Add(over)
	in := newUDPIngress(discardLog(), sipconv.NewParser(), 1, 2,
		func(sip.Message) {
			select {
			case started <- struct{}{}:
			default:
			}
			<-block
		},
		dropped.Done, func(error) {})
	source := netip.MustParseAddrPort("10.0.0.2:5070")
	in.enqueue(sampleDatagram("c", 0), source)
	<-started // The worker holds one; the queue holds two more
	for i := 1; i <= 2+over; i++ {
		in.enqueue(sampleDatagram("c", i), source)
	}
	dropped.Wait()
	close(block)
	in.wait()
}

func TestIngressSkipsKeepAlivesAndGarbage(t *testing.T) {
	var parsed int
	var mu sync.Mutex
	in := newUDPIngress(discardLog(), sipconv.NewParser(), 1, 8,
		func(sip.Message) { mu.Lock(); parsed++; mu.Unlock() },
		func() {}, func(error) {})
	source := netip.MustParseAddrPort("10.0.0.2:5070")
	in.enqueue([]byte("\r\n\r\n"), source)
	in.enqueue([]byte{0, 0, 0}, source)
	in.enqueue([]byte("this is not SIP\r\n\r\n"), source)
	done := make(chan struct{})
	go func() {
		for len(in.queues[0]) > 0 {
			time.Sleep(time.Millisecond)
		}
		close(done)
	}()
	<-done
	in.wait()
	mu.Lock()
	defer mu.Unlock()
	if parsed != 0 {
		t.Fatalf("%d messages came out", parsed)
	}
}

func TestIngressTakesADatagramOverThePoolSize(t *testing.T) {
	var got int
	done := make(chan struct{})
	in := newUDPIngress(discardLog(), sipconv.NewParser(), 1, 8,
		func(msg sip.Message) { got = len(msg.Body()); close(done) },
		func() {}, func(error) {})
	body := strings.Repeat("x", 2*udpSmallPacket)
	text := "MESSAGE sip:a@10.0.0.1 SIP/2.0\r\nVia: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-big\r\n" +
		"From: <sip:a@b>;tag=f\r\nTo: <sip:c@d>\r\nCall-ID: big\r\nCSeq: 1 MESSAGE\r\n" +
		"Content-Length: " + strconv.Itoa(len(body)) + "\r\n\r\n" + body
	in.enqueue([]byte(text), netip.MustParseAddrPort("10.0.0.2:5070"))
	<-done
	in.wait()
	if got != len(body) {
		t.Fatalf("body %d", got)
	}
}

func TestListenUDPSocketsShareOnePort(t *testing.T) {
	socks, err := listenUDPSockets("127.0.0.1:0", 4)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		for _, s := range socks {
			_ = s.Close()
		}
	}()
	if len(socks) == 0 {
		t.Fatal("no socket")
	}
	want := socks[0].LocalAddr().String()
	for _, s := range socks {
		if s.LocalAddr().String() != want {
			t.Errorf("%s, want %s", s.LocalAddr(), want)
		}
	}
}

// BenchmarkIngressHandOff is the allocations of a datagram from the read loop to
// its worker, parse included.
func BenchmarkIngressHandOff(b *testing.B) {
	data := sampleDatagram("bench", 1)
	var wg sync.WaitGroup
	in := newUDPIngress(discardLog(), sipconv.NewParser(), 1, 1024, func(sip.Message) { wg.Done() }, func() { wg.Done() }, func(error) {})
	source := netip.MustParseAddrPort("10.0.0.2:5070")
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		wg.Add(1)
		in.enqueue(data, source)
		wg.Wait()
	}
	b.StopTimer()
	in.wait()
}
