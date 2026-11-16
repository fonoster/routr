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

package registry

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

func TestFindTrunksAsksForSendRegister(t *testing.T) {
	client := &fakeTrunks{items: []*trunks.Trunk{testTrunk("trunk-01", "sip.provider.net", 5060)}}
	found, err := findTrunks(context.Background(), client)
	if err != nil || len(found) != 1 || found[0].GetRef() != "trunk-01" {
		t.Errorf("found: %v %v", found, err)
	}
	if len(client.requests) != 1 || client.requests[0].GetFieldName() != "sendRegister" || client.requests[0].GetFieldValue() != "true" {
		t.Errorf("the request: %v", client.requests)
	}
}

func TestFindTrunksPassesTheErrorOn(t *testing.T) {
	failure := errors.New("no API")
	if _, err := findTrunks(context.Background(), &fakeTrunks{err: failure}); !errors.Is(err, failure) {
		t.Errorf("error: %v", err)
	}
}

func TestUnregisteredTrunks(t *testing.T) {
	ctx := context.Background()
	store := newMemoryStore(defaultMaxPutsBeforeCleanup, fixedNow)
	registered := entryAt("trunk-01", fixedNow(), 120)
	quarantined := entryAt("tkxy23kj", fixedNow(), 120)
	quarantined.Status = StatusQuarantine
	if err := store.Put(ctx, registered.TrunkRef, registered); err != nil {
		t.Fatal(err)
	}
	if err := store.Put(ctx, quarantined.TrunkRef, quarantined); err != nil {
		t.Fatal(err)
	}

	due, err := unregisteredTrunks(ctx, store, []*trunks.Trunk{
		testTrunk("trunk-01", "sip.provider.net", 5060),
		testTrunk("tkxy23kj", "sip.provider.net", 5061),
		testTrunk("tkabc3423", "sip.provider3.net", 5063),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(due) != 1 || due[0].GetRef() != "tkabc3423" {
		t.Errorf("due: %v", due)
	}
}

func TestRequestParamsFromTrunk(t *testing.T) {
	spec := Spec{
		EdgePorts: []EdgePort{{Address: "sip01.edgeport.net:5060"}, {Address: "sip02.edgeport.net:6060"}},
		Methods:   []string{"INVITE", "MESSAGE"},
	}
	trunk := testTrunk("trunk-01", "sip.provider.net", 5061)
	trunk.Uris = append(trunk.Uris, &trunks.TrunkURI{Host: "second.provider.net", Port: 5062})
	got, err := requestParamsFromTrunk(trunk, spec)
	if err != nil {
		t.Fatal(err)
	}
	want := RequestParams{
		TrunkRef:      "trunk-01",
		User:          "user1",
		TargetDomain:  "sip.provider.net",
		TargetAddress: "sip.provider.net:5061",
		ProxyAddress:  "sip01.edgeport.net:5060",
		Transport:     "UDP",
		Methods:       []string{"INVITE", "MESSAGE"},
		Auth:          &Auth{Username: "1001", Secret: "1234"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("params:\n got %+v\nwant %+v", got, want)
	}
}

// A Trunk without credentials sends what Routr 2's JavaScript template made of
// the missing values.
func TestRequestParamsFromTrunkWithoutCredentials(t *testing.T) {
	trunk := testTrunk("trunk-01", "sip.provider.net", 5060)
	trunk.OutboundCredentials = nil
	got, err := requestParamsFromTrunk(trunk, Spec{EdgePorts: []EdgePort{{Address: "sip01.edgeport.net:5060"}}})
	if err != nil {
		t.Fatal(err)
	}
	if got.Auth == nil || got.Auth.Username != "undefined" || got.Auth.Secret != "undefined" {
		t.Errorf("auth: %+v", got.Auth)
	}
	request, err := newRequestBuilder(fixedNow).build(got)
	if err != nil {
		t.Fatal(err)
	}
	extensions := request.GetMessage().GetExtensions()
	last := extensions[len(extensions)-1]
	if last.GetName() != "X-Gateway-Auth" || last.GetValue() != "dW5kZWZpbmVkOnVuZGVmaW5lZA==" {
		t.Errorf("the header: %v", last)
	}
}

func TestRequestParamsFromTrunkFailures(t *testing.T) {
	edgePorts := []EdgePort{{Address: "sip01.edgeport.net:5060"}}
	noURIs := testTrunk("t", "sip.provider.net", 5060)
	noURIs.Uris = nil
	for name, tc := range map[string]struct {
		trunk *trunks.Trunk
		spec  Spec
		want  string
	}{
		"no uris":      {noURIs, Spec{EdgePorts: edgePorts}, "no uris"},
		"no edgePorts": {testTrunk("t", "sip.provider.net", 5060), Spec{}, "spec.edgePorts"},
		"no port":      {testTrunk("t", "sip.provider.net", 0), Spec{EdgePorts: edgePorts}, "a host and a port"},
		"no host":      {testTrunk("t", "", 5060), Spec{EdgePorts: edgePorts}, "a host and a port"},
	} {
		if _, err := requestParamsFromTrunk(tc.trunk, tc.spec); err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: %v", name, err)
		}
	}
}
