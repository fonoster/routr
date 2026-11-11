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
	"net/http"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/location"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
	"github.com/fonoster/routr/internal/common/sipconv"
	locationstore "github.com/fonoster/routr/internal/location"
)

// sampleResources is the repository's resources directory, the one the
// files backend serves in the compose stack.
const sampleResources = "../../config/resources"

// routrYAML is a routr.yaml for one UDP transport on the port, the files
// backend over the sample resources, every gRPC service on a free loopback
// port, everything else at its default.
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
  dispatcher:
    bindAddr: 127.0.0.1:0
  connect:
    bindAddr: 127.0.0.1:0
  location:
    bindAddr: 127.0.0.1:0
  requester:
    bindAddr: 127.0.0.1:0
    sipHost: 127.0.0.1
  data:
    backend: files
    path: %s
    bindAddr: 127.0.0.1:0
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

func TestNewBuildsTheRTPRelayAsAPostProcessor(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.RTPRelay = &config.RTPRelaySpec{Host: "127.0.0.1", Port: 22222}
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	if o.rtpEngine == nil {
		t.Error("spec.rtprelay builds the RTPEngine client")
	}

	cfg = parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.RTPRelay = &config.RTPRelaySpec{Host: "127.0.0.1", Port: 0}
	if _, err := New(context.Background(), cfg, Options{}); err == nil || !strings.Contains(err.Error(), "spec.rtprelay") {
		t.Errorf("names spec.rtprelay: %v", err)
	}
}

func TestNewOpensTheStoreTheCacheNames(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Location.Cache.Provider = "carrier-pigeon"
	if _, err := New(context.Background(), cfg, Options{}); err == nil || !strings.Contains(err.Error(), "spec.location.cache") {
		t.Errorf("names spec.location.cache: %v", err)
	}
}

func TestNewBuildsTheRedisLocationStore(t *testing.T) {
	raw := os.Getenv("TEST_REDIS_URL")
	if raw == "" {
		t.Skip("TEST_REDIS_URL is not set")
	}
	opts, err := redis.ParseURL(raw)
	if err != nil {
		t.Fatal(err)
	}
	host, port, err := net.SplitHostPort(opts.Addr)
	if err != nil {
		t.Fatal(err)
	}
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Location.Cache = config.Cache{Provider: "redis", Parameters: fmt.Sprintf("host=%s,port=%s", host, port)}
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	if _, ok := o.locationStore.(*locationstore.RedisStore); !ok {
		t.Errorf("the store is %T", o.locationStore)
	}
}

func TestRecordingStartsWithTheSectionAndStopsWithClose(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Dispatcher.Recording = &config.RecordingSpec{Enabled: true, Path: t.TempDir(), Mode: config.RecordingModeAll}
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if o.recorder == nil {
		t.Error("spec.dispatcher.recording builds the recorder")
	}
	if err := o.Close(); err != nil {
		t.Error(err)
	}

	cfg = parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	blocked := t.TempDir() + "/file"
	if err := os.WriteFile(blocked, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	cfg.Spec.Dispatcher.Recording = &config.RecordingSpec{Enabled: true, Path: blocked + "/traces"}
	if _, err := New(context.Background(), cfg, Options{}); err == nil || !strings.Contains(err.Error(), "spec.dispatcher.recording") {
		t.Errorf("names spec.dispatcher.recording: %v", err)
	}
}

func TestHealthAnswersWithTheSectionOnly(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	off, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if off.Addr("health") != "" {
		t.Errorf("no section, no listener: %q", off.Addr("health"))
	}
	_ = off.Close()

	cfg = parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Health = &config.HealthSpec{BindAddr: "127.0.0.1:0"}
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- o.Run(ctx) }()
	defer func() {
		cancel()
		if err := <-done; err != nil {
			t.Error(err)
		}
	}()
	url := "http://" + o.Addr("health") + "/healthz"
	deadline := time.Now().Add(5 * time.Second)
	for {
		res, err := http.Get(url)
		if err == nil {
			_ = res.Body.Close()
			if res.StatusCode != http.StatusOK {
				t.Errorf("GET /healthz: %d", res.StatusCode)
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatal(err)
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func TestHealthBindFailureNamesTheKey(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer taken.Close()
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Health = &config.HealthSpec{BindAddr: taken.Addr().String()}
	if _, err := New(context.Background(), cfg, Options{}); err == nil || !strings.Contains(err.Error(), "spec.health.bindAddr") {
		t.Errorf("names spec.health.bindAddr: %v", err)
	}
}

func TestNewNamesTheKeyOfABadDataSection(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), t.TempDir()+"/missing"))
	_, err := New(context.Background(), cfg, Options{})
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
	cfg.Spec.Data.BindAddr = taken.Addr().String()
	_, err = New(context.Background(), cfg, Options{})
	if err == nil || !strings.Contains(err.Error(), "data service") || !strings.Contains(err.Error(), taken.Addr().String()) {
		t.Fatalf("names the service and the address: %v", err)
	}
}

func TestNewThenCloseLeavesNothingBound(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	addr := o.Addr("location")
	if addr == "" || o.Addr("data") == "" || o.Addr("connect") == "" || o.Addr("dispatcher") == "" || o.Addr("nothing") != "" {
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
	o, err := New(ctx, cfg, Options{Version: "test"})
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

	// The same Location, Data API and Dispatcher are served over gRPC, as
	// rctl, the SDK and an external EdgePort reach them
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
	health, err := healthpb.NewHealthClient(dial(o.Addr("dispatcher"))).Check(ctx, &healthpb.HealthCheckRequest{})
	if err != nil || health.GetStatus() != healthpb.HealthCheckResponse_SERVING {
		t.Errorf("the Dispatcher is served with its health check: %v %v", health, err)
	}
}

func TestNewServesOnlyWhatHasABindAddr(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Dispatcher.BindAddr = ""
	cfg.Spec.Connect.BindAddr = ""
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	if o.Addr("dispatcher") != "" || o.Addr("connect") != "" || o.Addr("location") == "" || o.Addr("data") == "" {
		t.Errorf("an empty bindAddr turns the listener off: %v", o.servers)
	}
}

func TestNewBuildsTheRequesterOnlyWhenTheRegistryUsesIt(t *testing.T) {
	// With a bindAddr of its own and no Registry, nothing asks for one
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	if o.requester != nil || o.registry != nil || o.Addr("requester") != "" {
		t.Errorf("nothing asked for a Requester: %+v %+v", o.requester, o.registry)
	}

	// The Registry alone needs one, without serving it
	cfg = parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Requester.BindAddr = ""
	cfg.Spec.Registry = &config.RegistrySpec{EdgePorts: []config.RegistryEdgePort{{Address: "127.0.0.1:5060"}}}
	withRegistry, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer withRegistry.Close()
	if withRegistry.requester == nil || withRegistry.registry == nil || withRegistry.Addr("requester") != "" {
		t.Errorf("the Registry needs an in-process Requester: %+v %+v", withRegistry.requester, withRegistry.registry)
	}
}

func TestDispatcherTakesTheMethodsOfTheEdgePort(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	for _, method := range []processor.Method{processor.Method_OPTIONS, processor.Method_MESSAGE, processor.Method_INFO} {
		_, err := o.dispatcher.ProcessMessage(context.Background(), &processor.MessageRequest{Ref: "r", Method: method, Message: &sipmessage.SIPMessage{}})
		if status.Code(err) != codes.NotFound {
			t.Errorf("%s: %v, want what the EdgePort answers 501 to", method, err)
		}
	}
	if !slices.Equal(cfg.Spec.EdgePort.Methods, []string{"REGISTER", "INVITE", "ACK", "BYE", "CANCEL", "REFER", "NOTIFY"}) {
		t.Errorf("the default is Routr 2's RoutrOne list: %v", cfg.Spec.EdgePort.Methods)
	}
}

func TestNewWantsAVerifierClientForVerifierAddr(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Connect.VerifierAddr = "verifier:51905"
	if _, err := New(context.Background(), cfg, Options{}); err == nil || !strings.Contains(err.Error(), "spec.connect.verifierAddr") {
		t.Fatalf("names spec.connect.verifierAddr: %v", err)
	}
	cfg.Spec.Connect.VerifierAddr = ""
	cfg.Spec.Connect.VerifierPublicKeyPath = t.TempDir() + "/missing.pem"
	if _, err := New(context.Background(), cfg, Options{}); err == nil || !strings.Contains(err.Error(), "spec.connect.verifierPublicKeyPath") {
		t.Fatalf("names spec.connect.verifierPublicKeyPath: %v", err)
	}
}

func TestRunStopsWhenAListenerFails(t *testing.T) {
	port := freeUDPPort(t)
	cfg := parseRoutr(t, routrYAML(port, sampleResources))
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	// Stop the data server before Run serves it: its Serve fails at once
	// and Run stops everything, returning the failure
	o.servers[1].Close()
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

func TestEdgePortConnectionLimits(t *testing.T) {
	text := strings.Replace(routrYAML(freeUDPPort(t), sampleResources), "    bindAddr: 127.0.0.1\n    externalAddrs", "    bindAddr: 127.0.0.1\n    connectionIdleTimeout: 1\n    maxConnections: 2\n    externalAddrs", 1)
	o, err := New(context.Background(), parseRoutr(t, text), Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	if o.edgePort.IdleTimeout() != time.Second || o.edgePort.MaxConnections() != 2 {
		t.Errorf("idle %v, max %d", o.edgePort.IdleTimeout(), o.edgePort.MaxConnections())
	}
}
