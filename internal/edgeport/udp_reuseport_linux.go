//go:build linux

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
	"context"
	"net"
	"runtime"
	"syscall"

	"golang.org/x/sys/unix"
)

// maxUDPReaders caps the SO_REUSEPORT sockets on a large machine.
const maxUDPReaders = 8

// defaultUDPReaders is one reader per core, up to the cap.
func defaultUDPReaders() int {
	return min(runtime.GOMAXPROCS(0), maxUDPReaders)
}

// listenUDPSockets binds n sockets to one address with SO_REUSEPORT: the kernel
// spreads sources over them by hashing the 4-tuple, so one source stays on one
// socket and in order. One socket needs no option, and asks for none.
//
// The kernel would let a second EdgePort of the same user join the group and
// take half the traffic in silence. A first bind with no option can't join
// anything: a port in use fails it with EADDRINUSE. It is released for the group
// right away; port 0 picks the port the group then asks for.
func listenUDPSockets(addr string, n int) ([]*net.UDPConn, error) {
	if n <= 1 {
		conn, err := net.ListenPacket("udp4", addr)
		if err != nil {
			return nil, err
		}
		return []*net.UDPConn{conn.(*net.UDPConn)}, nil
	}
	probe, err := net.ListenPacket("udp4", addr)
	if err != nil {
		return nil, err
	}
	bind := probe.LocalAddr().String()
	if err := probe.Close(); err != nil {
		return nil, err
	}
	lc := net.ListenConfig{
		Control: func(_, _ string, c syscall.RawConn) error {
			var sockErr error
			if err := c.Control(func(fd uintptr) {
				sockErr = unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_REUSEPORT, 1)
			}); err != nil {
				return err
			}
			return sockErr
		},
	}
	socks := make([]*net.UDPConn, 0, n)
	for range n {
		conn, err := lc.ListenPacket(context.Background(), "udp4", bind)
		if err != nil {
			for _, s := range socks {
				_ = s.Close()
			}
			return nil, err
		}
		socks = append(socks, conn.(*net.UDPConn))
	}
	return socks, nil
}
