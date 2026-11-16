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
	"errors"
	"log/slog"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/config"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

type fakeDNS struct {
	answers map[string][]string
	err     error
	asked   int
}

func (f *fakeDNS) lookup(_ context.Context, host string) ([]string, error) {
	f.asked++
	if f.err != nil {
		return nil, f.err
	}
	return f.answers[host], nil
}

func newTestNames(dns *fakeDNS, now *time.Time, names ...string) *registryNames {
	return newRegistryNames(names, dns.lookup, func() time.Time { return *now }, slog.New(slog.DiscardHandler))
}

func TestSplitRegistryAddresses(t *testing.T) {
	networks, names, err := splitRegistryAddresses([]string{"10.0.0.9", "10.244.0.0/16", "::1", "requester", "routr-requester-headless.routr.svc.cluster.local."})
	if err != nil {
		t.Fatal(err)
	}
	if len(networks) != 3 || len(names) != 2 {
		t.Errorf("networks %v, names %v", networks, names)
	}
	for _, bad := range []string{"10.0.0.0/33", "", "two words", "http://requester", "requester:5060", "-requester"} {
		if _, _, err := splitRegistryAddresses([]string{bad}); err == nil {
			t.Errorf("%q is refused", bad)
		}
	}
}

func TestRegistryNamesTrustNothingBeforeTheFirstLookup(t *testing.T) {
	now := time.Unix(1000, 0)
	r := newTestNames(&fakeDNS{}, &now, "requester")
	if r.contains("10.0.0.1") {
		t.Error("nothing resolved yet")
	}
	var none *registryNames
	if none.contains("10.0.0.1") {
		t.Error("no names hold nothing")
	}
}

func TestRegistryNamesHoldExactlyWhatResolved(t *testing.T) {
	now := time.Unix(1000, 0)
	dns := &fakeDNS{answers: map[string][]string{"requester": {"10.0.0.1", "10.0.0.2"}, "other": {"fd00::1"}}}
	r := newTestNames(dns, &now, "requester", "other")
	r.refresh(context.Background())
	for _, addr := range []string{"10.0.0.1", "10.0.0.2", "fd00::1", "::ffff:10.0.0.1"} {
		if !r.contains(addr) {
			t.Errorf("%s resolved", addr)
		}
	}
	for _, addr := range []string{"10.0.0.3", "requester", ""} {
		if r.contains(addr) {
			t.Errorf("%s did not resolve", addr)
		}
	}

	// A pod that goes away is gone at the next answer
	dns.answers["requester"] = []string{"10.0.0.2"}
	r.refresh(context.Background())
	if r.contains("10.0.0.1") || !r.contains("10.0.0.2") {
		t.Error("the new answer replaces the old one")
	}
}

func TestRegistryNamesKeepTheLastGoodSetBriefly(t *testing.T) {
	now := time.Unix(1000, 0)
	dns := &fakeDNS{answers: map[string][]string{"requester": {"10.0.0.1"}}}
	r := newTestNames(dns, &now, "requester")
	r.refresh(context.Background())

	dns.err = errors.New("servfail")
	now = now.Add(registryLastGoodFor - time.Second)
	r.refresh(context.Background())
	if !r.contains("10.0.0.1") {
		t.Error("a failure inside the window keeps the last addresses")
	}

	now = now.Add(time.Second)
	r.refresh(context.Background())
	if r.contains("10.0.0.1") {
		t.Error("past the window a failing name trusts nothing")
	}

	dns.err = nil
	r.refresh(context.Background())
	if !r.contains("10.0.0.1") {
		t.Error("a name that resolves again is trusted again")
	}
}

func TestRegistryNamesTreatAnEmptyAnswerAsAFailure(t *testing.T) {
	now := time.Unix(1000, 0)
	dns := &fakeDNS{answers: map[string][]string{"requester": {"10.0.0.1"}}}
	r := newTestNames(dns, &now, "requester")
	r.refresh(context.Background())

	dns.answers["requester"] = []string{"not-an-address"}
	r.refresh(context.Background())
	if !r.contains("10.0.0.1") {
		t.Error("an answer with no address keeps the last ones for a while")
	}
	now = now.Add(registryLastGoodFor)
	r.refresh(context.Background())
	if r.contains("10.0.0.1") {
		t.Error("and then trusts nothing")
	}
}

func TestRunStopsWithItsContextAndNeedsNoNames(t *testing.T) {
	c := &Connect{}
	done := make(chan struct{})
	go func() {
		defer close(done)
		c.Run(context.Background())
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("with no names there is nothing to run")
	}

	now := time.Unix(1000, 0)
	dns := &fakeDNS{answers: map[string][]string{"requester": {"10.0.0.1"}}}
	c = &Connect{trust: edgePortTrust{registryNames: newTestNames(dns, &now, "requester")}}
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() {
		defer close(stopped)
		c.Run(ctx)
	}()
	cancel()
	select {
	case <-stopped:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop with its context")
	}
}

func TestNewRefusesABadRegistryAddress(t *testing.T) {
	env := newTestEnv(t, nil)
	deps := Dependencies{Location: env.location, Agents: env.agents, Domains: env.domains, Trunks: env.trunks, Numbers: env.numbers, Peers: env.peers}
	if _, err := New(config.ConnectSpec{}, Trust{RegistryAddresses: []string{"10.0.0.0/33"}}, deps, Options{}); err == nil {
		t.Error("a CIDR that doesn't parse is refused")
	}
}

func TestGatewayAuthIsHonoredFromAnAddressANameResolvedTo(t *testing.T) {
	cfg := testConfig()
	cfg.Spec.TrustedRegistryAddresses = []string{"requester"}
	env := newTestEnv(t, cfg)
	names := env.connect.trust.registryNames
	dns := &fakeDNS{answers: map[string][]string{"requester": {"10.9.9.9"}}}
	names.lookup = dns.lookup

	// registryRequest comes from 127.0.0.1. Resolving to another address
	// leaves it an endpoint's REGISTER, of a user no Domain knows
	names.refresh(context.Background())
	req := registryRequest(env.now)
	req.Message.Authorization = signedAuthorization(ppb.Method_REGISTER, "pbx-1", auth.GenerateNonce(func() time.Time { return env.now }))
	if res := env.process(t, req); responseTypeOf(res) != "FORBIDDEN" {
		t.Fatalf("response = %v, want 403: the name covers another address", res)
	}

	dns.answers["requester"] = []string{"127.0.0.1"}
	names.refresh(context.Background())
	if !isFromRegistry(registryRequest(env.now), env.connect.trust) {
		t.Error("the name covers the source now")
	}
}

func TestNewRefusesABadEdgePortAddress(t *testing.T) {
	env := newTestEnv(t, nil)
	deps := Dependencies{Location: env.location, Agents: env.agents, Domains: env.domains, Trunks: env.trunks, Numbers: env.numbers, Peers: env.peers}
	_, err := New(config.ConnectSpec{}, Trust{EdgePortAddresses: []string{"10.0.0.0/33"}}, deps, Options{})
	if err == nil || !strings.Contains(err.Error(), "trustedEdgePortAddresses") {
		t.Errorf("err = %v, want a CIDR that doesn't parse refused, naming trustedEdgePortAddresses", err)
	}
}

func TestTrustedEdgePortAddressesTakeANameKeptResolved(t *testing.T) {
	cfg := testConfig()
	cfg.Spec.TrustedEdgePortAddresses = []string{"10.1.0.0/24", "routr-edgeport-headless.routr"}
	env := newTestEnv(t, cfg)
	names := env.connect.trust.edgePortNames
	if names == nil || env.connect.trust.registryNames != nil {
		t.Fatal("the name is an EdgePort's, not a Requester's")
	}
	if !reflect.DeepEqual(env.connect.trust.addresses, []string{"10.1.0.0/24"}) {
		t.Errorf("addresses = %v, want the CIDR alone", env.connect.trust.addresses)
	}
	dns := &fakeDNS{answers: map[string][]string{"routr-edgeport-headless.routr": {"10.244.1.7", "10.244.2.9"}}}
	names.lookup = dns.lookup
	withRef := func(received string) *ppb.MessageRequest {
		req := agentInvite(env.now)
		req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: headerEdgePortRef, Value: "routr-edgeport-1"})
		req.Message.Via[0].Received = received
		return req
	}

	if isFromTrustedEdgePort(withRef("10.244.1.7"), env.connect.trust) {
		t.Error("before the first lookup a name trusts nothing")
	}
	names.refresh(context.Background())
	if !isFromTrustedEdgePort(withRef("10.244.1.7"), env.connect.trust) || !isFromTrustedEdgePort(withRef("10.244.2.9"), env.connect.trust) {
		t.Error("an EdgePort the name resolves to is trusted")
	}
	if isFromTrustedEdgePort(withRef("10.244.1.8"), env.connect.trust) {
		t.Error("another pod of the network is not")
	}
	if !isFromTrustedEdgePort(withRef("10.1.0.5"), env.connect.trust) {
		t.Error("the CIDR next to the name still counts")
	}
	if isFromRegistry(withRef("10.244.1.7"), env.connect.trust) {
		t.Error("an EdgePort's name grants nothing for X-Gateway-Auth")
	}
}

func TestRunKeepsBothListsResolved(t *testing.T) {
	now := time.Unix(1000, 0)
	// One fake per list: each list resolves on its own goroutine
	requesters := &fakeDNS{answers: map[string][]string{"requester": {"10.0.0.1"}}}
	edgePorts := &fakeDNS{answers: map[string][]string{"edgeport": {"10.0.0.2"}}}
	c := &Connect{trust: edgePortTrust{
		registryNames: newTestNames(requesters, &now, "requester"),
		edgePortNames: newTrustedNames(keyEdgePortAddresses, []string{"edgeport"}, edgePorts.lookup, func() time.Time { return now }, slog.New(slog.DiscardHandler)),
	}}
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() {
		defer close(stopped)
		c.Run(ctx)
	}()
	deadline := time.After(5 * time.Second)
	for !c.trust.registryNames.contains("10.0.0.1") || !c.trust.edgePortNames.contains("10.0.0.2") {
		select {
		case <-deadline:
			t.Fatal("Run resolved the names of both lists")
		case <-time.After(10 * time.Millisecond):
		}
	}
	cancel()
	select {
	case <-stopped:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop with its context")
	}
}
