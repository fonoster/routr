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
	"container/list"
	"context"
	"log/slog"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/sipconv"
)

// The self-Route check's bounds: fixed, as in Routr 2 (#709).
const (
	selfRoutesMaxLookups = 4
	selfRoutesWait       = 200 * time.Millisecond
	selfRoutesFresh      = 30 * time.Second
	selfRoutesExpire     = 60 * time.Second
	selfRoutesNegative   = 10 * time.Second
	selfRoutesMaxEntries = 1024
	// A lookup no request waits for any more still ends: its slot is free by then
	selfRoutesLookupTimeout = 5 * time.Second
)

// lookupFunc resolves a name; production passes net.Resolver.LookupIPAddr.
type lookupFunc func(ctx context.Context, host string) ([]net.IPAddr, error)

// selfRouteEntry is a cached answer; addrs is nil for a failed lookup.
type selfRouteEntry struct {
	name       string
	addrs      []string
	resolvedAt time.Time
}

// selfRouteFlight is a lookup in flight, shared by every request that needs
// the same name.
type selfRouteFlight struct {
	done  chan struct{}
	entry *selfRouteEntry
}

// selfRoutes removes the Route entries that name this EdgePort by a hostname
// that resolves to one of its own addresses (an interface address or an
// external address), on the port of the listening point for the entry's
// transport. Only entries the incoming request carried are considered; a Route
// the processor added is never removed. It is GRPCSipListener's SelfRoutes.
//
// A lookup starts only for a new INVITE (no To tag) and its first candidate
// name, at most selfRoutesMaxLookups at once, and is waited for at most
// selfRoutesWait. Every other request uses the cache only. A name not known to
// be this EdgePort is kept, as before.
type selfRoutes struct {
	own    map[string]struct{}
	ports  map[string]int
	lookup lookupFunc
	now    func() time.Time
	slots  chan struct{}

	ctx    context.Context
	cancel context.CancelFunc

	mu       sync.Mutex
	cache    map[string]*list.Element
	lru      *list.List
	inflight map[string]*selfRouteFlight
}

func newSelfRoutes(ownAddrs, externalAddrs []string, ports map[string]int, lookup lookupFunc,
	now func() time.Time) *selfRoutes {
	own := map[string]struct{}{}
	for _, a := range ownAddrs {
		own[normalizeHost(a)] = struct{}{}
	}
	for _, a := range externalAddrs {
		own[normalizeHost(a)] = struct{}{}
	}
	listening := make(map[string]int, len(ports))
	for t, p := range ports {
		listening[strings.ToUpper(t)] = p
	}
	ctx, cancel := context.WithCancel(context.Background())
	return &selfRoutes{
		own:      own,
		ports:    listening,
		lookup:   lookup,
		now:      now,
		slots:    make(chan struct{}, selfRoutesMaxLookups),
		ctx:      ctx,
		cancel:   cancel,
		cache:    map[string]*list.Element{},
		lru:      list.New(),
		inflight: map[string]*selfRouteFlight{},
	}
}

// close stops the lookups in flight.
func (s *selfRoutes) close() { s.cancel() }

// interfaceAddresses is every address of every network interface, IPv4 and
// IPv6, loopback included.
func interfaceAddresses(log *slog.Logger) []string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		log.Error("error getting network interfaces", "error", err)
		return nil
	}
	var out []string
	seen := map[string]bool{}
	for _, a := range addrs {
		var ip net.IP
		switch v := a.(type) {
		case *net.IPNet:
			ip = v.IP
		case *net.IPAddr:
			ip = v.IP
		default:
			continue
		}
		host := normalizeHost(ip.String())
		if !seen[host] {
			seen[host] = true
			out = append(out, host)
		}
	}
	return out
}

// removeOwnRoutes removes from out the Route entries that in also carried and
// that name this EdgePort.
func (s *selfRoutes) removeOwnRoutes(in, out *sip.Request) {
	carried := map[string]bool{}
	for _, uri := range addressURIs(in.GetHeaders("Route")) {
		carried[routeKey(uri)] = true
	}
	if len(carried) == 0 {
		return
	}

	mayLookup := out.Method == sip.INVITE && !hasToTag(out)
	headers := out.GetHeaders("Route")
	var kept []string
	removed := false
	for _, h := range headers {
		for _, part := range sipconv.SplitTopLevel(h.Value(), ',') {
			part = strings.TrimSpace(part)
			var uri sip.Uri
			var params sip.HeaderParams
			if _, err := sip.ParseAddressValue(part, &uri, &params); err != nil ||
				!carried[routeKey(uri)] || !s.onListeningPort(uri) {
				kept = append(kept, part)
				continue
			}
			host := normalizeHost(uri.Host)
			own := false
			if _, ok := s.own[host]; ok {
				own = true
			} else if !isIPLiteral(host) {
				own = s.isOwnName(host, mayLookup)
				// Only the first candidate name may start a lookup
				mayLookup = false
			}
			if own {
				removed = true
			} else {
				kept = append(kept, part)
			}
		}
	}
	if removed {
		replaceRoutes(out, headers, kept)
	}
}

// replaceRoutes puts the kept entries, one Route header each and in their
// order, where the first Route was.
func replaceRoutes(out *sip.Request, headers []sip.Header, kept []string) {
	var before sip.Header
	for _, h := range out.Headers() {
		if h == headers[0] {
			break
		}
		before = h
	}
	for _, h := range headers {
		out.RemoveHeader(h.Name())
	}
	for i, entry := range kept {
		route := sip.NewHeader("Route", entry)
		switch {
		case i > 0:
			out.AppendHeaderAfter(route, "Route")
		case before == nil:
			out.PrependHeader(route)
		default:
			out.AppendHeaderAfter(route, before.Name())
		}
	}
}

func (s *selfRoutes) isOwnName(name string, mayLookup bool) bool {
	now := s.now()
	s.mu.Lock()
	entry := s.cached(name, now)
	var flight *selfRouteFlight
	switch {
	case entry != nil:
		if mayLookup && entry.addrs != nil && now.Sub(entry.resolvedAt) >= selfRoutesFresh {
			s.startLookupLocked(name)
		}
	case mayLookup:
		flight = s.startLookupLocked(name)
	}
	s.mu.Unlock()

	if entry != nil {
		return s.isOwn(entry)
	}
	if flight == nil {
		return false
	}
	timer := time.NewTimer(selfRoutesWait)
	defer timer.Stop()
	select {
	case <-flight.done:
		return s.isOwn(flight.entry)
	case <-timer.C:
		return false
	}
}

// cached is the entry for name, dropped when it has expired. Callers hold mu.
func (s *selfRoutes) cached(name string, now time.Time) *selfRouteEntry {
	el, ok := s.cache[name]
	if !ok {
		return nil
	}
	entry := el.Value.(*selfRouteEntry)
	ttl := selfRoutesExpire
	if entry.addrs == nil {
		ttl = selfRoutesNegative
	}
	if now.Sub(entry.resolvedAt) >= ttl {
		s.lru.Remove(el)
		delete(s.cache, name)
		return nil
	}
	s.lru.MoveToFront(el)
	return entry
}

func (s *selfRoutes) isOwn(entry *selfRouteEntry) bool {
	for _, a := range entry.addrs {
		if _, ok := s.own[a]; ok {
			return true
		}
	}
	return false
}

// startLookup starts a lookup, or joins the one in flight; nil when every slot
// is taken.
func (s *selfRoutes) startLookup(name string) *selfRouteFlight {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.startLookupLocked(name)
}

func (s *selfRoutes) startLookupLocked(name string) *selfRouteFlight {
	if f, ok := s.inflight[name]; ok {
		return f
	}
	select {
	case s.slots <- struct{}{}:
	default:
		return nil
	}
	f := &selfRouteFlight{done: make(chan struct{})}
	s.inflight[name] = f
	go s.resolve(name, f)
	return f
}

// resolve runs one lookup and caches its answer. It keeps its slot until the
// lookup returns, whether or not a request still waits for it.
func (s *selfRoutes) resolve(name string, f *selfRouteFlight) {
	defer func() { <-s.slots }()
	ctx, cancel := context.WithTimeout(s.ctx, selfRoutesLookupTimeout)
	ips, err := s.lookup(ctx, name)
	cancel()

	entry := &selfRouteEntry{name: name, resolvedAt: s.now()}
	if err == nil {
		entry.addrs = []string{}
		for _, ip := range ips {
			entry.addrs = append(entry.addrs, normalizeHost(ip.IP.String()))
		}
	}

	s.mu.Lock()
	el, ok := s.cache[name]
	switch {
	case !ok:
		s.cache[name] = s.lru.PushFront(entry)
		if s.lru.Len() > selfRoutesMaxEntries {
			oldest := s.lru.Back()
			s.lru.Remove(oldest)
			delete(s.cache, oldest.Value.(*selfRouteEntry).name)
		}
	case entry.addrs != nil || el.Value.(*selfRouteEntry).addrs == nil:
		el.Value = entry
		s.lru.MoveToFront(el)
	}
	// A failed refresh leaves a positive answer in place until it expires
	delete(s.inflight, name)
	f.entry = entry
	s.mu.Unlock()
	close(f.done)
}

// awaitLookups waits for the lookups in flight to finish (tests).
func (s *selfRoutes) awaitLookups() {
	s.mu.Lock()
	var flights []*selfRouteFlight
	for _, f := range s.inflight {
		flights = append(flights, f)
	}
	s.mu.Unlock()
	for _, f := range flights {
		<-f.done
	}
}

// size is the number of cached names (tests).
func (s *selfRoutes) size() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lru.Len()
}

func (s *selfRoutes) onListeningPort(uri sip.Uri) bool {
	port, ok := s.ports[routeTransport(uri)]
	return ok && port == uri.Port
}

// routeKey is how a Route entry of the outgoing request is matched to one the
// incoming request carried: host (case-insensitive), port and transport.
func routeKey(uri sip.Uri) string {
	return strings.ToLower(uri.Host) + "|" + strconv.Itoa(uri.Port) + "|" + routeTransport(uri)
}

func routeTransport(uri sip.Uri) string {
	if t, ok := uri.UriParams.Get("transport"); ok && t != "" {
		return strings.ToUpper(t)
	}
	return "UDP"
}

func isIPLiteral(host string) bool {
	_, err := netip.ParseAddr(host)
	return err == nil
}

// normalizeHost is an IP literal in its canonical form (no brackets, no zone,
// IPv4 not mapped into IPv6), or a name in lower case.
func normalizeHost(host string) string {
	h := strings.TrimSuffix(strings.TrimPrefix(host, "["), "]")
	if addr, err := netip.ParseAddr(h); err == nil {
		return addr.WithZone("").Unmap().String()
	}
	return strings.ToLower(h)
}
