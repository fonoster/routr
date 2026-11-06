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
	"reflect"
	"testing"

	"google.golang.org/protobuf/types/known/structpb"

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/trace"
)

func TestRecordingMetadata(t *testing.T) {
	agent := testAgent("agent-01", "1001")
	domain := testDomain()
	if got := recordingMetadata(agent, domain); len(got) != 0 {
		t.Errorf("nobody asked, got %v", got)
	}
	domain.Trace = &trace.Trace{Enabled: true}
	if got := recordingMetadata(agent, domain); got[traceFlagMetadataKey] != "domain-01" {
		t.Errorf("the domain asked, got %v", got)
	}
	agent.Trace = &trace.Trace{Enabled: true}
	if got := recordingMetadata(agent, domain); got[traceFlagMetadataKey] != "agent-01" {
		t.Errorf("the first that asked wins, got %v", got)
	}
	agent.Trace = &trace.Trace{Enabled: false}
	if got := recordingMetadata(agent, domain); got[traceFlagMetadataKey] != "domain-01" {
		t.Errorf("trace disabled is not asking, got %v", got)
	}
	// A typed nil (an Agent without a Domain) asks for nothing
	var noDomain *domains.Domain
	var noAgent *agents.Agent
	if got := recordingMetadata(nil, noAgent, noDomain, agent); len(got) != 0 {
		t.Errorf("nil resources asked, got %v", got)
	}
}

func TestStringOf(t *testing.T) {
	s, err := structpb.NewStruct(map[string]any{
		"accessKeyId": "WO00000000",
		"count":       3,
		"ratio":       1.5,
		"flag":        true,
		"nothing":     nil,
		"nested":      map[string]any{"a": "b"},
	})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"accessKeyId": "WO00000000",
		"count":       "3",
		"ratio":       "1.5",
		"flag":        "true",
		"nothing":     "null",
		"nested":      `{"a":"b"}`,
	}
	for key, w := range want {
		if got := stringOf(s.Fields[key]); got != w {
			t.Errorf("stringOf(%s) = %q, want %q", key, got, w)
		}
	}
}

func TestRouteMetadata(t *testing.T) {
	caller := testAgent("agent-01", "1001")
	caller.Trace = &trace.Trace{Enabled: true}
	extended, _ := structpb.NewStruct(map[string]any{"accessKeyId": "WO00000000", "trace.direction": "spoofed"})
	got := routeMetadata(extended, directionAgentToAgent, caller, caller.GetDomain())
	want := map[string]string{
		"accessKeyId":     "WO00000000",
		"trace.record":    "agent-01",
		"trace.direction": "agent-to-agent",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("routeMetadata() = %v, want %v", got, want)
	}
	if got := routeMetadata(nil, directionAgentToAgent); !reflect.DeepEqual(got, map[string]string{"trace.direction": "agent-to-agent"}) {
		t.Errorf("without resources = %v", got)
	}
}
