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

package one

import (
	"context"
	"fmt"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/location"
	"github.com/fonoster/routr/internal/common/sipconv"
)

// sampleResources is the repository's resources directory, the one the
// files backend serves in the compose stack.
const sampleResources = "../../config/resources"

// routrYAML is a routr.yaml for one UDP transport on the port, the files
// backend over the sample resources, everything else at its default.
func routrYAML(port int, resources string) string {
	return fmt.Sprintf(`
apiVersion: v3
kind: Routr
ref: routr-test
spec:
  edgeport:
    bindAddr: 127.0.0.1
    externalAddrs: [127.0.0.1]
    localnets: [127.0.0.1/8]
    transport:
      - protocol: udp
        port: %d
  data:
    backend: files
    path: %s
`, port, resources)
}

func parseRoutr(t *testing.T, text string) *config.Routr {
	t.Helper()
	cfg, err := config.ParseRoutr([]byte(text), config.ResolveOptions{Env: config.EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	return cfg
}

func freeUDPPort(t *testing.T) int {
	t.Helper()
	c, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	return c.LocalAddr().(*net.UDPAddr).Port
}

// loopback binds every gRPC listener to a free loopback port.
func loopback() *Listeners {
	return &Listeners{Location: "127.0.0.1:0", Data: "127.0.0.1:0", Connect: "127.0.0.1:0"}
}

func TestNewRefusesWhatMilestone1DoesNotShip(t *testing.T) {
	port := freeUDPPort(t)
	for name, tc := range map[string]struct {
		extra string
		key   string
	}{
		"redis location store": {"  location:\n    cache: { provider: redis }\n", "spec.location.cache.provider"},
		"rtprelay":             {"  rtprelay: { host: rtpengine, port: 22222 }\n", "spec.rtprelay"},
	} {
		t.Run(name, func(t *testing.T) {
			cfg := parseRoutr(t, routrYAML(port, sampleResources)+tc.extra)
			_, err := New(context.Background(), cfg, Options{Listeners: loopback()})
			if err == nil || !strings.Contains(err.Error(), tc.key) || !strings.Contains(err.Error(), "milestone 3") {
				t.Fatalf("names the key and the milestone: %v", err)
			}
		})
	}
}

func TestNewNamesTheKeyOfABadDataSection(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), t.TempDir()+"/missing"))
	_, err := New(context.Background(), cfg, Options{Listeners: loopback()})
	if err == nil || !strings.Contains(err.Error(), "spec.data.path") {
		t.Fatalf("names spec.data.path: %v", err)
	}
	if _, err := New(context.Background(), nil, Options{}); err == nil {
		t.Error("a nil config is refused")
	}
	cfg.Spec.EdgePort = nil
	if _, err := New(context.Background(), cfg, Options{}); err == nil || !strings.Contains(err.Error(), "spec.edgeport") {
		t.Errorf("names spec.edgeport: %v", err)
	}
}

func TestNewNamesAListenerItCannotBind(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer taken.Close()
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	listeners := loopback()
	listeners.Data = taken.Addr().String()
	_, err = New(context.Background(), cfg, Options{Listeners: listeners})
	if err == nil || !strings.Contains(err.Error(), "data service") || !strings.Contains(err.Error(), taken.Addr().String()) {
		t.Fatalf("names the service and the address: %v", err)
	}
}

func TestNewThenCloseLeavesNothingBound(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	o, err := New(context.Background(), cfg, Options{Listeners: loopback()})
	if err != nil {
		t.Fatal(err)
	}
	addr := o.Addr("location")
	if addr == "" || o.Addr("data") == "" || o.Addr("connect") == "" || o.Addr("nothing") != "" {
		t.Errorf("Addr names the bound listeners: %q", addr)
	}
	if err := o.Close(); err != nil {
		t.Fatal(err)
	}
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		t.Fatalf("the listener was released: %v", err)
	}
	lis.Close()
}

// uac is a SIP endpoint on a UDP socket.
type uac struct {
	t    *testing.T
	conn net.PacketConn
	port int
}

func newUAC(t *testing.T) *uac {
	t.Helper()
	conn, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	return &uac{t: t, conn: conn, port: conn.LocalAddr().(*net.UDPAddr).Port}
}

func (u *uac) send(to int, text string) {
	u.t.Helper()
	text = strings.ReplaceAll(strings.TrimLeft(text, "\n"), "\n", "\r\n")
	if _, err := u.conn.WriteTo([]byte(text), &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: to}); err != nil {
		u.t.Fatal(err)
	}
}

// recv returns the next final response, skipping 100 Trying.
func (u *uac) recv(within time.Duration) *sip.Response {
	u.t.Helper()
	deadline := time.Now().Add(within)
	buf := make([]byte, 65535)
	for {
		_ = u.conn.SetReadDeadline(deadline)
		n, _, err := u.conn.ReadFrom(buf)
		if err != nil {
			u.t.Fatalf("nothing received: %v", err)
		}
		msg, err := sip.ParseMessage(buf[:n])
		if err != nil {
			u.t.Fatalf("unparseable: %v", err)
		}
		if res, ok := msg.(*sip.Response); ok && res.StatusCode != 100 {
			return res
		}
	}
}

// startOne runs RoutrOne over the sample resources until the test ends and
// returns it with its SIP port. Run must return nil on the stop.
func startOne(t *testing.T) (*One, int) {
	t.Helper()
	port := freeUDPPort(t)
	cfg := parseRoutr(t, routrYAML(port, sampleResources))
	ctx, cancel := context.WithCancel(context.Background())
	o, err := New(ctx, cfg, Options{Listeners: loopback(), Version: "test"})
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- o.Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		select {
		case err := <-done:
			if err != nil {
				t.Errorf("Run on a cancelled context: %v", err)
			}
		case <-time.After(5 * time.Second):
			t.Error("Run did not return after the context was cancelled")
		}
	})
	time.Sleep(200 * time.Millisecond)
	return o, port
}

func register(port, uacPort int, cseq int, authorization string) string {
	return fmt.Sprintf(`
REGISTER sip:sip.local SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-r%d
Max-Forwards: 70
From: <sip:1001@sip.local>;tag=1
To: <sip:1001@sip.local>
Call-ID: r1
CSeq: %d REGISTER
Contact: <sip:1001@127.0.0.1:%d;transport=udp>
Expires: 60
%sContent-Length: 0

`, uacPort, cseq, cseq, uacPort, authorization)
}

func TestRunAnswersARegisterThroughEveryComponent(t *testing.T) {
	o, port := startOne(t)
	ua := newUAC(t)

	// The EdgePort, the Dispatcher, Connect, the Data API (agent 1001 of
	// domain sip.local, from the files backend): a challenge
	ua.send(port, register(port, ua.port, 1, ""))
	res := ua.recv(2 * time.Second)
	if res.StatusCode != 401 {
		t.Fatalf("a REGISTER without credentials is challenged:\n%s", res)
	}
	wwwAuth := res.GetHeader("WWW-Authenticate")
	if wwwAuth == nil {
		t.Fatalf("no WWW-Authenticate:\n%s", res)
	}
	params := sipconv.ParseAuth(wwwAuth.Value()).Params
	if params["realm"] != "sip.local" || params["nonce"] == "" {
		t.Fatalf("the challenge names the realm and a nonce: %v", params)
	}

	// With the credentials of config/resources/credentials.yaml: the
	// Location binds the Contact and the answer is 200 OK
	response := auth.CalculateResponse(auth.Challenge{
		Realm:  "sip.local",
		Nonce:  params["nonce"],
		URI:    "sip:sip.local",
		Method: "REGISTER",
	}, auth.Credentials{Username: "1001", Secret: "1234"})
	authorization := fmt.Sprintf("Authorization: Digest username=\"1001\", realm=\"sip.local\", nonce=\"%s\", uri=\"sip:sip.local\", response=\"%s\", algorithm=MD5\n",
		params["nonce"], response)
	ua.send(port, register(port, ua.port, 2, authorization))
	res = ua.recv(2 * time.Second)
	if res.StatusCode != 200 {
		t.Fatalf("a REGISTER with the right credentials is accepted:\n%s", res)
	}
	if res.GetHeader("Contact") == nil {
		t.Errorf("the answer carries the Contact it registered:\n%s", res)
	}

	// The lookups went through the cache: the agent and its domain
	if o.cache.Size() < 2 {
		t.Errorf("the agent and the domain are cached: %d entries", o.cache.Size())
	}

	// The same Location and Data API are served over gRPC, as rctl and the
	// SDK reach them
	ctx := context.Background()
	dial := func(addr string) *grpc.ClientConn {
		conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = conn.Close() })
		return conn
	}
	routes, err := location.NewLocationClient(dial(o.Addr("location"))).FindRoutes(ctx, &location.FindRoutesRequest{Aor: "sip:1001@sip.local"})
	if err != nil || len(routes.GetRoutes()) != 1 {
		t.Fatalf("the binding is in the Location: %v %v", routes, err)
	}
	if r := routes.GetRoutes()[0]; r.GetHost() != "127.0.0.1" || r.GetPort() != fmt.Sprint(ua.port) {
		t.Errorf("the route is the Contact: %v", r)
	}
	found, err := agents.NewAgentsClient(dial(o.Addr("data"))).FindBy(ctx, &agents.FindByRequest{FieldName: "username", FieldValue: "1001"})
	if err != nil || len(found.GetItems()) != 1 || found.GetItems()[0].GetDomain().GetRef() != "domain-01" {
		t.Fatalf("the Data API serves the agent with its domain: %v %v", found, err)
	}
}

func TestRunStopsWhenAListenerFails(t *testing.T) {
	port := freeUDPPort(t)
	cfg := parseRoutr(t, routrYAML(port, sampleResources))
	o, err := New(context.Background(), cfg, Options{Listeners: loopback()})
	if err != nil {
		t.Fatal(err)
	}
	// Pull the data listener from under the server: Serve fails and Run
	// stops everything, returning the failure
	_ = o.servers[1].lis.Close()
	done := make(chan error, 1)
	go func() { done <- o.Run(context.Background()) }()
	select {
	case err := <-done:
		if err == nil || !strings.Contains(err.Error(), "data service") {
			t.Fatalf("the failure names the service: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop on a failed listener")
	}
	// Everything released: the SIP port binds again
	c, err := net.ListenPacket("udp4", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		t.Fatalf("the EdgePort released its port: %v", err)
	}
	c.Close()
}
