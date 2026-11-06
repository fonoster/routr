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
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"sync"
	"time"

	"github.com/google/uuid"
)

// DefaultTimeout is how long a command waits for its answer, RTPENGINE_TIMEOUT's
// default on Routr 2.
const DefaultTimeout = 5 * time.Second

// maxDatagram is the largest UDP payload an answer can come in.
const maxDatagram = 65535

// Client speaks RTPEngine's NG protocol over UDP: "<cookie> <bencoded dict>"
// each way, the cookie matching an answer to its command. There are no
// retransmissions, as in rtpengine-client: a lost datagram is a timeout, and
// the SIP retransmission that follows is the retry.
//
// It owns one socket and the goroutine that reads it; Close stops both.
type Client struct {
	host    string
	port    uint16
	timeout time.Duration
	log     *slog.Logger
	conn    *net.UDPConn
	done    chan struct{}

	mu      sync.Mutex
	pending map[string]chan Result
}

// NewClient opens the socket and starts reading it. A timeout of zero or less
// is DefaultTimeout.
func NewClient(host string, port int, timeout time.Duration, logger *slog.Logger) (*Client, error) {
	if host == "" {
		return nil, errors.New("rtpengine client: a host is required")
	}
	if port < 1 || port > 65535 {
		return nil, fmt.Errorf("rtpengine client: invalid port %d", port)
	}
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	if logger == nil {
		logger = slog.Default()
	}
	conn, err := net.ListenUDP("udp4", nil)
	if err != nil {
		return nil, fmt.Errorf("rtpengine client: %w", err)
	}
	c := &Client{
		host:    host,
		port:    uint16(port),
		timeout: timeout,
		log:     logger,
		conn:    conn,
		done:    make(chan struct{}),
		pending: map[string]chan Result{},
	}
	go c.read()
	return c, nil
}

// Close stops the reader and fails the commands still waiting.
func (c *Client) Close() error {
	err := c.conn.Close()
	<-c.done
	if errors.Is(err, net.ErrClosed) {
		return nil
	}
	return err
}

// Query is the NG "query" command.
func (c *Client) Query(ctx context.Context, params Params) (Result, error) {
	return c.call(ctx, "query", params)
}

// Offer is the NG "offer" command.
func (c *Client) Offer(ctx context.Context, params Params) (Result, error) {
	return c.call(ctx, "offer", params)
}

// Answer is the NG "answer" command.
func (c *Client) Answer(ctx context.Context, params Params) (Result, error) {
	return c.call(ctx, "answer", params)
}

// Delete is the NG "delete" command.
func (c *Client) Delete(ctx context.Context, params Params) (Result, error) {
	return c.call(ctx, "delete", params)
}

// call sends one command and waits for its answer, its timeout, the caller
// giving up or the client closing, whichever comes first.
func (c *Client) call(ctx context.Context, command string, params Params) (Result, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	cookie := uuid.NewString()
	datagram, err := encodeCommand(cookie, command, params)
	if err != nil {
		return Result{}, fmt.Errorf("rtpengine %s: %w", command, err)
	}
	addr, err := c.resolve(ctx)
	if err != nil {
		return Result{}, fmt.Errorf("rtpengine %s: %w", command, err)
	}

	reply := make(chan Result, 1)
	c.mu.Lock()
	c.pending[cookie] = reply
	c.mu.Unlock()
	defer func() {
		c.mu.Lock()
		delete(c.pending, cookie)
		c.mu.Unlock()
	}()

	if _, err := c.conn.WriteToUDPAddrPort(datagram, addr); err != nil {
		return Result{}, fmt.Errorf("rtpengine %s: %w", command, err)
	}
	select {
	case res := <-reply:
		return res, nil
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return Result{}, fmt.Errorf("rtpengine timeout host:%s port:%d", c.host, c.port)
		}
		return Result{}, fmt.Errorf("rtpengine %s: %w", command, ctx.Err())
	case <-c.done:
		return Result{}, fmt.Errorf("rtpengine %s: the client is closed", command)
	}
}

// resolve looks the host up on every command, as a dgram send does, so an
// RTPEngine that comes back on another address is found.
func (c *Client) resolve(ctx context.Context) (netip.AddrPort, error) {
	ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip4", c.host)
	if err != nil {
		return netip.AddrPort{}, err
	}
	if len(ips) == 0 {
		return netip.AddrPort{}, fmt.Errorf("no address for %s", c.host)
	}
	return netip.AddrPortFrom(ips[0].Unmap(), c.port), nil
}

// read is the goroutine: it hands each answer to the command waiting for its
// cookie. What can't be read or matched is logged and dropped; the command, if
// any, times out.
func (c *Client) read() {
	defer close(c.done)
	buf := make([]byte, maxDatagram)
	for {
		n, _, err := c.conn.ReadFromUDPAddrPort(buf)
		if err != nil {
			if errors.Is(err, net.ErrClosed) {
				return
			}
			c.log.Warn("rtpengine client: read failed", "error", err.Error())
			continue
		}
		cookie, res, err := decodeAnswer(buf[:n])
		if err != nil {
			c.log.Warn("rtpengine client: malformed answer", "error", err.Error())
			continue
		}
		c.mu.Lock()
		reply, ok := c.pending[cookie]
		delete(c.pending, cookie)
		c.mu.Unlock()
		if !ok {
			c.log.Warn("rtpengine client: answer to no command", "cookie", cookie)
			continue
		}
		reply <- res
	}
}

// encodeCommand is BaseClient.encodeMessage: "<cookie> <bencoded params>",
// with "command" among the params.
func encodeCommand(cookie, command string, params Params) ([]byte, error) {
	dict := make(map[string]any, len(params)+1)
	for key, value := range params {
		dict[key] = value
	}
	dict["command"] = command
	out := append(make([]byte, 0, 512), cookie...)
	out = append(out, ' ')
	return appendBencode(out, dict)
}

// decodeAnswer is BaseClient.decodeMessage plus the keys the relay reads.
func decodeAnswer(datagram []byte) (string, Result, error) {
	cookie, payload, found := bytes.Cut(datagram, []byte(" "))
	if !found {
		return "", Result{}, errors.New("no cookie")
	}
	decoded, err := decodeBencode(payload)
	if err != nil {
		return "", Result{}, err
	}
	dict, ok := decoded.(map[string]any)
	if !ok {
		return "", Result{}, errors.New("the answer is not a dictionary")
	}
	res := Result{}
	res.Result, _ = dict["result"].(string)
	res.ErrorReason, _ = dict["error-reason"].(string)
	res.SDP, _ = dict["sdp"].(string)
	return string(cookie), res, nil
}
