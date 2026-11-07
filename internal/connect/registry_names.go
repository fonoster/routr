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

package connect

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"regexp"
	"slices"
	"sync/atomic"
	"time"
)

const (
	// registryRefreshInterval is how often the names of
	// trustedRegistryAddresses are resolved again.
	registryRefreshInterval = 10 * time.Second
	// registryLookupTimeout bounds the lookup of one name.
	registryLookupTimeout = 5 * time.Second
	// registryLastGoodFor is how long a name that stops resolving keeps its
	// last addresses, so one DNS hiccup doesn't cost a Trunk its REGISTER. After
	// that it trusts nothing.
	registryLastGoodFor = 30 * time.Second
)

// dnsName is what an entry of trustedRegistryAddresses must look like when it
// is no IP or CIDR. It's the shape of a name, nothing about what it resolves to.
var dnsName = regexp.MustCompile(`^[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?)*\.?$`)

// LookupHost resolves a name to its addresses, as net.Resolver.LookupHost does.
type LookupHost func(ctx context.Context, host string) ([]string, error)

// splitRegistryAddresses separates the IPs and CIDRs of trustedRegistryAddresses,
// which are checked as they are, from the DNS names, which need a refresher.
func splitRegistryAddresses(entries []string) (networks, names []string, err error) {
	for _, entry := range entries {
		switch {
		case isNetwork(entry):
			networks = append(networks, entry)
		case dnsName.MatchString(entry) && net.ParseIP(entry) == nil:
			names = append(names, entry)
		default:
			return nil, nil, fmt.Errorf("connect: trustedRegistryAddresses: %q is not an IP, a CIDR or a DNS name", entry)
		}
	}
	return networks, names, nil
}

func isNetwork(entry string) bool {
	_, ok := parseNet(entry)
	return ok
}

// resolvedName is what the refresher last learned about one name.
type resolvedName struct {
	addrs []netip.Addr
	// at is when the name last resolved
	at time.Time
	// failing marks a name whose failure was already logged
	failing bool
}

// registryNames holds the addresses the DNS names of trustedRegistryAddresses
// resolve to. In a cluster the Requester's pods have no static IP, and a name
// covers exactly them where a CIDR would also cover whoever gets SNATed into it.
//
// The message path only reads a map through an atomic pointer; lookups happen
// on the refresher's goroutine, which Connect.Run owns. It fails closed: before
// the first lookup, and once a name has been failing for longer than
// registryLastGoodFor, the name trusts nothing.
type registryNames struct {
	names  []string
	lookup LookupHost
	now    func() time.Time
	log    *slog.Logger

	// addrs is the union of what every name holds, replaced as a whole
	addrs atomic.Pointer[map[netip.Addr]struct{}]
	// state belongs to the refresher's goroutine
	state map[string]*resolvedName
}

func newRegistryNames(names []string, lookup LookupHost, now func() time.Time, log *slog.Logger) *registryNames {
	if lookup == nil {
		lookup = net.DefaultResolver.LookupHost
	}
	return &registryNames{names: names, lookup: lookup, now: now, log: log, state: make(map[string]*resolvedName, len(names))}
}

// contains tells whether addr is one a name resolved to. A nil registryNames,
// no names at all, holds nothing.
func (r *registryNames) contains(addr string) bool {
	if r == nil {
		return false
	}
	current := r.addrs.Load()
	if current == nil {
		return false
	}
	parsed, err := netip.ParseAddr(addr)
	if err != nil {
		return false
	}
	_, ok := (*current)[parsed.Unmap()]
	return ok
}

// run resolves the names now and every interval until ctx ends.
func (r *registryNames) run(ctx context.Context, interval time.Duration) {
	r.refresh(ctx)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.refresh(ctx)
		}
	}
}

// refresh resolves every name once and publishes the new set.
func (r *registryNames) refresh(ctx context.Context) {
	for _, name := range r.names {
		if ctx.Err() != nil {
			return
		}
		r.refreshName(ctx, name)
	}
	union := map[netip.Addr]struct{}{}
	for _, name := range r.state {
		for _, addr := range name.addrs {
			union[addr] = struct{}{}
		}
	}
	r.addrs.Store(&union)
}

// refreshName resolves one name. A failure, or an answer with no address, keeps
// what the name had until registryLastGoodFor passes since it last resolved.
func (r *registryNames) refreshName(ctx context.Context, name string) {
	lookupCtx, cancel := context.WithTimeout(ctx, registryLookupTimeout)
	defer cancel()
	found, err := r.lookup(lookupCtx, name)
	addrs := parseAddrs(found)

	state := r.state[name]
	if err == nil && len(addrs) > 0 {
		if state == nil || state.failing || !slices.Equal(state.addrs, addrs) {
			r.log.Info("trustedRegistryAddresses: a name resolved", "name", name, "addresses", len(addrs))
		}
		r.state[name] = &resolvedName{addrs: addrs, at: r.now()}
		return
	}
	if ctx.Err() != nil {
		// Stopping, not a DNS failure
		return
	}
	if state == nil {
		state = &resolvedName{}
		r.state[name] = state
	}
	if !state.failing {
		state.failing = true
		r.log.Warn("trustedRegistryAddresses: a name does not resolve; it trusts nothing once its last addresses expire", "name", name, "error", err)
	}
	if len(state.addrs) > 0 && r.now().Sub(state.at) >= registryLastGoodFor {
		state.addrs = nil
		r.log.Warn("trustedRegistryAddresses: a name's last addresses expired; it trusts nothing until it resolves", "name", name)
	}
}

// parseAddrs keeps what parses as an IP, sorted so two answers compare equal
// whatever order DNS gave them in.
func parseAddrs(found []string) []netip.Addr {
	addrs := make([]netip.Addr, 0, len(found))
	for _, value := range found {
		if addr, err := netip.ParseAddr(value); err == nil {
			addrs = append(addrs, addr.Unmap())
		}
	}
	slices.SortFunc(addrs, netip.Addr.Compare)
	return addrs
}
