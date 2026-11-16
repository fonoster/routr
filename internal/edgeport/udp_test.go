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
	"net"
	"testing"
)

func listenUDP(t *testing.T) *net.UDPConn {
	t.Helper()
	conn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func TestSetUDPReadBuffer(t *testing.T) {
	conn := listenUDP(t)
	before, err := udpReadBufferSize(conn)
	if err != nil {
		t.Fatalf("read the default: %v", err)
	}
	// Small enough for any kernel's maximum, so the grant is the request
	// (Linux reports twice the request; never less)
	const want = 256 << 10
	granted, err := setUDPReadBuffer(conn, want)
	if err != nil {
		t.Fatalf("set: %v", err)
	}
	if granted < want {
		t.Errorf("granted %d, want at least %d (default was %d)", granted, want, before)
	}
}

func TestSetUDPReadBufferRejectsBadInput(t *testing.T) {
	conn := listenUDP(t)
	for _, size := range []int{0, -1} {
		if _, err := setUDPReadBuffer(conn, size); err == nil {
			t.Errorf("size %d accepted", size)
		}
	}
	if _, err := setUDPReadBuffer(nil, DefaultUDPReadBuffer); err == nil {
		t.Error("nil connection accepted")
	}
	closed := listenUDP(t)
	_ = closed.Close()
	if _, err := setUDPReadBuffer(closed, DefaultUDPReadBuffer); err == nil {
		t.Error("closed connection accepted")
	}
}

func TestUDPReadBufferOption(t *testing.T) {
	if got := udpReadBufferOf(Options{}); got != DefaultUDPReadBuffer {
		t.Errorf("zero option: %d, want the default %d", got, DefaultUDPReadBuffer)
	}
	if got := udpReadBufferOf(Options{UDPReadBuffer: 1 << 20}); got != 1<<20 {
		t.Errorf("set option: %d, want %d", got, 1<<20)
	}
	if got := udpReadBufferOf(Options{UDPReadBuffer: -1}); got != DefaultUDPReadBuffer {
		t.Errorf("negative option: %d, want the default %d", got, DefaultUDPReadBuffer)
	}
}
