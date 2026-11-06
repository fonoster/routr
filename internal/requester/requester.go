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

// Package requester is the Requester of Routr 2 (io.routr.requester): a gRPC
// service that sends a SIP request on behalf of another component (Registry's
// trunk REGISTER) and returns the first response the far end gives.
package requester

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"strconv"
	"sync"
	"time"

	"github.com/emiago/sipgo/sip"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/fonoster/routr/internal/common/pb/requester"
	"github.com/fonoster/routr/internal/common/sipconv"
)

const (
	// sendTimeout bounds resolving the next hop and connecting to it.
	sendTimeout = 10 * time.Second
	// lingerAfterResponse bounds how long a transaction may stay open once its
	// first response went back to the caller: an INVITE in Proceeding has no
	// timer of its own (three minutes is RFC 3261's Timer C).
	lingerAfterResponse = 3 * time.Minute
	// bindAttempts is how many ports New tries: it needs the same one free on
	// TCP and on UDP.
	bindAttempts = 10
	// udpServeWait bounds the wait for the UDP listener to take its first send.
	udpServeWait = time.Second
)

// Options are what New takes.
type Options struct {
	// Logger receives the Requester's logs and sipgo's; slog.Default() when nil.
	Logger *slog.Logger
	// SIPHost is the address the SIP listening points bind to and the one
	// written in Via and Contact; the host's local IP when empty, as in Routr 2.
	SIPHost string
	// OnFailure is told when a listening point stops by itself; may be nil.
	OnFailure func(error)
}

// Requester implements pb.RequesterServer. It owns a SIP stack listening on
// one free port, on TCP and UDP, from New until Close.
type Requester struct {
	pb.UnimplementedRequesterServer

	log       *slog.Logger
	host      string
	port      int
	udpAddr   sip.Addr
	tpl       *sip.TransportLayer
	txl       *sip.TransactionLayer
	listeners []func() error
	onFailure func(error)

	// stop ends with Close: it aborts the sends under way
	stop   context.Context
	cancel context.CancelFunc

	// mu keeps Close from missing a transaction being created
	mu     sync.RWMutex
	closed bool
	// wg holds the serving goroutines and one goroutine per open transaction
	wg        sync.WaitGroup
	closeOnce sync.Once
}

// New binds the SIP listening points and starts serving them. The caller owns
// the result and stops it with Close.
func New(opts Options) (*Requester, error) {
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	host := opts.SIPHost
	if host == "" {
		ip, err := localIP()
		if err != nil {
			return nil, err
		}
		host = ip
	}
	tcp, udp, port, err := bindSamePort(host)
	if err != nil {
		return nil, err
	}

	sipLog := logger.WithGroup("sipgo")
	tpl := sip.NewTransportLayer(net.DefaultResolver, sipconv.NewParser(), nil,
		sip.WithTransportLayerLogger(sipLog))
	txl := sip.NewTransactionLayer(tpl,
		sip.WithTransactionLayerLogger(sipLog),
		sip.WithTransactionLayerUnhandledResponseHandler(func(res *sip.Response) {
			logger.Debug("dropping a response that matches no transaction", "response", res.Short())
		}))
	// The Requester takes no requests; JAIN-SIP's listener dropped them too
	txl.OnRequest(func(_ *sip.Request, tx *sip.ServerTx) {
		if tx != nil {
			tx.Terminate()
		}
	})

	local := udp.LocalAddr().(*net.UDPAddr)
	stop, cancel := context.WithCancel(context.Background())
	r := &Requester{
		log:       logger,
		host:      host,
		port:      port,
		udpAddr:   sip.Addr{IP: local.IP, Port: local.Port},
		tpl:       tpl,
		txl:       txl,
		listeners: []func() error{tcp.Close, udp.Close},
		onFailure: opts.OnFailure,
		stop:      stop,
		cancel:    cancel,
	}
	logger.Info("binding sip listening points to " + net.JoinHostPort(host, strconv.Itoa(port)))
	r.serve("tcp", func() error { return tpl.ServeTCP(tcp) })
	r.serve("udp", func() error { return tpl.ServeUDP(udp) })
	r.waitForUDP()
	return r, nil
}

// bindSamePort binds host on one free port, on TCP and UDP.
func bindSamePort(host string) (net.Listener, net.PacketConn, int, error) {
	var lastErr error
	for range bindAttempts {
		tcp, err := net.Listen("tcp4", net.JoinHostPort(host, "0"))
		if err != nil {
			return nil, nil, 0, fmt.Errorf("could not find a free port to start requester service on: %w", err)
		}
		port := tcp.Addr().(*net.TCPAddr).Port
		udp, err := net.ListenPacket("udp4", net.JoinHostPort(host, strconv.Itoa(port)))
		if err == nil {
			return tcp, udp, port, nil
		}
		lastErr = err
		_ = tcp.Close()
	}
	return nil, nil, 0, fmt.Errorf("could not find a free port to start requester service on: %w", lastErr)
}

// serve runs a listening point on a goroutine Close waits for.
func (r *Requester) serve(name string, run func() error) {
	r.wg.Add(1)
	go func() {
		defer r.wg.Done()
		err := run()
		if r.stop.Err() != nil {
			return
		}
		if err == nil {
			err = errors.New("stopped")
		}
		err = fmt.Errorf("the sip %s listening point: %w", name, err)
		r.log.Error(err.Error())
		if r.onFailure != nil {
			r.onFailure(err)
		}
	}()
}

// waitForUDP returns once the UDP listener is in sipgo's connection pool: a
// send that finds it missing would try to bind its address a second time.
func (r *Requester) waitForUDP() {
	deadline := time.Now().Add(udpServeWait)
	for time.Now().Before(deadline) {
		if conn, err := r.tpl.GetConnection("udp", r.udpAddr.String()); err == nil && conn != nil {
			_, _ = conn.TryClose()
			return
		}
		time.Sleep(time.Millisecond)
	}
}

// Register serves the Requester on a gRPC server.
func (r *Requester) Register(s grpc.ServiceRegistrar) {
	pb.RegisterRequesterServer(s, r)
}

// Close stops the SIP stack and releases the calls still waiting, which fail
// with UNAVAILABLE. It waits for every goroutine of the Requester to end.
func (r *Requester) Close() {
	r.closeOnce.Do(func() {
		r.cancel()
		r.mu.Lock()
		r.closed = true
		r.mu.Unlock()
		for _, closeFn := range r.listeners {
			_ = closeFn()
		}
		r.txl.Close()
		_ = r.tpl.Close()
		r.wg.Wait()
	})
}

// SendMessage is RequesterService.sendMessage: it sends the request and
// answers with the first response, provisional ones included, or with a 408
// made here when the transaction times out (processTimeout).
func (r *Requester) SendMessage(ctx context.Context, in *pb.SendMessageRequest) (*pb.SendMessageResponse, error) {
	req, err := buildRequest(in, r.host, r.port)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	if req.Transport() == "UDP" {
		// As JAIN-SIP does: from the listening point's socket
		req.Laddr = r.udpAddr
	}
	// Short: the headers carry the trunk's credentials (x-gateway-auth)
	r.log.Debug("sending request", "request", req.Short())

	tx, first, err := r.send(req)
	if err != nil {
		if r.stop.Err() != nil {
			return nil, status.Error(codes.Unavailable, "the requester is closing")
		}
		r.log.Warn("an exception occurred while sending request", "callId", callIDOf(req), "error", err)
		return nil, status.Errorf(codes.Internal, "unable to send the request: %s", err)
	}

	select {
	case res, ok := <-first:
		if !ok {
			return r.noResponse(tx, req)
		}
		return toResponse(res)
	case <-ctx.Done():
		tx.Terminate()
		return nil, status.FromContextError(ctx.Err()).Err()
	}
}

// send starts the client transaction and the goroutine that reads it.
func (r *Requester) send(req *sip.Request) (*sip.ClientTx, <-chan *sip.Response, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.closed {
		return nil, nil, errors.New("closed")
	}
	ctx, cancel := context.WithTimeout(r.stop, sendTimeout)
	defer cancel()
	tx, err := r.txl.Request(ctx, req)
	if err != nil {
		return nil, nil, err
	}
	first := make(chan *sip.Response, 1)
	r.wg.Add(1)
	go r.await(tx, first)
	return tx, first, nil
}

// await passes the transaction's first response to first and closes it when
// the transaction ends. It goes on reading after the first response because
// the transaction blocks until its responses are taken, and it has work left:
// retransmitting after a 1xx, and the ACK of an INVITE's failure.
func (r *Requester) await(tx *sip.ClientTx, first chan<- *sip.Response) {
	defer r.wg.Done()
	defer close(first)
	delivered := false
	var expired <-chan time.Time
	for {
		select {
		case res := <-tx.Responses():
			if !delivered {
				delivered = true
				first <- res
				expired = time.After(lingerAfterResponse)
			}
		case <-expired:
			tx.Terminate()
			return
		case <-tx.Done():
			return
		}
	}
}

// noResponse answers a call whose transaction ended without a response.
func (r *Requester) noResponse(tx *sip.ClientTx, req *sip.Request) (*pb.SendMessageResponse, error) {
	err := tx.Err()
	if errors.Is(err, sip.ErrTransactionTimeout) {
		return toResponse(timeoutResponse(req))
	}
	if r.stop.Err() != nil {
		return nil, status.Error(codes.Unavailable, "the requester is closing")
	}
	r.log.Warn("the transaction ended with no response", "callId", callIDOf(req), "error", err)
	return nil, status.Errorf(codes.Internal, "the transaction ended with no response: %v", err)
}

func toResponse(res *sip.Response) (*pb.SendMessageResponse, error) {
	dto, err := sipconv.MessageToDTO(res)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "unable to convert the response: %s", err)
	}
	return &pb.SendMessageResponse{Message: dto}, nil
}

func callIDOf(msg sip.Message) string {
	if id := msg.CallID(); id != nil {
		return id.Value()
	}
	return ""
}
