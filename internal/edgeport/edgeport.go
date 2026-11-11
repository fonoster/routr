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
	"errors"
	"fmt"
	"google.golang.org/grpc"
	"log/slog"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/sipconv"
)

// abandonAfter is how long a server transaction that will get no final
// response is kept before it is released: 64 * T1, as long as the caller's
// own client transaction can wait.
const abandonAfter = 64 * 500 * time.Millisecond

// streamWriteTimeout bounds a write on TCP, TLS, WS and WSS: a peer that stopped
// reading holds that write this long at most, and its connection is closed then
// (txLayer.writeOut). RFC 3261 gives no value; a retransmission or a timer of any
// other transaction doesn't wait on it.
const streamWriteTimeout = 10 * time.Second

// closeWait bounds what Close waits for after the listening points: closing a TLS
// connection whose buffer is full takes sipgo up to 5 s, one connection at a time.
const closeWait = 5 * time.Second

// processorTimeout bounds a call to the processor. The Java EdgePort waits
// without a deadline; a bound keeps a hung processor from piling up work.
const processorTimeout = 30 * time.Second

// EdgePort is a running EdgePort.
type EdgePort struct {
	cfg *config.Config
	// stripSessionProgressSdp and sipTrace are spec.stripSessionProgressSdp
	// and spec.sipTrace, read once
	stripSessionProgressSdp bool
	sipTrace                bool
	// methods is spec.methods, upper-cased: the methods an out-of-dialog
	// request may have. Nil passes every method (a Config built in code
	// without the list; every file sets it or gets the default).
	methods map[string]bool
	// respondUnknown is spec.unknownMethodAction Respond: 501 to a request
	// outside methods, where Discard (the default) sends nothing
	respondUnknown bool
	log            *slog.Logger
	conv           *sipconv.Converter
	client         ppb.ProcessorClient
	tpl            *sip.TransportLayer
	txl            *txLayer
	ingress        *udpIngress
	txm            *TransactionManager
	events         *EventProcessor
	queue          *CallQueue
	ports          map[string]int
	udpAddr        *sip.Addr

	listeners []func() error
	resolver  *net.Resolver
	closeOnce sync.Once

	udpReadBuffer int
	limits        Limits
	overflows     overflowCounters

	// tel is nil with telemetry off
	tel *sipTelemetry
	// internalNets are the localnets: who may set a request's trace context
	// and whom a forwarded request may carry it to
	internalNets []netip.Prefix
}

// Options are what New needs besides the config.
type Options struct {
	// Processor takes every message the EdgePort receives (ROUTR3.md § 3.1):
	// the Dispatcher in process, or the generated client over a connection
	// the caller owns. Required.
	Processor ppb.ProcessorClient
	// Logger receives the EdgePort's logs, and sipgo's under the "sipgo"
	// group; slog.Default() when nil.
	Logger  *slog.Logger
	Version string
	// UDPReadBuffer is the receive buffer, in bytes, asked of the kernel for
	// every UDP listening point; zero or less means DefaultUDPReadBuffer.
	UDPReadBuffer int
	// Limits bound what the EdgePort holds; a zero field takes its default.
	Limits Limits
}

// Limits are the EdgePort's bounds. Each has an answer past it (overflow.go).
type Limits struct {
	// Transactions bounds each direction's transactions. At the RFC's timers a
	// call holds about 28 server and 15 client transaction-seconds per second
	// of rate, so the default carries past 10,000 calls/s.
	Transactions int
	// Dialogs bounds the dialogs the EdgePort remembers.
	Dialogs int
	// DialogIdle is how long a dialog with no in-dialog request is remembered.
	DialogIdle time.Duration
	// CallQueued and Queued bound the work waiting, per call and over all.
	CallQueued, Queued int
	// UDPReaders is how many sockets read a UDP listening point, where the
	// kernel can balance them (Linux); UDPWorkers how many goroutines parse, and
	// UDPQueue how many datagrams each holds waiting.
	UDPReaders, UDPWorkers, UDPQueue int
}

// DefaultTransactions is the default of Limits.Transactions.
const DefaultTransactions = 500_000

func (l Limits) withDefaults() Limits {
	if l.Transactions <= 0 {
		l.Transactions = DefaultTransactions
	}
	if l.UDPReaders <= 0 {
		l.UDPReaders = defaultUDPReaders()
	}
	if l.UDPWorkers <= 0 {
		l.UDPWorkers = DefaultUDPWorkers()
	}
	if l.UDPQueue <= 0 {
		l.UDPQueue = DefaultUDPQueueSize
	}
	return l
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
// natsHosts is what a log line says of a NATS URL: its host:port, or the
// hosts of a comma-separated cluster list. Whatever comes before the @ (a
// user:pass, or a bare token, which NATS also takes there) stays out, and no
// parse is needed, so a URL Go can't parse leaks nothing either.
func natsHosts(raw string) string {
	hosts := make([]string, 0, 1)
	for _, u := range strings.Split(raw, ",") {
		u = strings.TrimSpace(u)
		if i := strings.Index(u, "://"); i >= 0 {
			u = u[i+3:]
		}
		if at := strings.LastIndex(u, "@"); at >= 0 {
			u = u[at+1:]
		}
		hosts = append(hosts, u)
	}
	return strings.Join(hosts, ",")
}

// listOf is list, or an empty one for nil: the lists go into every message
// request as they are.
func listOf(list []string) []string {
	if list == nil {
		return []string{}
	}
	return list
}

func localnetsFromInterfaces(log *slog.Logger, ignoreLoopback bool) []string {
	var nets []string
	ifaces, err := net.Interfaces()
	if err != nil {
		log.Error("error getting network interfaces", "error", err)
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
	if opts.Processor == nil {
		return nil, fmt.Errorf("a processor client is required")
	}
	spec := cfg.Spec
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}

	ref := cfg.Ref
	externalAddrs := listOf(spec.ExternalAddrs)
	localnets := listOf(spec.Localnets)
	if len(localnets) == 0 {
		localnets = localnetsFromInterfaces(log, spec.IgnoreLoopbackFromLocalnets)
	}
	aliases := listOf(spec.Aliases)

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

	log.Info(fmt.Sprintf("starting edgeport ref = %s version = %s at %s", ref, opts.Version, spec.BindAddr))
	log.Info(fmt.Sprintf("localnets list [%s]", strings.Join(localnets, ",")))
	log.Info(fmt.Sprintf("external hosts list [%s]", strings.Join(externalAddrs, ",")))
	log.Info(fmt.Sprintf("aliases list [%s]", strings.Join(aliases, ",")))

	var publishers []Publisher
	if events := spec.Events; events != nil {
		if events.Console {
			publishers = append(publishers, NewConsolePublisher(log))
			log.Info("console publisher enabled")
		}
		if nats := events.NATS; nats != nil {
			p, err := NewNATSPublisher(nats.URL, nats.Subject, log)
			if err != nil {
				// The error may quote the URL, credentials included
				return nil, fmt.Errorf("unable to connect to nats at %s: %s", natsHosts(nats.URL), strings.ReplaceAll(err.Error(), nats.URL, natsHosts(nats.URL)))
			}
			publishers = append(publishers, p)
			log.Info(fmt.Sprintf("nats publisher enabled with subject %s at %s", nats.Subject, natsHosts(nats.URL)))
		}
	}

	limits := opts.Limits.withDefaults()
	e := &EdgePort{
		cfg:                     cfg,
		stripSessionProgressSdp: spec.StripSessionProgressSdp,
		sipTrace:                spec.SipTrace,
		methods:                 methodSet(spec.Methods),
		respondUnknown:          spec.UnknownMethodAction == "Respond",
		log:                     log,
		conv: &sipconv.Converter{
			EdgePortRef:     ref,
			EdgePortVersion: opts.Version,
			ListeningPoints: lps,
			ExternalAddrs:   externalAddrs,
			Localnets:       localnets,
			Aliases:         aliases,
			BindAddr:        spec.BindAddr,
		},
		client:   opts.Processor,
		txm:      NewBoundedTransactionManager(limits.Dialogs, limits.DialogIdle),
		events:   NewEventProcessor(publishers),
		queue:    NewBoundedCallQueue(log, limits.CallQueued, limits.Queued),
		ports:    ports,
		resolver: net.DefaultResolver,

		udpReadBuffer: udpReadBufferOf(opts),
		limits:        limits,

		tel:          newSIPTelemetry(log),
		internalNets: parseInternalNets(localnets),
	}
	return e, nil
}

// sipGlobals guards sipgo's package-level settings (the UDP sizes, its
// default logger and SIP tracing): set once per process, by the first
// EdgePort to start, so a second one (RoutrOne's tests run several) never
// rewrites what the first is reading. They are the one global the EdgePort
// keeps, because sipgo has no per-instance home for them.
var sipGlobals sync.Once

// InitSIPGlobals sets sipgo's package-level settings, if nothing did yet.
// Start calls it; a process that starts another SIP stack next to the EdgePort
// (RoutrOne's Requester) calls it first, so the writes come before any read.
func InitSIPGlobals(log *slog.Logger, sipTrace bool) {
	sipGlobals.Do(func() {
		// JAIN-SIP sends any size over UDP; sipgo refuses past 1300 bytes by default
		sip.UDPMTUSize = 65535
		sip.TransportBufferReadSize = 65535
		sipLog := log
		if !sipTrace {
			sipLog = log.WithGroup("sipgo")
		}
		sip.SetDefaultLogger(sipLog)
		if sipTrace {
			sip.SIPDebug = true
		}
	})
}

// streamTransports are sipgo's four stream transports with a write timeout;
// sipgo has none unless told. It keeps its own default for the rest.
func streamTransports() sip.TransportsConfig {
	return sip.TransportsConfig{
		TCP: &sip.TransportTCP{WriteTimeout: streamWriteTimeout},
		TLS: &sip.TransportTLS{TransportTCP: &sip.TransportTCP{WriteTimeout: streamWriteTimeout}},
		WS:  &sip.TransportWS{WriteTimeout: streamWriteTimeout},
		WSS: &sip.TransportWSS{TransportWS: &sip.TransportWS{WriteTimeout: streamWriteTimeout}},
	}
}

// Start binds the listening points and serves them until ctx is done.
func (e *EdgePort) Start(ctx context.Context) error {
	InitSIPGlobals(e.log, e.sipTrace)
	sipLog := e.log
	if !e.sipTrace {
		sipLog = e.log.WithGroup("sipgo")
	}

	serverTLS, clientTLS, err := TLSConfigs(e.cfg.Spec.SecurityContext)
	if err != nil {
		return err
	}

	parser := sipconv.NewParser()
	e.tpl = sip.NewTransportLayer(e.resolver, parser, clientTLS,
		sip.WithTransportLayerLogger(sipLog),
		sip.WithTransportLayerTransports(streamTransports()))
	e.txl = newTxLayer(e.tpl, sipLog, e.limits.Transactions, txHooks{
		request:        e.onRequest,
		serverCancel:   e.onServerCancel,
		serverAck:      e.onServerAck,
		serverEnd:      e.onServerEnd,
		clientEnd:      e.onClientEnd,
		clientResponse: e.onClientResponse,
		clientCancel:   e.onClientCancel,
		clientTimerC:   e.onClientTimerC,
		stray:          e.onStrayResponse,
		overflow:       e.overflowed,
		noConn:         e.sendStatelessResponse,
	})
	e.txl.start()
	// A bind that fails leaves nothing running
	bound := false
	defer func() {
		if !bound {
			e.Close()
		}
	}()
	// What arrives on a connection (TCP, TLS, WS, WSS) or on a socket sipgo opened
	// comes through here, on that connection's reader
	e.tpl.OnMessage(e.inbound)

	// A failed Serve and a failed read both end up here; one is enough
	errs := make(chan error, len(e.cfg.Spec.Transport)+1)
	fail := func(err error) {
		select {
		case errs <- err:
		default:
		}
	}
	e.ingress = newUDPIngress(e.log, parser, e.limits.UDPWorkers, e.limits.UDPQueue, e.inbound,
		func() { e.overflowed(overflowUDPQueue) }, fail)
	for _, t := range e.cfg.Spec.Transport {
		addr := net.JoinHostPort(t.BindAddr, strconv.Itoa(t.Port))
		switch t.Protocol {
		case "udp":
			socks, err := listenUDPSockets(addr, e.limits.UDPReaders)
			if err != nil {
				return fmt.Errorf("unable to bind udp://%s", addr)
			}
			// The first socket is the one everything leaves on, any of the group has
			// the same source address. In sipgo's pool, it is what client
			// transactions find by the request's Laddr; sipgo doesn't read it
			local := socks[0].LocalAddr().String()
			host, port, _ := net.SplitHostPort(local)
			p, _ := strconv.Atoi(port)
			e.udpAddr = &sip.Addr{IP: net.ParseIP(host), Port: p}
			sender := &sip.UDPConnection{PacketConn: socks[0], PacketAddr: local, Listener: true}
			e.tpl.Pool("udp").Add(local, sender)
			e.txl.udp.Store(sender)
			for _, sock := range socks {
				// The kernel's default buffer overflows in short bursts under load
				// (ROUTR3.md section 1); the kernel caps the request at its
				// maximum silently, so log what it granted
				e.sizeUDPBuffer(sock, addr)
				e.listeners = append(e.listeners, sock.Close)
				e.ingress.read(sock)
			}
		case "tcp", "ws":
			l, err := net.Listen("tcp4", addr)
			if err != nil {
				return fmt.Errorf("unable to bind %s://%s", t.Protocol, addr)
			}
			if t.Protocol == "tcp" {
				go func() { fail(e.tpl.ServeTCP(l)) }()
			} else {
				go func() { fail(e.tpl.ServeWS(l)) }()
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
				go func() { fail(e.tpl.ServeTLS(l)) }()
			} else {
				go func() { fail(e.tpl.ServeWSS(l)) }()
			}
			e.listeners = append(e.listeners, l.Close)
		default:
			return fmt.Errorf("unsupported transport %q", t.Protocol)
		}
		e.log.Info(fmt.Sprintf("listening on %s://%s", t.Protocol, addr))
	}

	bound = true
	select {
	case <-ctx.Done():
		e.Close()
		return nil
	case err := <-errs:
		e.Close()
		return err
	}
}

// Close stops the listening points, the readers, the transactions and the
// processor connection. A second call does nothing. No stalled peer holds it up
// past closeWait: what is left by then finishes on its own, on a write timeout.
func (e *EdgePort) Close() {
	e.closeOnce.Do(func() {
		for _, closeFn := range e.listeners {
			_ = closeFn()
		}
		done := make(chan struct{})
		go func() {
			defer close(done)
			if e.ingress != nil {
				e.ingress.wait()
			}
			if e.txl != nil {
				e.txl.Close()
			}
			if e.tpl != nil {
				_ = e.tpl.Close()
			}
		}()
		timeout := time.NewTimer(closeWait)
		defer timeout.Stop()
		select {
		case <-done:
		case <-timeout.C:
			e.log.Warn("closing the edgeport: stopped waiting for its connections")
		}
	})
}

// sizeUDPBuffer asks for the UDP read buffer on one socket and logs the answer.
func (e *EdgePort) sizeUDPBuffer(sock *net.UDPConn, addr string) {
	granted, err := setUDPReadBuffer(sock, e.udpReadBuffer)
	switch {
	case err != nil:
		e.log.Warn("unable to size the udp read buffer", "addr", addr, "error", err)
	case granted == 0:
		e.log.Info("udp read buffer sized", "addr", addr, "requested", e.udpReadBuffer, "granted", "unknown")
	default:
		e.log.Info("udp read buffer sized", "addr", addr, "requested", e.udpReadBuffer, "granted", granted)
		if granted < e.udpReadBuffer {
			e.log.Warn("the kernel granted less than the udp read buffer asked for: raise its maximum (net.core.rmem_max on Linux, kern.ipc.maxsockbuf on macOS)",
				"addr", addr, "requested", e.udpReadBuffer, "granted", granted)
		}
	}
}

// inbound takes every message read: on a parsing worker for a UDP listening
// point, on the reader for anything else. It marks the top Via, as JAIN-SIP's
// message channels do, before the transaction layer sees the message.
func (e *EdgePort) inbound(msg sip.Message) {
	markReceived(msg)
	e.txl.handle(msg)
}

// markReceived adds received and rport to the top Via of a request, as
// JAIN-SIP's message channels do before the listener sees it: received when
// the sender asked for rport or its sent-by host is not the packet's source,
// and rport (the source port) when it asked for it. Over a connection
// (TCP, TLS, WS, WSS) JAIN-SIP sets rport whether or not it was asked for.
// Whatever the sender wrote in received and in rport's value is dropped
// first: those parameters are this EdgePort's word on where the packet came
// from, and a forged received could name a trusted peer's address.
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
	hasRport := via.Params.Has("rport")
	via.Params.Remove("received")
	via.Params.Remove("rport")
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

func (e *EdgePort) process(ctx context.Context, req *ppb.MessageRequest) (*ppb.MessageResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, processorTimeout)
	defer cancel()
	// WaitForReady: the connection is dialed on the first call, and a dial
	// that fails (a Dispatcher still coming up) puts it in backoff for a
	// second, where a fail-fast call is refused at once. Every call waits
	// for the connection instead, within processorTimeout (#572).
	return e.client.ProcessMessage(ctx, req, grpc.WaitForReady(true))
}

// enqueue queues work for a call and counts a queue that refused it.
func (e *EdgePort) enqueue(callID string, fn func()) bool {
	if e.queue.Run(callID, fn) {
		return true
	}
	e.overflowed(overflowCallQueue)
	return false
}

// onServerEnd releases a server transaction's bookkeeping in call order, after
// the work already queued for the call: over a connection a transaction ends as
// soon as its final response is passed up.
func (e *EdgePort) onServerEnd(tx *ServerTx) {
	callID := callIDOf(tx.origin)
	e.queue.RunAlways(callID, func() {
		e.txm.RemoveServerTransaction(callID, tx)
		tx.released.Store(true)
		if tx.span != nil {
			tx.span.End()
		}
	})
}

// onServerAck hands processRequest an ACK that matches an INVITE server
// transaction in Accepted. An ACK that reuses its INVITE's branch (SIPp does, for
// the ACK to a 2xx) lands on the INVITE's transaction (RFC 6026 "Accepted"); JAIN
// SIP gives such an ACK to the listener, so it is forwarded like any 2xx ACK. The
// ACK to a failure response never gets here: it stays with the transaction, as in
// JAIN SIP.
func (e *EdgePort) onServerAck(tx *ServerTx, ack *sip.Request) {
	e.enqueue(callIDOf(tx.origin), func() { e.processRequest(ack, nil) })
}

// onServerCancel is a CANCEL that matched an INVITE this EdgePort holds.
// Remembered at once: a challenge to the INVITE can still arrive. It can't be
// refused: the caller has its 200 and its 487, and only this ends the leg
// downstream.
func (e *EdgePort) onServerCancel(tx *ServerTx, cancel *sip.Request) {
	callID := callIDOf(tx.origin)
	e.txm.MarkCancelled(callID)
	e.queue.RunAlways(callID, func() { e.processCancel(cancel, tx) })
}

// onClientCancel sends a held CANCEL, in call order after the 1xx that freed it.
func (e *EdgePort) onClientCancel(tx *ClientTx, cancel *sip.Request) {
	e.queue.RunAlways(tx.info.callID, func() { e.startCancel(tx, cancel) })
}

// onClientTimerC is Timer C on an INVITE in Proceeding (RFC 3261 section
// 16.8): in call order, a CANCEL goes downstream on the INVITE's connection,
// as a caller's would, and the caller gets a 408. The call is marked cancelled
// first, so a 2xx that crosses the CANCEL is acked and ended as after a
// caller's CANCEL, and a challenge to the INVITE isn't answered.
func (e *EdgePort) onClientTimerC(tx *ClientTx) {
	info := &tx.info
	e.txm.MarkCancelled(info.callID)
	e.queue.RunAlways(info.callID, func() {
		e.forwardCancel(tx)
		if server := info.server; server != nil && !info.replaced.Load() && server.awaitingFinal() {
			e.answerFailure(server, server.Origin(), sip.StatusRequestTimeout)
		}
	})
}

func (e *EdgePort) finalSent(tx *ServerTx) bool {
	// Released means the transaction is over
	return tx.released.Load() || tx.final.Load()
}

// abandon releases a server transaction that will get no final response. The
// Java EdgePort never answers such a request either; this only frees the
// transaction once the caller can no longer be waiting for it.
func (e *EdgePort) abandon(tx *ServerTx) {
	if tx != nil {
		tx.abandon(abandonAfter)
	}
}

// onClientResponse passes a client transaction's responses, retransmitted 2xx
// included, to processResponse in call order. A queue that refused one loses it:
// the far end retransmits a 2xx and the transaction's timer covers the rest.
func (e *EdgePort) onClientResponse(tx *ClientTx, res *sip.Response) {
	e.enqueue(callIDOf(res), func() { e.processResponse(res, tx) })
}

// onClientEnd counts how a client transaction ended and, in call order, after
// the responses it queued, releases it: over a connection the transaction ends
// (Timer D is 0) as soon as its final response is passed up, before
// processResponse looks at it.
func (e *EdgePort) onClientEnd(tx *ClientTx) {
	info := &tx.info
	e.clientEnded(tx, info.server)
	e.queue.RunAlways(info.callID, func() {
		e.txm.RemoveClientTransaction(info.callID, tx)
		tx.released.Store(true)
		if info.server != nil && !info.replaced.Load() && !e.answerDeadHop(tx, info.server) {
			e.abandon(info.server)
		}
	})
}

// deadHopCode is the final response a client transaction's failure asks for, or
// 0 for none. An INVITE that timed out is a 408 and a transport failure a 503
// (RFC 3261 sections 16.7 and 16.9). A non-INVITE that timed out gets nothing: it
// must not be a 408, and by then the caller's own timer is out too (RFC 4320
// section 4.2).
func deadHopCode(invite bool, err error) int {
	switch {
	case errors.Is(err, sip.ErrTransactionTimeout):
		if invite {
			return sip.StatusRequestTimeout
		}
	case errors.Is(err, sip.ErrTransactionTransport):
		return sip.StatusServiceUnavailable
	}
	return 0
}

// answerDeadHop answers a server transaction whose next hop failed, if it still
// takes an answer, and says whether it did. Runs in call order, after the
// responses the client transaction queued.
func (e *EdgePort) answerDeadHop(tx *ClientTx, server *ServerTx) bool {
	code := deadHopCode(tx.invite, tx.Err())
	if code == 0 || !server.awaitingFinal() {
		return false
	}
	req := server.Origin()
	e.answerFailure(server, req, code)
	if tx.invite && !hasToTag(req) {
		e.txm.RemoveDialog(tx.info.callID)
	}
	return true
}

// answerFailure answers with a failure the EdgePort itself decided on, with the
// To tag of RFC 3261 section 8.2.6.2.
func (e *EdgePort) answerFailure(tx *ServerTx, req *sip.Request, code int) {
	if tx == nil {
		return
	}
	res := NewResponse(req, code, ReasonPhrase(code))
	if to := res.To(); to != nil && !hasToTag(req) {
		if to.Params == nil {
			to.Params = sip.NewParams()
		}
		to.Params.Add("tag", newTag())
	}
	if err := e.respond(tx, res); err != nil {
		e.log.Debug("an exception occurred while answering", "code", code, "callId", callIDOf(req), "error", err)
	}
}

func (e *EdgePort) clientInfo(tx *ClientTx) *clientInfo {
	if tx == nil || tx.released.Load() {
		return nil
	}
	return &tx.info
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
func (e *EdgePort) respond(tx *ServerTx, res *sip.Response) error {
	if hop, ok := ResponseHop(res); ok {
		if ip, err := e.resolve(hop.Host); err == nil {
			res.SetDestination(net.JoinHostPort(ip.String(), strconv.Itoa(hop.Port)))
		}
	}
	if res.StatusCode >= 200 {
		tx.final.Store(true)
	}
	err := tx.Respond(res)
	e.responseSent(tx, res, err)
	return err
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

// newClientTransaction sends a request on a new client transaction, which
// forwards for server (nil for one the EdgePort starts on its own, a CANCEL).
func (e *EdgePort) newClientTransaction(req *sip.Request, callID string, server *ServerTx, creds *Credentials) (*ClientTx, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return e.txl.request(ctx, req, callID, server, creds)
}

// transportName returns the enum name of a message's transport.
func transportName(t common.Transport) string {
	return t.String()
}

// methodSet is the set of a method list, upper-cased; nil for an empty list.
func methodSet(methods []string) map[string]bool {
	if len(methods) == 0 {
		return nil
	}
	set := make(map[string]bool, len(methods))
	for _, m := range methods {
		set[strings.ToUpper(m)] = true
	}
	return set
}
