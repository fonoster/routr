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
	"strings"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/config"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// The standalone EdgePort read Routr 2's variables over its file until #574;
// now only the file counts (ROUTR3.md § 7).
func TestTheFileWinsOverTheRoutr2Environment(t *testing.T) {
	t.Setenv("EXTERNAL_ADDRS", "9.9.9.9")
	t.Setenv("LOCALNETS", "9.0.0.0/8")
	t.Setenv("ALIASES", "env.example.com")
	t.Setenv("HOSTNAME", "env-host")
	t.Setenv("STRIP_SESSION_PROGRESS_SDP", "true")
	cfg, err := config.ParseEdgePort([]byte(`
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-file
spec:
  processor:
    addr: 127.0.0.1:1
  methods: [INVITE]
  externalAddrs: [203.0.113.10]
  localnets: [10.0.0.0/8]
  aliases: [sip.example.com]
  transport:
    - protocol: udp
      port: 5060
`), config.ResolveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	conn, err := grpc.NewClient("127.0.0.1:1", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	ep, err := New(cfg, Options{Processor: ppb.NewProcessorClient(conn)})
	if err != nil {
		t.Fatal(err)
	}
	conv := ep.conv
	if conv.EdgePortRef != "edgeport-file" || strings.Join(conv.ExternalAddrs, ",") != "203.0.113.10" ||
		strings.Join(conv.Localnets, ",") != "10.0.0.0/8" || strings.Join(conv.Aliases, ",") != "sip.example.com" {
		t.Errorf("the file's values: ref %q, external %v, localnets %v, aliases %v", conv.EdgePortRef, conv.ExternalAddrs, conv.Localnets, conv.Aliases)
	}
	if ep.stripSessionProgressSdp {
		t.Error("STRIP_SESSION_PROGRESS_SDP is not read")
	}
}
