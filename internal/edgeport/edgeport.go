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

// Package edgeport is the Go EdgePort: the SIP transport at the edge, which
// hands every message to the processor over gRPC and does what the reply says,
// as io.routr.GRPCSipListener does in the Java EdgePort.
package edgeport

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/emiago/sipgo/sip"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/sipconv"
)

// abandonAfter is how long a server transaction that will get no final
// response is kept before it is released: 64 * T1, as long as the caller's
// own client transaction can wait.
const abandonAfter = 64 * 500 * time.Millisecond

// processorTimeout bounds a call to the processor. The Java EdgePort waits
// without a deadline; a bound keeps a hung processor from piling up work.
const processorTimeout = 30 * time.Second

type clientInfo struct {
	callID string
	server *sip.ServerTx
	creds  *Credentials
	// replaced is set when an authentication retry took over the server
	// transaction, which then no longer depends on this one
	replaced atomic.Bool
}

type serverInfo struct {
	final atomic.Bool
	// the status code of the final response sent
	code atomic.Int32
}

// EdgePort is a running EdgePort.
type EdgePort struct {
	cfg     *config.Config
	env     config.Env
	conv    *sipconv.Converter
	client  ppb.ProcessorClient
	grpc    *grpc.ClientConn
	tpl     *sip.TransportLayer
	txl     *sip.TransactionLayer
	txm     *TransactionManager
	events  *EventProcessor
	queue   *CallQueue
	ports   map[string]int
	udpAddr *sip.Addr

	clients sync.Map // *sip.ClientTx -> *clientInfo
	servers sync.Map // *sip.ServerTx -> *serverInfo

	listeners []func() error
	resolver  *net.Resolver

	udpReadBuffer int
}

// Options are what New needs besides the config.
type Options struct {
	Env     config.Env
	Version string
	// UDPReadBuffer is the receive buffer, in bytes, asked of the kernel for
	// every UDP listening point; zero or less means DefaultUDPReadBuffer.
	UDPReadBuffer int
}

// udpReadBufferOf returns the UDP read buffer the options ask for.
func udpReadBufferOf(opts Options) int {
	if opts.UDPReadBuffer <= 0 {
		return DefaultUDPReadBuffer
	}
	return opts.UDPReadBuffer
}

// localnetsFromInterfaces is what GRPCSipListener does when no localnets are
// configured: the first IPv4 address of every interface, with its prefix.
func localnetsFromInterfaces(ignoreLoopback bool) []string {
	var nets []string
	ifaces, err := net.Interfaces()
	if err != nil {
		logger().Error("error getting network interfaces", "error", err)
		return nets
	}
	for _, iface := range ifaces {
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			ipnet, ok := a.(*net.IPNet)
			if !ok || ipnet.IP.To4() == nil {
				continue
			}
			host := ipnet.IP.String()
			if ignoreLoopback && strings.HasPrefix(host, "127.0.0.1") {
				break
			}
			ones, _ := ipnet.Mask.Size()
			nets = append(nets, host+"/"+strconv.Itoa(ones))
			break
		}
	}
	return nets
}

// New prepares an EdgePort: the processor connection, the SIP stack and the
// listening points. Start binds them.
func New(cfg *config.Config, opts Options) (*EdgePort, error) {
	env := opts.Env
	spec := cfg.Spec

	addr := ""
	if spec.Processor != nil {
		addr = spec.Processor.Addr
	}
	if env.ProcessorAddr != "" {
		addr = env.ProcessorAddr
	}
	ref := cfg.Ref
	if env.Hostname != "" {
		ref = env.Hostname
	}

	externalAddrs := config.Pick(env.ExternalAddrs, spec.ExternalAddrs)
	localnets := config.Pick(env.Localnets, spec.Localnets)
	if len(localnets) == 0 {
		localnets = localnetsFromInterfaces(env.IgnoreLoopbackFromLocalnets)
	}
	aliases := config.Pick(env.Aliases, spec.Aliases)

	var lps []*ppb.NetInterface
	ports := map[string]int{}
	for _, t := range spec.Transport {
		tr, err := sipconv.TransportOf(t.Protocol)
		if err != nil {
			return nil, err
		}
		lps = append(lps, &ppb.NetInterface{Host: t.BindAddr, Port: int32(t.Port), Transport: tr})
		ports[strings.ToUpper(t.Protocol)] = t.Port
	}

	logger().Info(fmt.Sprintf("starting edgeport ref = %s version = %s at %s", ref, opts.Version, spec.BindAddr))
	logger().Info(fmt.Sprintf("localnets list [%s]", strings.Join(localnets, ",")))
	logger().Info(fmt.Sprintf("external hosts list [%s]", strings.Join(externalAddrs, ",")))
	logger().Info(fmt.Sprintf("aliases list [%s]", strings.Join(aliases, ",")))

	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("unable to reach the processor at %s: %w", addr, err)
	}

	var publishers []Publisher
	if env.ConsolePublisherEnabled {
		publishers = append(publishers, ConsolePublisher{})
		logger().Info("console publisher enabled")
	}
	if env.NatsPublisherEnabled {
		url := env.NatsPublisherURL
		if url == "" {
			url = "nats://localhost:4222"
		}
		subject := env.NatsPublisherSubject
		if subject == "" {
			subject = "routr"
		}
		p, err := NewNATSPublisher(url, subject)
		if err != nil {
			return nil, fmt.Errorf("unable to connect to nats at %s: %w", url, err)
		}
		publishers = append(publishers, p)
		logger().Info(fmt.Sprintf("nats publisher enabled with subject %s and url %s", subject, url))
	}

	e := &EdgePort{
		cfg:  cfg,
		env:  env,
		grpc: conn,
		conv: &sipconv.Converter{
			EdgePortRef:     ref,
			EdgePortVersion: opts.Version,
			ListeningPoints: lps,
			ExternalAddrs:   externalAddrs,
			Localnets:       localnets,
			Aliases:         aliases,
			BindAddr:        spec.BindAddr,
		},
		client:   ppb.NewProcessorClient(conn),
		txm:      NewTransactionManager(),
		events:   NewEventProcessor(publishers),
		queue:    NewCallQueue(),
		ports:    ports,
		resolver: net.DefaultResolver,

		udpReadBuffer: udpReadBufferOf(opts),
	}
	return e, nil
}

// Start binds the listening points and serves them until ctx is done.
func (e *EdgePort) Start(ctx context.Context) error {
	// JAIN-SIP sends any size over UDP; sipgo refuses past 1300 bytes by default
	sip.UDPMTUSize = 65535
	sip.TransportBufferReadSize = 65535
	sipLog := logger()
	if !e.env.SipTrace {
		sipLog = logger().WithGroup("sipgo")
	}
	sip.SetDefaultLogger(sipLog)
	if e.env.SipTrace {
		sip.SIPDebug = true
	}

	serverTLS, clientTLS, err := TLSConfigs(e.cfg.Spec.SecurityContext, e.env)
	if err != nil {
		return err
	}

	parser := sipconv.NewParser()
	e.tpl = sip.NewTransportLayer(e.resolver, parser, clientTLS,
		sip.WithTransportLayerLogger(sipLog))
	// Runs before the transaction layer sees the message, on the reading
	// goroutine: marks the top Via as JAIN-SIP's message channels do
	e.tpl.OnMessage(markReceived)
	e.txl = sip.NewTransactionLayer(e.tpl,
		sip.WithTransactionLayerLogger(sipLog),
		sip.WithTransactionLayerUnhandledResponseHandler(e.onStrayResponse))
	e.txl.OnRequest(e.onRequest)

	errs := make(chan error, len(e.cfg.Spec.Transport))
	for _, t := range e.cfg.Spec.Transport {
		addr := net.JoinHostPort(t.BindAddr, strconv.Itoa(t.Port))
		switch t.Protocol {
		case "udp":
			conn, err := net.ListenPacket("udp4", addr)
			if err != nil {
				return fmt.Errorf("unable to bind udp://%s", addr)
			}
			// The kernel's default buffer overflows in short bursts under load
			// (ROUTR3.md section 1); the kernel caps the request at its
			// maximum silently, so log what it granted
			udp, _ := conn.(*net.UDPConn)
			if granted, err := setUDPReadBuffer(udp, e.udpReadBuffer); err != nil {
				logger().Warn("unable to size the udp read buffer", "addr", addr, "error", err)
			} else if granted == 0 {
				logger().Info("udp read buffer sized", "addr", addr, "requested", e.udpReadBuffer, "granted", "unknown")
			} else {
				logger().Info("udp read buffer sized", "addr", addr, "requested", e.udpReadBuffer, "granted", granted)
				if granted < e.udpReadBuffer {
					logger().Warn("the kernel granted less than the udp read buffer asked for: raise its maximum (net.core.rmem_max on Linux, kern.ipc.maxsockbuf on macOS)",
						"addr", addr, "requested", e.udpReadBuffer, "granted", granted)
				}
			}
			host, port, _ := net.SplitHostPort(conn.LocalAddr().String())
			p, _ := strconv.Atoi(port)
			e.udpAddr = &sip.Addr{IP: net.ParseIP(host), Port: p}
			go func() { errs <- e.tpl.ServeUDP(conn) }()
			e.listeners = append(e.listeners, conn.Close)
		case "tcp", "ws":
			l, err := net.Listen("tcp4", addr)
			if err != nil {
				return fmt.Errorf("unable to bind %s://%s", t.Protocol, addr)
			}
			if t.Protocol == "tcp" {
				go func() { errs <- e.tpl.ServeTCP(l) }()
			} else {
				go func() { errs <- e.tpl.ServeWS(l) }()
			}
			e.listeners = append(e.listeners, l.Close)
		case "tls", "wss":
			if serverTLS == nil {
				return fmt.Errorf("found at least one secure protocol which requires setting the .spec.securityContext")
			}
			l, err := tls.Listen("tcp4", addr, serverTLS)
			if err != nil {
				return fmt.Errorf("unable to bind %s://%s", t.Protocol, addr)
			}
			if t.Protocol == "tls" {
				go func() { errs <- e.tpl.ServeTLS(l) }()
			} else {
				go func() { errs <- e.tpl.ServeWSS(l) }()
			}
			e.listeners = append(e.listeners, l.Close)
		default:
			return fmt.Errorf("unsupported transport %q", t.Protocol)
		}
		logger().Info(fmt.Sprintf("listening on %s://%s", t.Protocol, addr))
	}

	select {
	case <-ctx.Done():
		e.Close()
		return nil
	case err := <-errs:
		e.Close()
		return err
	}
}

// Close stops the listening points and the processor connection.
func (e *EdgePort) Close() {
	for _, closeFn := range e.listeners {
		_ = closeFn()
	}
	if e.txl != nil {
		e.txl.Close()
	}
	if e.tpl != nil {
		_ = e.tpl.Close()
	}
	_ = e.grpc.Close()
}

// markReceived adds received and rport to the top Via of a request, as
// JAIN-SIP's message channels do before the listener sees it: received when
// the sender asked for rport or its sent-by host is not the packet's source,
// and rport (the source port) when it asked for it. Over a connection
// (TCP, TLS, WS, WSS) JAIN-SIP sets rport whether or not it was asked for.
func markReceived(msg sip.Message) {
	req, ok := msg.(*sip.Request)
	if !ok {
		return
	}
	via := req.Via()
	if via == nil {
		return
	}
	host, port, err := net.SplitHostPort(req.Source())
	if err != nil {
		return
	}
	if via.Params == nil {
		via.Params = sip.NewParams()
	}
	_, hasRport := via.Params.Get("rport")
	if hasRport || via.Host != host {
		via.Params.Add("received", host)
	}
	if hasRport || sip.IsReliable(req.Transport()) {
		via.Params.Add("rport", port)
	}
}

func callIDOf(msg sip.Message) string {
	if id := msg.CallID(); id != nil {
		return id.Value()
	}
	return ""
}

func (e *EdgePort) localPort(msg sip.Message) int {
	return e.ports[strings.ToUpper(msg.Transport())]
}

func (e *EdgePort) process(req *ppb.MessageRequest) (*ppb.MessageResponse, error) {
	ctx, cancel := context.WithTimeout(context.Background(), processorTimeout)
	defer cancel()
	return e.client.ProcessMessage(ctx, req)
}

// trackServer keeps the server transaction's bookkeeping and releases it when
// the transaction ends.
func (e *EdgePort) trackServer(callID string, tx *sip.ServerTx) {
	e.servers.Store(tx, &serverInfo{})
	// Released in call order, after the work already queued for the call: over a
	// connection a transaction ends as soon as its final response is passed up
	tx.OnTerminate(func(string, error) {
		e.queue.Run(callID, func() {
			e.txm.RemoveServerTransaction(callID, tx)
			e.servers.Delete(tx)
		})
	})
}

// passAcks hands the ACKs sipgo matches to an INVITE server transaction to
// processRequest. An ACK that reuses its INVITE's branch (SIPp does, for the
// ACK to a 2xx) lands on the INVITE's transaction (RFC 6026 "Accepted"); JAIN
// SIP gives such an ACK to the listener, so it is forwarded like any 2xx ACK.
// The ACK to a failure response stays with the transaction, as in JAIN SIP.
func (e *EdgePort) passAcks(callID string, tx *sip.ServerTx) {
	for {
		select {
		case ack := <-tx.Acks():
			v, ok := e.servers.Load(tx)
			if !ok {
				continue
			}
			if code := v.(*serverInfo).code.Load(); code >= 200 && code < 300 {
				e.queue.Run(callID, func() { e.processRequest(ack, nil) })
			}
		case <-tx.Done():
			return
		}
	}
}

func (e *EdgePort) finalSent(tx *sip.ServerTx) bool {
	if v, ok := e.servers.Load(tx); ok {
		return v.(*serverInfo).final.Load()
	}
	// Not tracked any more: the transaction is over
	return true
}

// abandon releases a server transaction that will get no final response. The
// Java EdgePort never answers such a request either; this only frees the
// transaction once the caller can no longer be waiting for it.
func (e *EdgePort) abandon(tx *sip.ServerTx) {
	if tx == nil {
		return
	}
	go func() {
		select {
		case <-tx.Done():
		case <-time.After(abandonAfter):
			if !e.finalSent(tx) {
				tx.Terminate()
			}
		}
	}()
}

// trackClient keeps a client transaction's bookkeeping and passes its
// responses, retransmitted 2xx included, to processResponse in call order.
func (e *EdgePort) trackClient(tx *sip.ClientTx, callID string, server *sip.ServerTx, creds *Credentials) {
	info := &clientInfo{callID: callID, server: server, creds: creds}
	e.clients.Store(tx, info)
	tx.OnRetransmission(func(res *sip.Response) {
		e.queue.Run(callIDOf(res), func() { e.processResponse(res, tx) })
	})
	go func() {
		for {
			select {
			case res := <-tx.Responses():
				e.queue.Run(callIDOf(res), func() { e.processResponse(res, tx) })
			case <-tx.Done():
				// Released in call order, after the responses this loop queued: over
				// a connection the transaction ends (Timer D is 0) as soon as its
				// final response is passed up, before processResponse looks at it
				e.queue.Run(callID, func() {
					e.txm.RemoveClientTransaction(callID, tx)
					e.clients.Delete(tx)
				})
				if server != nil && !info.replaced.Load() {
					e.abandon(server)
				}
				return
			}
		}
	}()
}

func (e *EdgePort) clientInfo(tx *sip.ClientTx) *clientInfo {
	if tx == nil {
		return nil
	}
	if v, ok := e.clients.Load(tx); ok {
		return v.(*clientInfo)
	}
	return nil
}

func (e *EdgePort) resolve(host string) (net.IP, error) {
	if ip := net.ParseIP(strings.Trim(host, "[]")); ip != nil {
		return ip, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	addrs, err := e.resolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	for _, a := range addrs {
		if a.IP.To4() != nil {
			return a.IP, nil
		}
	}
	if len(addrs) > 0 {
		return addrs[0].IP, nil
	}
	return nil, fmt.Errorf("no address for %s", host)
}

// route points a request at its next hop (NextHop), sending UDP from the
// listening point's socket as JAIN-SIP does.
func (e *EdgePort) route(req *sip.Request) Hop {
	hop := NextHop(req)
	req.SetTransport(hop.Transport)
	req.SetDestination(hop.addr())
	if hop.Transport == "UDP" && e.udpAddr != nil {
		req.Laddr = *e.udpAddr
	}
	return hop
}

// respond sends a response on its server transaction.
func (e *EdgePort) respond(tx *sip.ServerTx, res *sip.Response) error {
	if hop, ok := ResponseHop(res); ok {
		if ip, err := e.resolve(hop.Host); err == nil {
			res.SetDestination(net.JoinHostPort(ip.String(), strconv.Itoa(hop.Port)))
		}
	}
	if res.StatusCode >= 200 {
		if v, ok := e.servers.Load(tx); ok {
			v.(*serverInfo).code.Store(int32(res.StatusCode))
			v.(*serverInfo).final.Store(true)
		}
	}
	return tx.Respond(res)
}

// sendStatelessResponse sends a response with no server transaction to the
// top Via (SipProvider.sendResponse).
func (e *EdgePort) sendStatelessResponse(res *sip.Response) error {
	hop, ok := ResponseHop(res)
	if !ok {
		return fmt.Errorf("response without Via")
	}
	ip, err := e.resolve(hop.Host)
	if err != nil {
		return err
	}
	dest := net.JoinHostPort(ip.String(), strconv.Itoa(hop.Port))
	res.SetDestination(dest)
	res.SetTransport(hop.Transport)
	network := strings.ToLower(hop.Transport)

	if network == "udp" {
		if e.udpAddr == nil {
			return fmt.Errorf("no udp listening point")
		}
		conn, err := e.tpl.GetConnection("udp", e.udpAddr.String())
		if err != nil {
			return err
		}
		defer conn.TryClose()
		return conn.WriteMsg(res)
	}

	conn, err := e.tpl.GetConnection(network, dest)
	if err != nil {
		// No connection to the far end: open one, as a request would
		probe := sip.NewRequest(sip.OPTIONS, sip.Uri{Host: ip.String(), Port: hop.Port})
		probe.AppendHeader(res.Via().Clone())
		probe.SetTransport(hop.Transport)
		probe.SetDestination(dest)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		conn, err = e.tpl.ClientRequestConnection(ctx, probe)
		if err != nil {
			return err
		}
	}
	defer conn.TryClose()
	return conn.WriteMsg(res)
}

// sendStateless sends a request with no client transaction (an ACK for a 2xx).
func (e *EdgePort) sendStateless(req *sip.Request) error {
	return e.tpl.WriteMsg(req)
}

// newClientTransaction sends a request on a new client transaction.
func (e *EdgePort) newClientTransaction(req *sip.Request) (*sip.ClientTx, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return e.txl.Request(ctx, req)
}

// transportName returns the enum name of a message's transport.
func transportName(t common.Transport) string {
	return t.String()
}
