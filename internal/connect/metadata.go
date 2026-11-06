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
	"encoding/json"
	"strconv"

	"google.golang.org/protobuf/types/known/structpb"

	"github.com/fonoster/routr/internal/common/pb/connect/trace"
)

// The metadata keys the dispatcher reads (mods/common/src/trace/types.ts)
const (
	traceMetadataPrefix   = "trace."
	traceFlagMetadataKey  = "trace.record"
	traceDirectionMetaKey = traceMetadataPrefix + "direction"
	traceTrunkMetaKey     = traceMetadataPrefix + "trunk"
)

// traceable is a resource that can ask for its calls to be recorded: Agents,
// Peers, Domains and Trunks carry a ref and trace settings.
type traceable interface {
	GetRef() string
	GetTrace() *trace.Trace
}

// recordingMetadata asks the dispatcher to record the call when any of the
// resources it touches has trace.enabled: the value is the ref of the first
// one that asked. A nil resource (a typed nil too) asks for nothing.
func recordingMetadata(resources ...traceable) map[string]string {
	for _, r := range resources {
		if r == nil {
			continue
		}
		if t := r.GetTrace(); t != nil && t.GetEnabled() {
			return map[string]string{traceFlagMetadataKey: r.GetRef()}
		}
	}
	return map[string]string{}
}

// stringOf writes an extended attribute as the Node code did when it spread
// the decoded struct into the route metadata (protobufjs coerces every value
// of a map<string, string> with String()).
func stringOf(v *structpb.Value) string {
	switch k := v.GetKind().(type) {
	case *structpb.Value_StringValue:
		return k.StringValue
	case *structpb.Value_NumberValue:
		return strconv.FormatFloat(k.NumberValue, 'f', -1, 64)
	case *structpb.Value_BoolValue:
		return strconv.FormatBool(k.BoolValue)
	case *structpb.Value_NullValue:
		return "null"
	default:
		b, err := json.Marshal(v.AsInterface())
		if err != nil {
			return ""
		}
		return string(b)
	}
}

// routeMetadata is what the router attaches to a route: the caller's
// extended attributes, which link the call to an account; the recording flag
// from any resource the call touches that asks for it; and the trace
// annotations of the hop. Later keys override earlier ones, as the spread in
// the Node router does.
func routeMetadata(extended *structpb.Struct, direction direction, resources ...traceable) map[string]string {
	metadata := map[string]string{}
	for key, value := range extended.GetFields() {
		metadata[key] = stringOf(value)
	}
	for key, value := range recordingMetadata(resources...) {
		metadata[key] = value
	}
	metadata[traceDirectionMetaKey] = string(direction)
	return metadata
}
