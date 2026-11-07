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
package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// recorder is a processor that keeps the first request it gets.
type recorder struct {
	ppb.UnimplementedProcessorServer
	got chan *ppb.MessageRequest
}

func (r *recorder) ProcessMessage(_ context.Context, req *ppb.MessageRequest) (*ppb.MessageResponse, error) {
	select {
	case r.got <- req:
	default:
	}
	return &ppb.MessageResponse{Message: &pb.SIPMessage{
		MessageType:  &pb.SIPMessage_ResponseType{ResponseType: pb.ResponseType_OK},
		ReasonPhrase: "OK",
	}}, nil
}

// The standalone EdgePort read Routr 2's variables over its file until #574
// (ROUTR3.md § 7): the file's values are what every message request carries.
func TestTheFileWinsOverTheRoutr2Environment(t *testing.T) {
	t.Setenv("EXTERNAL_ADDRS", "9.9.9.9")
	t.Setenv("LOCALNETS", "9.0.0.0/8")
	t.Setenv("ALIASES", "env.example.com")
	t.Setenv("HOSTNAME", "env-host")

	lis, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := grpc.NewServer()
	proc := &recorder{got: make(chan *ppb.MessageRequest, 1)}
	ppb.RegisterProcessorServer(srv, proc)
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)

	udp, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := udp.LocalAddr().(*net.UDPAddr).Port
	_ = udp.Close()

	path := filepath.Join(t.TempDir(), "edgeport.yaml")
	if err := os.WriteFile(path, []byte(fmt.Sprintf(`
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-file
spec:
  processor:
    addr: %s
  methods: [MESSAGE]
  externalAddrs: [203.0.113.10]
  localnets: [10.0.0.0/8]
  aliases: [sip.example.com]
  transport:
    - protocol: udp
      port: %d
      bindAddr: 127.0.0.1
`, lis.Addr().String(), port)), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CONFIG_PATH", path)
	cfg, err := loadConfig()
	if err != nil {
		t.Fatal(err)
	}
	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	ep, err := newEdgePort(cfg, ppb.NewProcessorClient(conn), slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = ep.Start(ctx) }()
	time.Sleep(200 * time.Millisecond)

	uac, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer uac.Close()
	msg := fmt.Sprintf("MESSAGE sip:echo@127.0.0.1:%d SIP/2.0\r\nVia: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-e1\r\nMax-Forwards: 70\r\nFrom: <sip:a@127.0.0.1>;tag=1\r\nTo: <sip:echo@127.0.0.1>\r\nCall-ID: e1\r\nCSeq: 1 MESSAGE\r\nContent-Length: 0\r\n\r\n",
		port, uac.LocalAddr().(*net.UDPAddr).Port)
	if _, err := uac.WriteTo([]byte(msg), &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: port}); err != nil {
		t.Fatal(err)
	}
	select {
	case req := <-proc.got:
		if req.GetEdgePortRef() != "edgeport-file" || strings.Join(req.GetExternalAddrs(), ",") != "203.0.113.10" ||
			strings.Join(req.GetLocalnets(), ",") != "10.0.0.0/8" {
			t.Errorf("the file's values: ref %q, external %v, localnets %v", req.GetEdgePortRef(), req.GetExternalAddrs(), req.GetLocalnets())
		}
	case <-time.After(3 * time.Second):
		t.Fatal("the processor saw no request")
	}
}
