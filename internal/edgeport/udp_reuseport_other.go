//go:build !linux

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

import "net"

// defaultUDPReaders is one: only Linux balances SO_REUSEPORT between sockets by
// source. BSD and macOS hand everything to one of them, and two readers on one
// socket would swap datagrams.
func defaultUDPReaders() int { return 1 }

// listenUDPSockets binds one socket: n is what was asked, and without
// balancing more than one reads nothing.
func listenUDPSockets(addr string, _ int) ([]*net.UDPConn, error) {
	conn, err := net.ListenPacket("udp4", addr)
	if err != nil {
		return nil, err
	}
	return []*net.UDPConn{conn.(*net.UDPConn)}, nil
}
