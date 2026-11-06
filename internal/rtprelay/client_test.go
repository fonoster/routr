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

package rtprelay

import (
	"context"
	"log/slog"
	"net"
	"net/netip"
	"strings"
	"testing"
	"time"
)

// startEngine runs a fake RTPEngine on loopback: answer gets each datagram and
// returns the datagram to send back, nil for none. It stops with the test.
func startEngine(t *testing.T, answer func(string) []byte) int {
	t.Helper()
	conn, err := net.ListenUDP("udp4", net.UDPAddrFromAddrPort(netip.MustParseAddrPort("127.0.0.1:0")))
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	t.Cleanup(func() {
		_ = conn.Close()
		<-done
	})
	go func() {
		defer close(done)
		buf := make([]byte, maxDatagram)
		for {
			n, from, err := conn.ReadFromUDPAddrPort(buf)
			if err != nil {
				return
			}
			if out := answer(string(buf[:n])); out != nil {
				_, _ = conn.WriteToUDPAddrPort(out, from)
			}
		}
	}()
	return conn.LocalAddr().(*net.UDPAddr).Port
}

func newClient(t *testing.T, port int, timeout time.Duration) *Client {
	t.Helper()
	client, err := NewClient("127.0.0.1", port, timeout, slog.Default())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })
	return client
}

func cookieOf(datagram string) string {
	cookie, _, _ := strings.Cut(datagram, " ")
	return cookie
}

func TestNewClientValidates(t *testing.T) {
	if _, err := NewClient("", 22222, 0, nil); err == nil {
		t.Error("no host must fail")
	}
	if _, err := NewClient("rtpengine", 0, 0, nil); err == nil {
		t.Error("no port must fail")
	}
}

func TestOfferOnTheWire(t *testing.T) {
	received := make(chan string, 1)
	port := startEngine(t, func(datagram string) []byte {
		received <- datagram
		return []byte(cookieOf(datagram) + " d3:sdp3:v=06:result2:oke")
	})
	client := newClient(t, port, time.Second)

	res, err := client.Offer(context.Background(), Params{
		"call-id":  "c1",
		"from-tag": "t1",
		"sdp":      "v=0",
		"ICE":      "remove",
		"flags":    []string{"trust-address"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Result != "ok" || res.SDP != "v=0" {
		t.Errorf("result = %+v", res)
	}
	datagram := <-received
	cookie := cookieOf(datagram)
	if len(cookie) != 36 {
		t.Errorf("cookie = %q", cookie)
	}
	want := "d3:ICE6:remove7:call-id2:c17:command5:offer5:flagsl13:trust-addresse8:from-tag2:t13:sdp3:v=0e"
	if got := strings.TrimPrefix(datagram, cookie+" "); got != want {
		t.Errorf("payload = %s\nwant %s", got, want)
	}
}

func TestEachCommandSendsItsName(t *testing.T) {
	received := make(chan string, 1)
	port := startEngine(t, func(datagram string) []byte {
		received <- datagram
		return []byte(cookieOf(datagram) + " d6:result2:oke")
	})
	client := newClient(t, port, time.Second)
	for command, call := range map[string]func(context.Context, Params) (Result, error){
		"query":  client.Query,
		"answer": client.Answer,
		"delete": client.Delete,
	} {
		if _, err := call(context.Background(), Params{"call-id": "c1"}); err != nil {
			t.Fatal(err)
		}
		if got := <-received; !strings.Contains(got, "7:command"+string(rune('0'+len(command)))+":"+command) {
			t.Errorf("%s sent %s", command, got)
		}
	}
}

func TestAnErrorResultIsAResultNotAnError(t *testing.T) {
	port := startEngine(t, func(datagram string) []byte {
		return []byte(cookieOf(datagram) + " d12:error-reason15:Unknown call-id6:result5:errore")
	})
	res, err := newClient(t, port, time.Second).Query(context.Background(), Params{"call-id": "c1"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Result != resultError || res.ErrorReason != "Unknown call-id" {
		t.Errorf("result = %+v", res)
	}
}

func TestACommandTimesOutWithTheMessageOfRoutr2(t *testing.T) {
	port := startEngine(t, func(string) []byte { return nil })
	client := newClient(t, port, 20*time.Millisecond)
	_, err := client.Query(context.Background(), Params{"call-id": "c1"})
	if err == nil || !strings.HasPrefix(err.Error(), "rtpengine timeout host:127.0.0.1 port:") {
		t.Fatalf("err = %v", err)
	}
	client.mu.Lock()
	defer client.mu.Unlock()
	if len(client.pending) != 0 {
		t.Errorf("%d commands still pending", len(client.pending))
	}
}

func TestAnswersItCannotUseAreDropped(t *testing.T) {
	sent := 0
	port := startEngine(t, func(datagram string) []byte {
		sent++
		switch sent {
		case 1:
			return []byte("no-cookie-here")
		default:
			return []byte("00000000-0000-0000-0000-000000000000 d6:result2:oke")
		}
	})
	client := newClient(t, port, 20*time.Millisecond)
	for range 2 {
		if _, err := client.Query(context.Background(), Params{"call-id": "c1"}); err == nil {
			t.Error("the command must time out")
		}
	}
}

func TestTheCallerCanGiveUp(t *testing.T) {
	port := startEngine(t, func(string) []byte { return nil })
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := newClient(t, port, time.Minute).Query(ctx, Params{"call-id": "c1"})
	if err == nil {
		t.Fatal("a cancelled command must fail")
	}
}

func TestCloseFailsTheCommandsWaitingAndStopsTheReader(t *testing.T) {
	received := make(chan struct{}, 1)
	port := startEngine(t, func(string) []byte {
		received <- struct{}{}
		return nil
	})
	client, err := NewClient("127.0.0.1", port, time.Minute, nil)
	if err != nil {
		t.Fatal(err)
	}
	failed := make(chan error, 1)
	go func() {
		_, err := client.Query(context.Background(), Params{"call-id": "c1"})
		failed <- err
	}()
	<-received
	if err := client.Close(); err != nil {
		t.Fatal(err)
	}
	if err := <-failed; err == nil || !strings.Contains(err.Error(), "closed") {
		t.Errorf("err = %v", err)
	}
	<-client.done
}

func TestDecodeAnswerRejectsMalformedDatagrams(t *testing.T) {
	for name, datagram := range map[string]string{
		"no separator": "abc",
		"bad bencode":  "abc d1:a",
		"not a dict":   "abc 2:ok",
	} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := decodeAnswer([]byte(datagram)); err == nil {
				t.Error("must fail")
			}
		})
	}
}
