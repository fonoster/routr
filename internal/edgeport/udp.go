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
	"errors"
	"fmt"
	"net"
)

// DefaultUDPReadBuffer is the UDP receive buffer asked of the kernel for
// every UDP listening point when Options.UDPReadBuffer is zero: 4 MiB, the
// size that removed the drops measured at 2,500 calls/s (ROUTR3.md section 1).
// The kernel's default (208 KiB on Linux) overflows in short bursts.
const DefaultUDPReadBuffer = 4 << 20

// setUDPReadBuffer asks the kernel for a receive buffer of size bytes on conn
// and returns the size it granted, as SO_RCVBUF reads back (0 where it
// can't be read back, see udp_other.go). The kernel caps
// the request at its maximum (net.core.rmem_max on Linux, kern.ipc.maxsockbuf
// on macOS) without an error, so the granted value is the one to log. Linux
// reports twice the value it was asked for, the bookkeeping overhead included.
func setUDPReadBuffer(conn *net.UDPConn, size int) (int, error) {
	if conn == nil {
		return 0, fmt.Errorf("no udp connection")
	}
	if size <= 0 {
		return 0, fmt.Errorf("udp read buffer must be positive, got %d", size)
	}
	if err := conn.SetReadBuffer(size); err != nil {
		return 0, fmt.Errorf("unable to set the udp read buffer to %d: %w", size, err)
	}
	granted, err := udpReadBufferSize(conn)
	if errors.Is(err, errors.ErrUnsupported) {
		// Set, but not readable back on this platform
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("unable to read the udp read buffer back: %w", err)
	}
	return granted, nil
}

// udpReadBufferSize reads SO_RCVBUF of conn.
func udpReadBufferSize(conn *net.UDPConn) (int, error) {
	raw, err := conn.SyscallConn()
	if err != nil {
		return 0, err
	}
	var size int
	var sockErr error
	if err := raw.Control(func(fd uintptr) {
		size, sockErr = getsockoptRcvbuf(fd)
	}); err != nil {
		return 0, err
	}
	return size, sockErr
}
