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
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/sipconv"
)

var (
	selfRoutesOwn   = []string{"10.216.30.43", "10.216.30.44", "127.0.0.1"}
	selfRoutesPorts = map[string]int{"UDP": 5060, "TCP": 5060, "TLS": 5061}
)

// fakeDNS is the injected resolver and clock: names map to addresses, every
// call is counted, and a name in block waits for its channel to close.
type fakeDNS struct {
	mu      sync.Mutex
	answers map[string][]string
	block   map[string]chan struct{}
	lookups atomic.Int32
	started chan string
	now     time.Time
}

func newFakeDNS() *fakeDNS {
	return &fakeDNS{
		answers: map[string][]string{},
		block:   map[string]chan struct{}{},
		started: make(chan string, 64),
		now:     time.Unix(1_000_000, 0),
	}
}

func (d *fakeDNS) set(name string, addrs ...string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if addrs == nil {
		delete(d.answers, name)
		return
	}
	d.answers[name] = addrs
}

func (d *fakeDNS) hold(name string) chan struct{} {
	d.mu.Lock()
	defer d.mu.Unlock()
	release := make(chan struct{})
	d.block[name] = release
	return release
}

func (d *fakeDNS) lookup(ctx context.Context, host string) ([]net.IPAddr, error) {
	d.lookups.Add(1)
	d.started <- host
	d.mu.Lock()
	release := d.block[host]
	d.mu.Unlock()
	if release != nil {
		<-release
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	answer, ok := d.answers[host]
	if !ok {
		return nil, &net.DNSError{Err: "no such host", Name: host, IsNotFound: true}
	}
	out := make([]net.IPAddr, 0, len(answer))
	for _, a := range answer {
		out = append(out, net.IPAddr{IP: net.ParseIP(a)})
	}
	return out, nil
}

func (d *fakeDNS) clock() time.Time {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.now
}

func (d *fakeDNS) advance(by time.Duration) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.now = d.now.Add(by)
}

func (d *fakeDNS) count() int { return int(d.lookups.Load()) }

func newTestSelfRoutes(t *testing.T, d *fakeDNS) *selfRoutes {
	t.Helper()
	s := newSelfRoutes(selfRoutesOwn, []string{"203.0.113.7"}, selfRoutesPorts, d.lookup, d.clock)
	t.Cleanup(s.close)
	return s
}

func selfRoutesRequest(t *testing.T, method sip.RequestMethod, toTag string, routes ...string) *sip.Request {
	t.Helper()
	var b strings.Builder
	fmt.Fprintf(&b, "%s sip:+15551230000@trunk.example.net SIP/2.0\r\n", method)
	b.WriteString("Via: SIP/2.0/UDP 10.0.0.9:5060;branch=z9hG4bK-1\r\n")
	b.WriteString("From: <sip:+15550001111@sip.local>;tag=a\r\n")
	b.WriteString("To: <sip:+15551230000@trunk.example.net>")
	if toTag != "" {
		b.WriteString(";tag=" + toTag)
	}
	b.WriteString("\r\nCall-ID: abc\r\n")
	fmt.Fprintf(&b, "CSeq: 1 %s\r\n", method)
	b.WriteString("Max-Forwards: 70\r\n")
	for _, r := range routes {
		b.WriteString("Route: " + r + "\r\n")
	}
	b.WriteString("Content-Length: 0\r\n\r\n")
	msg, err := sipconv.NewParser().ParseSIP([]byte(b.String()))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	return msg.(*sip.Request)
}

func newInvite(t *testing.T, routes ...string) *sip.Request {
	t.Helper()
	return selfRoutesRequest(t, sip.INVITE, "", routes...)
}

func routeURIs(req *sip.Request) []string {
	out := []string{}
	for _, uri := range addressURIs(req.GetHeaders("Route")) {
		out = append(out, uri.String())
	}
	return out
}

// forwardRoutes is the processor forwarding what it received, as
// BuildForwardedRequest builds it, and the Route set it leaves with.
func forwardRoutes(s *selfRoutes, in *sip.Request) []string {
	out := BuildForwardedRequest(in, in.Recipient, nil, in.CloneHeaders())
	s.removeOwnRoutes(in, out)
	return routeURIs(out)
}

func expectRoutes(t *testing.T, got []string, want ...string) {
	t.Helper()
	if want == nil {
		want = []string{}
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("routes = %q, want %q", got, want)
	}
}

func expectLookups(t *testing.T, d *fakeDNS, want int) {
	t.Helper()
	if got := d.count(); got != want {
		t.Fatalf("lookups = %d, want %d", got, want)
	}
}

func TestSelfRoutes(t *testing.T) {
	t.Run("a Route naming this EdgePort by a resolving name is removed toward the next hop", func(t *testing.T) {
		d := newFakeDNS()
		d.set("routr", "10.216.30.43")
		s := newTestSelfRoutes(t, d)
		in := newInvite(t, "<sip:routr:5060;lr>")
		out := BuildForwardedRequest(in, in.Recipient, nil, in.CloneHeaders())

		s.removeOwnRoutes(in, out)

		expectRoutes(t, routeURIs(out))
		if hop := NextHop(out); hop.Host != "trunk.example.net" || hop.Port != 5060 {
			t.Fatalf("next hop = %+v, want trunk.example.net:5060", hop)
		}
	})

	t.Run("every interface address counts, not only a localnets network address", func(t *testing.T) {
		d := newFakeDNS()
		d.set("first", "10.216.30.43")
		d.set("second", "10.216.30.44")
		d.set("external", "203.0.113.7")
		d.set("foreign", "192.0.2.9")
		s := newTestSelfRoutes(t, d)

		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:first:5060;lr>")))
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:second:5060;lr>")))
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:external:5060;lr>")))
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:foreign:5060;lr>")), "sip:foreign:5060;lr")
	})

	t.Run("another port is kept and names compare case-insensitively", func(t *testing.T) {
		d := newFakeDNS()
		d.set("routr", "10.216.30.43")
		s := newTestSelfRoutes(t, d)

		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5070;lr>")), "sip:routr:5070;lr")
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:ROUTR:5060;lr>")))
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5060;transport=tls;lr>")),
			"sip:routr:5060;transport=tls;lr")
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5061;transport=TLS;lr>")))
	})

	t.Run("a Route the processor added is kept", func(t *testing.T) {
		s := newTestSelfRoutes(t, newFakeDNS())
		in := newInvite(t)
		out := newInvite(t, "<sip:10.216.30.43:5060;lr>")

		s.removeOwnRoutes(in, out)

		expectRoutes(t, routeURIs(out), "sip:10.216.30.43:5060;lr")
	})

	t.Run("the Routes it does not own keep their order", func(t *testing.T) {
		d := newFakeDNS()
		d.set("routr", "10.216.30.43")
		s := newTestSelfRoutes(t, d)
		in := newInvite(t, "<sip:routr:5060;lr>", "<sip:proxy.example.net:5060;lr>")
		out := newInvite(t, "<sip:peer.example.net:5060;lr>", "<sip:routr:5060;lr>",
			"<sip:proxy.example.net:5060;lr>")

		s.removeOwnRoutes(in, out)

		expectRoutes(t, routeURIs(out), "sip:peer.example.net:5060;lr", "sip:proxy.example.net:5060;lr")
	})

	t.Run("only a new INVITE looks up; other requests use the cache", func(t *testing.T) {
		d := newFakeDNS()
		d.set("routr", "10.216.30.43")
		s := newTestSelfRoutes(t, d)

		expectRoutes(t, forwardRoutes(s, selfRoutesRequest(t, sip.BYE, "b", "<sip:routr:5060;lr>")), "sip:routr:5060;lr")
		expectRoutes(t, forwardRoutes(s, selfRoutesRequest(t, sip.MESSAGE, "", "<sip:routr:5060;lr>")), "sip:routr:5060;lr")
		expectRoutes(t, forwardRoutes(s, selfRoutesRequest(t, sip.INVITE, "b", "<sip:routr:5060;lr>")), "sip:routr:5060;lr")
		expectLookups(t, d, 0)

		// Once a new INVITE has cached the name, every request uses it
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5060;lr>")))
		expectRoutes(t, forwardRoutes(s, selfRoutesRequest(t, sip.BYE, "b", "<sip:routr:5060;lr>")))
		expectLookups(t, d, 1)
	})

	t.Run("only the first candidate name is looked up", func(t *testing.T) {
		d := newFakeDNS()
		d.set("first", "192.0.2.9")
		d.set("routr", "10.216.30.43")
		s := newTestSelfRoutes(t, d)

		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:first:5060;lr>", "<sip:routr:5060;lr>")),
			"sip:first:5060;lr", "sip:routr:5060;lr")
		expectLookups(t, d, 1)
	})

	t.Run("an IP literal is never resolved", func(t *testing.T) {
		d := newFakeDNS()
		s := newTestSelfRoutes(t, d)

		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:10.216.30.44:5060;lr>")))
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:203.0.113.7:5060;lr>")))
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:192.0.2.9:5060;lr>")), "sip:192.0.2.9:5060;lr")
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:[2001:db8::1]:5060;lr>")), "sip:[2001:db8::1]:5060;lr")
		expectLookups(t, d, 0)
	})

	t.Run("an answer is fresh for 30 s, then refreshed once in the background", func(t *testing.T) {
		d := newFakeDNS()
		d.set("routr", "10.216.30.43")
		s := newTestSelfRoutes(t, d)

		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5060;lr>")))
		d.advance(29 * time.Second)
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5060;lr>")))
		expectLookups(t, d, 1)

		// Stale: used at once, and one refresh starts behind it
		release := d.hold("routr")
		d.advance(2 * time.Second)
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5060;lr>")))
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5060;lr>")))
		close(release)
		s.awaitLookups()
		expectLookups(t, d, 2)

		// The refresh made the entry fresh again
		d.advance(20 * time.Second)
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5060;lr>")))
		s.awaitLookups()
		expectLookups(t, d, 2)
	})

	t.Run("an entry with no successful refresh is dropped at 60 s", func(t *testing.T) {
		d := newFakeDNS()
		d.set("routr", "10.216.30.43")
		s := newTestSelfRoutes(t, d)
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5060;lr>")))

		d.set("routr")
		d.advance(31 * time.Second)
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:routr:5060;lr>")))
		s.awaitLookups()
		expectLookups(t, d, 2)

		d.advance(30 * time.Second)
		expectRoutes(t, forwardRoutes(s, selfRoutesRequest(t, sip.BYE, "b", "<sip:routr:5060;lr>")), "sip:routr:5060;lr")
	})

	t.Run("a name that doesn't resolve is kept and its failure cached 10 s", func(t *testing.T) {
		d := newFakeDNS()
		s := newTestSelfRoutes(t, d)

		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:nowhere:5060;lr>")), "sip:nowhere:5060;lr")
		d.advance(9 * time.Second)
		expectRoutes(t, forwardRoutes(s, newInvite(t, "<sip:nowhere:5060;lr>")), "sip:nowhere:5060;lr")
		expectLookups(t, d, 1)

		d.advance(2 * time.Second)
		forwardRoutes(s, newInvite(t, "<sip:nowhere:5060;lr>"))
		expectLookups(t, d, 2)
	})

	t.Run("a lookup is waited for at most 200 ms and its late answer is cached", func(t *testing.T) {
		d := newFakeDNS()
		d.set("slow", "10.216.30.43")
		release := d.hold("slow")
		s := newTestSelfRoutes(t, d)

		start := time.Now()
		got := forwardRoutes(s, newInvite(t, "<sip:slow:5060;lr>"))
		waited := time.Since(start)

		expectRoutes(t, got, "sip:slow:5060;lr")
		if waited < 150*time.Millisecond || waited >= 400*time.Millisecond {
			t.Fatalf("waited %v, want about 200 ms", waited)
		}

		close(release)
		s.awaitLookups()
		expectRoutes(t, forwardRoutes(s, selfRoutesRequest(t, sip.BYE, "b", "<sip:slow:5060;lr>")))
		expectLookups(t, d, 1)
	})

	t.Run("no wait and no lookup when 4 lookups are in flight", func(t *testing.T) {
		d := newFakeDNS()
		s := newTestSelfRoutes(t, d)
		var releases []chan struct{}
		for i := 0; i < selfRoutesMaxLookups; i++ {
			name := fmt.Sprintf("busy%d", i)
			releases = append(releases, d.hold(name))
			if s.startLookup(name) == nil {
				t.Fatalf("lookup %d did not start", i)
			}
			<-d.started
		}

		start := time.Now()
		got := forwardRoutes(s, newInvite(t, "<sip:another:5060;lr>"))
		waited := time.Since(start)

		expectRoutes(t, got, "sip:another:5060;lr")
		if waited >= 50*time.Millisecond {
			t.Fatalf("waited %v, want no wait", waited)
		}
		expectLookups(t, d, selfRoutesMaxLookups)

		for _, r := range releases {
			close(r)
		}
		s.awaitLookups()
		expectLookups(t, d, selfRoutesMaxLookups)
	})

	t.Run("concurrent INVITEs naming the same host share one lookup", func(t *testing.T) {
		d := newFakeDNS()
		d.set("shared", "10.216.30.43")
		release := d.hold("shared")
		s := newTestSelfRoutes(t, d)

		const n = 8
		var wg sync.WaitGroup
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				forwardRoutes(s, newInvite(t, "<sip:shared:5060;lr>"))
			}()
		}
		<-d.started
		time.Sleep(50 * time.Millisecond)
		close(release)
		wg.Wait()
		s.awaitLookups()

		expectLookups(t, d, 1)
	})

	t.Run("the cache holds at most 1,024 names", func(t *testing.T) {
		d := newFakeDNS()
		s := newTestSelfRoutes(t, d)

		for i := 0; i < 1025; i++ {
			forwardRoutes(s, newInvite(t, fmt.Sprintf("<sip:host%d:5060;lr>", i)))
			<-d.started
		}

		expectLookups(t, d, 1025)
		if got := s.size(); got != 1024 {
			t.Fatalf("cache size = %d, want 1024", got)
		}
	})

	t.Run("the EdgePort logs its own addresses at startup", func(t *testing.T) {
		cfg, err := config.ParseEdgePort([]byte(`
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-test
spec:
  bindAddr: 127.0.0.1
  processor:
    addr: 127.0.0.1:1
  methods: [INVITE, ACK, BYE, CANCEL]
  localnets: [10.216.30.40/29]
  transport:
    - protocol: udp
      port: 5060
`), config.ResolveOptions{Env: config.EnvFromMap(nil)})
		if err != nil {
			t.Fatal(err)
		}
		var logs bytes.Buffer
		ep, err := New(cfg, Options{Processor: &trunkProcessor{}, Version: "test",
			Logger: slog.New(slog.NewTextHandler(&logs, nil))})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(ep.Close)

		line := ""
		for _, l := range strings.Split(logs.String(), "\n") {
			if strings.Contains(l, "own addresses [") {
				line = l
			}
		}
		if !strings.Contains(line, "127.0.0.1") {
			t.Fatalf("no own addresses line with 127.0.0.1 in:\n%s", logs.String())
		}
		if ep.selfRoutes == nil || ep.selfRoutes.ports["UDP"] != 5060 {
			t.Fatalf("selfRoutes not wired to the listening points")
		}
	})
}
