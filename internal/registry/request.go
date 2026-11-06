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
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	commonpb "github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/processor"
	requesterpb "github.com/fonoster/routr/internal/common/pb/requester"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The values of a REGISTER that nothing configures, Routr 2's.
const (
	defaultMaxForwards = 70
	defaultExpires     = 600
	defaultUserAgent   = "Routr Connect v2"
	gatewayAuthHeader  = "X-Gateway-Auth"
	methodRegister     = "REGISTER"
)

// Auth is the pair X-Gateway-Auth carries.
type Auth struct {
	Username string
	Secret   string
}

// RequestParams is what a REGISTER is built from.
type RequestParams struct {
	User          string
	TrunkRef      string
	TargetDomain  string
	TargetAddress string
	ProxyAddress  string
	// Transport is the Trunk URI's, as the Data API spells it.
	Transport string
	// UserAgent defaults to defaultUserAgent.
	UserAgent string
	// Methods become one Allow header each.
	Methods []string
	// MaxForwards defaults to defaultMaxForwards.
	MaxForwards int32
	// Expires defaults to defaultExpires.
	Expires int32
	Secure  bool
	// Auth, when set, adds X-Gateway-Auth.
	Auth *Auth
}

// requestBuilder builds REGISTERs. It owns what they count across calls: the
// CSeq, and the clock of the tags and Call-IDs.
type requestBuilder struct {
	now func() time.Time

	mu       sync.Mutex
	nextCSeq uint64
	lastTime int64
}

func newRequestBuilder(now func() time.Time) *requestBuilder {
	return &requestBuilder{now: now, nextCSeq: 1}
}

// build makes the Requester's request for one REGISTER. The Requester adds
// the Via and the Contact, which name its own socket.
func (b *requestBuilder) build(params RequestParams) (*requesterpb.SendMessageRequest, error) {
	// A request that fails below has spent its CSeq, as in Routr 2
	cseq := b.takeCSeq()

	routeHost, routePort, err := splitAddress(params.ProxyAddress)
	if err != nil {
		return nil, err
	}
	targetHost, targetPort, err := splitAddress(params.TargetAddress)
	if err != nil {
		return nil, err
	}

	expires := params.Expires
	if expires == 0 {
		expires = defaultExpires
	}
	maxForwards := params.MaxForwards
	if maxForwards == 0 {
		maxForwards = defaultMaxForwards
	}

	return &requesterpb.SendMessageRequest{
		Target:    params.TargetAddress,
		Method:    processor.Method_REGISTER,
		Transport: transportOf(params.Transport),
		Message: &sipmessage.SIPMessage{
			MessageType: &sipmessage.SIPMessage_RequestUri{RequestUri: &sipmessage.SipURI{
				User:           params.User,
				Host:           targetHost,
				Port:           targetPort,
				TransportParam: params.Transport,
				MethodParam:    methodRegister,
				Secure:         params.Secure,
			}},
			Extensions: registerExtensions(params, cseq),
			Route: []*sipmessage.Route{{
				Address: &sipmessage.Address{Uri: &sipmessage.SipURI{
					Host:           routeHost,
					Port:           routePort,
					TransportParam: params.Transport,
					LrParam:        true,
				}},
			}},
			From: &sipmessage.From{
				Address: aorAddress(params),
				Tag:     b.newTag(),
			},
			To:            &sipmessage.To{Address: aorAddress(params)},
			CallId:        &sipmessage.CallID{CallId: b.newCallID()},
			ContentLength: &sipmessage.ContentLength{},
			Expires:       &sipmessage.Expires{Expires: expires},
			MaxForwards:   &sipmessage.MaxForwards{MaxForwards: maxForwards},
		},
	}, nil
}

// registerExtensions lists the headers the Requester copies as they are, in
// Routr 2's order.
func registerExtensions(params RequestParams, cseq uint64) []*sipmessage.Extension {
	userAgent := params.UserAgent
	if userAgent == "" {
		userAgent = defaultUserAgent
	}
	extensions := make([]*sipmessage.Extension, 0, len(params.Methods)+7)
	for _, method := range params.Methods {
		extensions = append(extensions, &sipmessage.Extension{Name: "Allow", Value: method})
	}
	extensions = append(extensions,
		&sipmessage.Extension{Name: "CSeq", Value: strconv.FormatUint(cseq, 10) + " " + methodRegister},
		&sipmessage.Extension{Name: "User-Agent", Value: userAgent},
		&sipmessage.Extension{Name: "Allow-Events", Value: "presence"},
		&sipmessage.Extension{Name: "Proxy-Require", Value: "gin"},
		&sipmessage.Extension{Name: "Require", Value: "gin"},
		&sipmessage.Extension{Name: "Supported", Value: "path"},
	)
	if params.Auth != nil {
		pair := params.Auth.Username + ":" + params.Auth.Secret
		extensions = append(extensions, &sipmessage.Extension{
			Name:  gatewayAuthHeader,
			Value: base64.StdEncoding.EncodeToString([]byte(pair)),
		})
	}
	return extensions
}

// aorAddress is the address From and To carry. Port -1 is "no port".
func aorAddress(params RequestParams) *sipmessage.Address {
	return &sipmessage.Address{Uri: &sipmessage.SipURI{
		User:           params.User,
		Host:           params.TargetDomain,
		Port:           -1,
		TransportParam: params.Transport,
		Secure:         params.Secure,
	}}
}

// transportOf maps a transport name to the enum. A name the enum doesn't
// have, lowercase included, is the enum's zero (UDP), as protobufjs left it
// for Routr 2.
func transportOf(name string) commonpb.Transport {
	return commonpb.Transport(commonpb.Transport_value[name])
}

// splitAddress reads a host:port address.
func splitAddress(address string) (string, int32, error) {
	parts := strings.Split(address, ":")
	if len(parts) != 2 {
		return "", 0, errors.New("malformated address; must be ${host}:${port}")
	}
	port, err := strconv.ParseInt(parts[1], 10, 32)
	if err != nil {
		return "", 0, fmt.Errorf("malformated address %s: expects port to be a number", address)
	}
	return parts[0], int32(port), nil
}

func (b *requestBuilder) takeCSeq() uint64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	cseq := b.nextCSeq
	b.nextCSeq++
	return cseq
}

// newTag is uniqid.time(): the clock in base 36, 8 characters until 2059.
func (b *requestBuilder) newTag() string {
	return strconv.FormatInt(b.nextTime(), 36)
}

// newCallID is uniqid() with random bytes where it had the MAC and the pid.
func (b *requestBuilder) newCallID() string {
	random := make([]byte, 5)
	_, _ = rand.Read(random) // crypto/rand.Read never fails
	return hex.EncodeToString(random) + strconv.FormatInt(b.nextTime(), 36)
}

// nextTime is the clock in milliseconds, moved along so no two calls get the
// same value.
func (b *requestBuilder) nextTime() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	t := b.now().UnixMilli()
	if t <= b.lastTime {
		t = b.lastTime + 1
	}
	b.lastTime = t
	return t
}
