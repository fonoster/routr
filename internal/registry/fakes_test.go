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
	"sync"

	"google.golang.org/grpc"

	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	requesterpb "github.com/fonoster/routr/internal/common/pb/requester"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// fakeTrunks is the Data API.
type fakeTrunks struct {
	trunks.TrunksClient
	items []*trunks.Trunk
	err   error

	mu       sync.Mutex
	requests []*trunks.FindByRequest
}

func (f *fakeTrunks) FindBy(_ context.Context, in *trunks.FindByRequest, _ ...grpc.CallOption) (*trunks.FindByResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.requests = append(f.requests, in)
	if f.err != nil {
		return nil, f.err
	}
	return &trunks.FindByResponse{Items: f.items}, nil
}

// fakeRequester answers by target; a target it doesn't know gets the default.
type fakeRequester struct {
	requesterpb.RequesterClient
	answers map[string]*requesterpb.SendMessageResponse
	errs    map[string]error
	// sent, when set, hears of every request, without blocking.
	sent chan struct{}

	mu       sync.Mutex
	requests map[string][]*requesterpb.SendMessageRequest
}

func (f *fakeRequester) SendMessage(_ context.Context, in *requesterpb.SendMessageRequest, _ ...grpc.CallOption) (*requesterpb.SendMessageResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.requests == nil {
		f.requests = map[string][]*requesterpb.SendMessageRequest{}
	}
	f.requests[in.GetTarget()] = append(f.requests[in.GetTarget()], in)
	if f.sent != nil {
		select {
		case f.sent <- struct{}{}:
		default:
		}
	}
	if err := f.errs[in.GetTarget()]; err != nil {
		return nil, err
	}
	if answer, ok := f.answers[in.GetTarget()]; ok {
		return answer, nil
	}
	return okResponse(3600), nil
}

func (f *fakeRequester) sentTo(target string) []*requesterpb.SendMessageRequest {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.requests[target]
}

// okResponse is a 200 with a Contact that carries expires.
func okResponse(expires int32) *requesterpb.SendMessageResponse {
	return &requesterpb.SendMessageResponse{Message: &sipmessage.SIPMessage{
		MessageType: &sipmessage.SIPMessage_ResponseType{ResponseType: sipmessage.ResponseType_OK},
		Contact:     &sipmessage.Contact{Expires: expires},
	}}
}

// testTrunk is a Trunk with outbound credentials and one URI.
func testTrunk(ref, host string, port int32) *trunks.Trunk {
	return &trunks.Trunk{
		Ref:                 ref,
		SendRegister:        true,
		OutboundCredentials: &credentials.Credentials{Username: "1001", Password: "1234"},
		Uris:                []*trunks.TrunkURI{{Host: host, Port: port, Transport: "UDP", User: "user1"}},
	}
}
