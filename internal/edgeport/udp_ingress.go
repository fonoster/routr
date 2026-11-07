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
	"errors"
	"hash/maphash"
	"log/slog"
	"net"
	"net/netip"
	"runtime"
	"sync"
	"sync/atomic"

	"github.com/emiago/sipgo/sip"
)

const (
	// DefaultUDPQueueSize is what each parsing worker holds waiting. Past it a
	// datagram is dropped and counted, as the kernel would: SIP retransmits.
	DefaultUDPQueueSize = 4096
	// udpSmallPacket is what the pool of packet buffers holds; a larger
	// datagram gets one of its own. A SIP message is rarely over it.
	udpSmallPacket = 2048
	// udpMaxWorkers caps the parsing workers on a large machine: the parser
	// isn't what's left to scale past this.
	udpMaxWorkers = 16
)

// DefaultUDPWorkers is how many workers parse off the read loops.
func DefaultUDPWorkers() int {
	return min(max(runtime.GOMAXPROCS(0), 2), udpMaxWorkers)
}

// udpPacket is a datagram on its way to a worker.
type udpPacket struct {
	data []byte
	// pooled is the pool's buffer data sits in; nil when data is its own
	pooled *[udpSmallPacket]byte
	source netip.AddrPort
}

// udpIngress reads the UDP sockets and parses off the read loop: one reader per
// socket, a bounded queue per worker, and a worker per Call-ID hash.
//
// Order within a call survives both hand-offs. A reader takes one socket's
// datagrams in order; SO_REUSEPORT keeps a source on one socket, as it hashes
// the 4-tuple; and all of a call's datagrams from it go to one worker, whose
// queue is FIFO. Two sources of one call were never ordered by the network.
//
// A full queue drops and counts; it never grows and it never blocks the reader,
// which is what would make the kernel drop instead, unseen.
type udpIngress struct {
	log     *slog.Logger
	parser  *sip.Parser
	handle  func(sip.Message)
	dropped func()
	readErr func(error)

	seed    maphash.Seed
	queues  []chan udpPacket
	buffers sync.Pool
	parsed  atomic.Uint64

	stop    chan struct{}
	workers sync.WaitGroup
	readers sync.WaitGroup
}

func newUDPIngress(log *slog.Logger, parser *sip.Parser, workers, queueSize int, handle func(sip.Message), dropped func(), readErr func(error)) *udpIngress {
	if workers <= 0 {
		workers = DefaultUDPWorkers()
	}
	if queueSize <= 0 {
		queueSize = DefaultUDPQueueSize
	}
	in := &udpIngress{
		log:     log,
		parser:  parser,
		handle:  handle,
		dropped: dropped,
		readErr: readErr,
		seed:    maphash.MakeSeed(),
		queues:  make([]chan udpPacket, workers),
		stop:    make(chan struct{}),
	}
	in.buffers.New = func() any { return new([udpSmallPacket]byte) }
	for i := range in.queues {
		queue := make(chan udpPacket, queueSize)
		in.queues[i] = queue
		in.workers.Add(1)
		go in.work(queue)
	}
	return in
}

// read serves one socket until it closes. Each socket gets one reader, so its
// datagrams keep their order; more than one reader on a socket wouldn't.
func (in *udpIngress) read(conn *net.UDPConn) {
	in.readers.Add(1)
	go func() {
		defer in.readers.Done()
		trace := &sip.UDPConnection{PacketConn: conn, PacketAddr: conn.LocalAddr().String(), Listener: true}
		buf := make([]byte, sip.TransportBufferReadSize)
		for {
			var n int
			var source netip.AddrPort
			var err error
			if sip.SIPDebug {
				var addr net.Addr
				n, addr, err = trace.ReadFrom(buf)
				if err == nil {
					source = addr.(*net.UDPAddr).AddrPort()
				}
			} else {
				n, source, err = conn.ReadFromUDPAddrPort(buf)
			}
			if err != nil {
				if errors.Is(err, net.ErrClosed) {
					return
				}
				if isRecvMsgSizeErr(err) {
					continue
				}
				in.readErr(err)
				return
			}
			in.enqueue(buf[:n], source)
		}
	}()
}

// enqueue copies a datagram out of the reader's buffer and hands it to the
// worker of its call.
func (in *udpIngress) enqueue(data []byte, source netip.AddrPort) {
	pkt := udpPacket{source: source}
	if len(data) <= udpSmallPacket {
		pkt.pooled = in.buffers.Get().(*[udpSmallPacket]byte)
		pkt.data = pkt.pooled[:copy(pkt.pooled[:], data)]
	} else {
		pkt.data = append([]byte(nil), data...)
	}
	queue := in.queues[maphash.Bytes(in.seed, callIDOfDatagram(data))%uint64(len(in.queues))]
	select {
	case queue <- pkt:
	default:
		in.release(pkt)
		in.dropped()
	}
}

func (in *udpIngress) release(pkt udpPacket) {
	if pkt.pooled != nil {
		in.buffers.Put(pkt.pooled)
	}
}

func (in *udpIngress) work(queue chan udpPacket) {
	defer in.workers.Done()
	for {
		select {
		case <-in.stop:
			return
		case pkt := <-queue:
			safely(in.log, func() { in.parseAndHandle(pkt) })
			in.release(pkt)
		}
	}
}

// parseAndHandle is what sipgo's UDP transport does with a datagram: padding
// and keep-alives go, and the message is marked with where it came from. The
// parser copies what it keeps, so the buffer goes back to the pool afterwards.
func (in *udpIngress) parseAndHandle(pkt udpPacket) {
	data := pkt.data
	if len(bytes.Trim(data, "\x00")) == 0 {
		return
	}
	if len(data) <= 4 && len(bytes.Trim(data, "\r\n")) == 0 {
		return
	}
	msg, err := in.parser.ParseSIP(data)
	if err != nil {
		in.log.Error("failed to parse", "data", string(data), "error", err)
		return
	}
	msg.SetTransport("UDP")
	msg.SetSource(pkt.source.String())
	in.parsed.Add(1)
	in.handle(msg)
}

// wait stops the workers; the sockets are closed by then, so the readers end
// on their own. What's queued goes with them.
func (in *udpIngress) wait() {
	in.readers.Wait()
	close(in.stop)
	in.workers.Wait()
}

// callIDOfDatagram finds the Call-ID of a datagram with no parsing: it decides
// a worker, so a wrong answer costs order and a header it can't find costs nothing
// (every such message lands on one worker, which then rejects it).
func callIDOfDatagram(data []byte) []byte {
	for len(data) > 0 {
		end := bytes.IndexByte(data, '\n')
		line := data
		if end >= 0 {
			line = data[:end]
			data = data[end+1:]
		} else {
			data = nil
		}
		line = bytes.TrimRight(line, "\r")
		if len(line) == 0 {
			// The blank line ends the headers
			return nil
		}
		colon := bytes.IndexByte(line, ':')
		if colon <= 0 {
			continue
		}
		name := bytes.TrimRight(line[:colon], " \t")
		if (len(name) == 1 && (name[0] == 'i' || name[0] == 'I')) || (len(name) == 7 && bytes.EqualFold(name, []byte("Call-ID"))) {
			return bytes.TrimSpace(line[colon+1:])
		}
	}
	return nil
}
