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
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"errors"
	"fmt"
	"math/big"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/gobwas/ws"
	"github.com/gobwas/ws/wsutil"
	"google.golang.org/grpc"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

const upgradeRequest = "GET / HTTP/1.1\r\nHost: edgeport\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
	"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: sip\r\n\r\n"

// okProcessor answers every request 200.
type okProcessor struct{}

func (okProcessor) ProcessMessage(context.Context, *ppb.MessageRequest, ...grpc.CallOption) (*ppb.MessageResponse, error) {
	return &ppb.MessageResponse{Message: &pb.SIPMessage{
		MessageType: &pb.SIPMessage_ResponseType{ResponseType: pb.ResponseType_OK}, ReasonPhrase: "OK"}}, nil
}

// trickle sends the upgrade request one byte a second until the far end
// closes the connection.
func trickle(conn net.Conn) {
	for i := range len(upgradeRequest) {
		if _, err := conn.Write([]byte{upgradeRequest[i]}); err != nil {
			return
		}
		time.Sleep(time.Second)
	}
}

// upgrades sends a whole upgrade request and tells whether the 101 comes
// back within a second.
func upgrades(t *testing.T, conn net.Conn) bool {
	t.Helper()
	if _, err := conn.Write([]byte(upgradeRequest)); err != nil {
		t.Fatal(err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(time.Second))
	buf := make([]byte, 512)
	n, _ := conn.Read(buf)
	_ = conn.SetReadDeadline(time.Time{})
	return strings.HasPrefix(string(buf[:n]), "HTTP/1.1 101")
}

func TestWSAcceptNotBlockedBySilentClient(t *testing.T) {
	_, _, port := startStreamEdgePortWith(t, okProcessor{})
	accepted := time.Now()
	silent, slow := dial(t, port), dial(t, port)
	go trickle(slow)
	time.Sleep(100 * time.Millisecond)

	client := dial(t, port)
	if !upgrades(t, client) {
		t.Fatal("no 101 within 1 s while a silent and a slow client are connected")
	}
	// It upgrades and registers as before
	register := fmt.Sprintf("REGISTER sip:sip.local SIP/2.0\r\nVia: SIP/2.0/WS %s;branch=z9hG4bK-ws1\r\nMax-Forwards: 70\r\n"+
		"From: <sip:1001@sip.local>;tag=1\r\nTo: <sip:1001@sip.local>\r\nCall-ID: ws-register-1\r\nCSeq: 1 REGISTER\r\n"+
		"Contact: <sip:1001@client.invalid;transport=ws>\r\nContent-Length: 0\r\n\r\n", client.LocalAddr())
	if err := wsutil.WriteClientMessage(client, ws.OpText, []byte(register)); err != nil {
		t.Fatal(err)
	}
	_ = client.SetReadDeadline(time.Now().Add(2 * time.Second))
	answer, err := wsutil.ReadServerText(client)
	if err != nil || !strings.HasPrefix(string(answer), "SIP/2.0 200") {
		t.Fatalf("the REGISTER over the upgraded connection: %q, %v", answer, err)
	}

	// The two that never finished their upgrade are closed 10 s after the accept
	left := time.Until(accepted.Add(wsUpgradeTimeout + time.Second))
	if !closedWithin(silent, left) {
		t.Error("the silent connection is still open 11 s after its accept")
	}
	if !closedWithin(slow, time.Until(accepted.Add(wsUpgradeTimeout+time.Second))) {
		t.Error("the slow connection is still open 11 s after its accept")
	}
}

// selfSigned is a server TLS configuration with a certificate made here.
func selfSigned(t *testing.T) *tls.Config {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "edgeport"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IPAddresses: []net.IP{net.IPv4(127, 0, 0, 1)}}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	return &tls.Config{Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}}
}

// gateOver starts a gate on a free port, as Start does for a WS (tlsConfig
// nil) or WSS listening point, and returns it with its EdgePort and port.
func gateOver(t *testing.T, tlsConfig *tls.Config) (*EdgePort, *wsGate, int) {
	t.Helper()
	raw, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	e := &EdgePort{log: discardLog(), idleTimeout: time.Minute, conns: &connectionCap{max: 100}}
	gate := e.gated(e.capped(raw), tlsConfig)
	t.Cleanup(func() { _ = gate.Close() })
	return e, gate, raw.Addr().(*net.TCPAddr).Port
}

// serveLikeSipgo accepts and upgrades one connection at a time, as sipgo's
// WS Serve does.
func serveLikeSipgo(gate *wsGate) {
	for {
		conn, err := gate.Accept()
		if err != nil {
			return
		}
		if _, err := (ws.Upgrader{Protocol: func([]byte) bool { return true }}).Upgrade(conn); err != nil {
			_ = conn.Close()
		}
	}
}

func TestWSSAcceptNotBlockedBySilentClient(t *testing.T) {
	_, gate, port := gateOver(t, selfSigned(t))
	go serveLikeSipgo(gate)
	accepted := time.Now()
	// One client sends no ClientHello, one its upgrade request a byte a second
	silent := dial(t, port)
	secure := func() net.Conn {
		conn, err := tls.Dial("tcp4", fmt.Sprintf("127.0.0.1:%d", port), &tls.Config{InsecureSkipVerify: true})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = conn.Close() })
		return conn
	}
	slow := secure()
	go trickle(slow)
	time.Sleep(100 * time.Millisecond)

	if !upgrades(t, secure()) {
		t.Fatal("no 101 within 1 s while a silent and a slow client are connected")
	}
	if !closedWithin(silent, time.Until(accepted.Add(wsUpgradeTimeout+time.Second))) {
		t.Error("the client that sent no ClientHello is still open 11 s after its accept")
	}
	if !closedWithin(slow, time.Until(accepted.Add(wsUpgradeTimeout+time.Second))) {
		t.Error("the slow connection is still open 11 s after its accept")
	}
}

func TestWSGateLimits(t *testing.T) {
	t.Run("a request head over 4 KiB is closed without a response", func(t *testing.T) {
		e, gate, port := gateOver(t, nil)
		go serveLikeSipgo(gate)
		conn := dial(t, port)
		if _, err := conn.Write([]byte("GET / HTTP/1.1\r\nX-Padding: " + strings.Repeat("a", wsUpgradeHeadLimit) + "\r\n\r\n")); err != nil {
			t.Fatal(err)
		}
		if !closedWithin(conn, 2*time.Second) {
			t.Fatal("answered, or still open")
		}
		deadline := time.Now().Add(2 * time.Second)
		for e.conns.active.Load() != 0 {
			if time.Now().After(deadline) {
				t.Fatalf("its slot was never released: %d", e.conns.active.Load())
			}
			time.Sleep(10 * time.Millisecond)
		}
	})
	t.Run("a head of exactly 4 KiB upgrades", func(t *testing.T) {
		_, gate, port := gateOver(t, nil)
		go serveLikeSipgo(gate)
		conn := dial(t, port)
		pad := wsUpgradeHeadLimit - len(upgradeRequest) - len("X-Padding: \r\n")
		request := strings.Replace(upgradeRequest, "\r\n\r\n", "\r\nX-Padding: "+strings.Repeat("a", pad)+"\r\n\r\n", 1)
		if len(request) != wsUpgradeHeadLimit {
			t.Fatalf("test bug: %d bytes", len(request))
		}
		if _, err := conn.Write([]byte(request)); err != nil {
			t.Fatal(err)
		}
		_ = conn.SetReadDeadline(time.Now().Add(time.Second))
		buf := make([]byte, 512)
		if n, _ := conn.Read(buf); !strings.HasPrefix(string(buf[:n]), "HTTP/1.1 101") {
			t.Fatalf("got %q", buf[:n])
		}
	})
	t.Run("closing the gate closes what waits in it and ends Accept with net.ErrClosed", func(t *testing.T) {
		e, gate, port := gateOver(t, nil)
		first, second := dial(t, port), dial(t, port)
		time.Sleep(100 * time.Millisecond)
		accepted := make(chan error, 1)
		go func() {
			_, err := gate.Accept()
			accepted <- err
		}()
		if err := gate.Close(); err != nil {
			t.Fatal(err)
		}
		if err := <-accepted; err != net.ErrClosed {
			t.Errorf("Accept gave %v, want net.ErrClosed itself", err)
		}
		if !closedWithin(first, time.Second) || !closedWithin(second, time.Second) {
			t.Error("a connection waiting in the gate outlived it")
		}
		if n := e.conns.active.Load(); n != 0 {
			t.Errorf("%d slots still taken", n)
		}
		if _, err := gate.Accept(); !errors.Is(err, net.ErrClosed) {
			t.Errorf("Accept after Close: %v", err)
		}
	})
}
