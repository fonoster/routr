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
	"errors"
	"fmt"
	"log/slog"
	"net"
	"os"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/config"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// noProcessor answers every message NotFound: these tests only open
// connections.
type noProcessor struct{}

func (noProcessor) ProcessMessage(context.Context, *ppb.MessageRequest, ...grpc.CallOption) (*ppb.MessageResponse, error) {
	return nil, status.Error(codes.NotFound, "no processor")
}

func freeTCPPort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port
}

// startStreamEdgePort starts an EdgePort with a TCP and a WS listening point
// and the spec lines given.
func startStreamEdgePort(t *testing.T, specLines ...string) (ep *EdgePort, tcp, ws int) {
	t.Helper()
	tcp, ws = freeTCPPort(t), freeTCPPort(t)
	cfg, err := config.ParseEdgePort([]byte(fmt.Sprintf(`
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-test
spec:
  bindAddr: 127.0.0.1
  processor:
    addr: 127.0.0.1:1
  methods: [INVITE, ACK, BYE, CANCEL, MESSAGE, REGISTER]
  externalAddrs: [127.0.0.1]
  localnets: [127.0.0.1/8]
  %s
  transport:
    - protocol: tcp
      port: %d
    - protocol: ws
      port: %d
`, strings.Join(specLines, "\n  "), tcp, ws)), config.ResolveOptions{Env: config.EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	ep, err = New(cfg, Options{Processor: noProcessor{}, Logger: discardLog(), Version: "test",
		ConnectionIdleTimeout: cfg.Spec.ConnectionIdleTimeout, MaxConnections: cfg.Spec.MaxConnections})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = ep.Start(ctx) }()
	time.Sleep(200 * time.Millisecond)
	return ep, tcp, ws
}

func dial(t *testing.T, port int) net.Conn {
	t.Helper()
	c, err := net.Dial("tcp4", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = c.Close() })
	return c
}

// closedWithin tells whether the far end closes the connection within d: a
// read that ends in anything but our own deadline.
func closedWithin(c net.Conn, d time.Duration) bool {
	_ = c.SetReadDeadline(time.Now().Add(d))
	_, err := c.Read(make([]byte, 1))
	return err != nil && !errors.Is(err, os.ErrDeadlineExceeded)
}

func TestEveryStreamTransportHasAReadTimeout(t *testing.T) {
	conf := streamTransports(connectionIdleTimeoutOf(Options{}))
	for name, got := range map[string]time.Duration{
		"tcp": conf.TCP.ReadTimeout,
		"tls": conf.TLS.TransportTCP.ReadTimeout,
		"ws":  conf.WS.ReadTimeout,
		"wss": conf.WSS.TransportWS.ReadTimeout,
	} {
		if got != 3900*time.Second {
			t.Errorf("%s: %v, want 3900 s by default", name, got)
		}
	}
	if maxConnectionsOf(Options{}) != 20_000 {
		t.Errorf("the cap defaults to %d", maxConnectionsOf(Options{}))
	}
}

func TestStreamIdleTimeout(t *testing.T) {
	_, tcp, _ := startStreamEdgePort(t, "connectionIdleTimeout: 1")
	silent := dial(t, tcp)
	if !closedWithin(silent, 2*time.Second) {
		t.Error("a silent TCP connection is still open after 2 s")
	}
	alive := dial(t, tcp)
	for range 6 {
		if _, err := alive.Write([]byte("\r\n\r\n")); err != nil {
			t.Fatalf("closed while sending keep-alives: %v", err)
		}
		if closedWithin(alive, 500*time.Millisecond) {
			t.Fatal("closed while sending keep-alives")
		}
	}
}

func TestWSIdleBeforeUpgrade(t *testing.T) {
	_, _, ws := startStreamEdgePort(t, "connectionIdleTimeout: 1")
	if !closedWithin(dial(t, ws), 2*time.Second) {
		t.Error("a WS connection that never upgrades is still open after 2 s")
	}
}

func TestStreamConnectionCap(t *testing.T) {
	ep, tcp, _ := startStreamEdgePort(t, "maxConnections: 2")
	first, second := dial(t, tcp), dial(t, tcp)
	time.Sleep(100 * time.Millisecond)
	if !closedWithin(dial(t, tcp), time.Second) {
		t.Fatal("a third connection past the cap was kept")
	}
	if got := ep.Overflows()["connections"]; got != 1 {
		t.Errorf("connections overflows = %d, want 1", got)
	}
	if closedWithin(second, 100*time.Millisecond) {
		t.Fatal("an accepted connection was closed")
	}
	_ = first.Close()
	// sipgo frees the slot once it reads the EOF
	deadline := time.Now().Add(3 * time.Second)
	for {
		if !closedWithin(dial(t, tcp), 300*time.Millisecond) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no connection served after one of the two closed")
		}
	}
}

func TestIdleCloseIsLoggedAtDebug(t *testing.T) {
	timeout := &net.OpError{Op: "read", Net: "tcp", Addr: &net.TCPAddr{IP: net.IPv4(192, 0, 2, 7), Port: 5555}, Err: os.ErrDeadlineExceeded}
	for _, level := range []slog.Level{slog.LevelDebug, slog.LevelInfo} {
		var out bytes.Buffer
		log := slog.New(idleCloseHandler{slog.NewTextHandler(&out, &slog.HandlerOptions{Level: level})}).WithGroup("sipgo")
		log.Error("Read error", "error", timeout)
		log.Error("Got TCP error", "error", fmt.Errorf("wrapped: %w", timeout))
		log.Error("Read error", "error", errors.New("connection reset"))
		text := out.String()
		if strings.Count(text, "level=ERROR") != 1 || !strings.Contains(text, "connection reset") {
			t.Errorf("%v: other errors keep their level, deadlines don't:\n%s", level, text)
		}
		idle := strings.Count(text, `level=DEBUG msg="connection idle, closed" sipgo.remote=192.0.2.7:5555`)
		if (level == slog.LevelDebug && idle != 2) || (level == slog.LevelInfo && idle != 0) {
			t.Errorf("%v: %d idle lines:\n%s", level, idle, text)
		}
	}
}

// flakyListener fails its first Accept with an error that isn't the listener
// closing, as a process out of descriptors gives.
type flakyListener struct {
	net.Listener
	failed bool
}

func (l *flakyListener) Accept() (net.Conn, error) {
	if !l.failed {
		l.failed = true
		return nil, errors.New("accept: too many open files")
	}
	return l.Listener.Accept()
}

func TestCappedAcceptOnlyFailsWhenTheListenerIsClosed(t *testing.T) {
	raw, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	e := &EdgePort{log: discardLog(), idleTimeout: time.Minute, conns: &connectionCap{max: 1}}
	l := e.capped(&flakyListener{Listener: raw})
	accepted := make(chan error, 1)
	go func() {
		conn, err := l.Accept()
		if err == nil {
			_ = conn.Close()
		}
		accepted <- err
	}()
	dial(t, raw.Addr().(*net.TCPAddr).Port)
	if err := <-accepted; err != nil {
		t.Fatalf("an accept error that isn't a close ended Accept: %v", err)
	}
	_ = raw.Close()
	if _, err := l.Accept(); !errors.Is(err, net.ErrClosed) {
		t.Fatalf("a closed listener gives %v, want net.ErrClosed", err)
	}
}
