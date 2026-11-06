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
package sipconv

import (
	"fmt"
	"net"
	"strconv"
	"strings"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// Converter builds the processor's MessageRequest, as MessageConverter does.
type Converter struct {
	EdgePortRef     string
	EdgePortVersion string
	ListeningPoints []*ppb.NetInterface
	ExternalAddrs   []string
	Localnets       []string
	Aliases         []string
	// BindAddr is the stack's address; received_on stays empty when it is a
	// wildcard, which names no interface (MessageConverter.getReceivedOn)
	BindAddr string
}

// TransportOf maps a transport name (UDP, tcp, ...) to the enum.
func TransportOf(name string) (common.Transport, error) {
	v, ok := common.Transport_value[strings.ToUpper(name)]
	if !ok {
		return common.Transport_UDP, fmt.Errorf("unknown transport %q", name)
	}
	return common.Transport(v), nil
}

// MethodOf maps a SIP method to the processor's enum; the Java EdgePort fails
// on a method the enum does not list.
func MethodOf(method string) (ppb.Method, error) {
	v, ok := ppb.Method_value[strings.ToUpper(method)]
	if !ok || v == int32(ppb.Method_UNKNOWN) {
		return ppb.Method_UNKNOWN, fmt.Errorf("unsupported method %q", method)
	}
	return ppb.Method(v), nil
}

// senderFromVia is getSenderFromVia: the sent-by of the top Via.
func senderFromVia(v *sip.ViaHeader) (*ppb.NetInterface, error) {
	if v == nil {
		return &ppb.NetInterface{}, nil
	}
	t, err := TransportOf(v.Transport)
	if err != nil {
		return nil, err
	}
	port := int32(-1)
	if v.Port > 0 {
		port = int32(v.Port)
	}
	return &ppb.NetInterface{Host: v.Host, Port: port, Transport: t}, nil
}

// senderFromResponse is getSenderFromResponse: the packet's source address and
// the transport of the top Via.
func senderFromResponse(res *sip.Response) (*ppb.NetInterface, error) {
	host, portStr, err := net.SplitHostPort(res.Source())
	if err != nil {
		return nil, fmt.Errorf("invalid source %q: %w", res.Source(), err)
	}
	port, _ := strconv.Atoi(portStr)
	transport := res.Transport()
	if v := res.Via(); v != nil && v.Transport != "" {
		transport = v.Transport
	}
	t, err := TransportOf(transport)
	if err != nil {
		return nil, err
	}
	return &ppb.NetInterface{Host: host, Port: int32(port), Transport: t}, nil
}

func (c *Converter) receivedOn(msg sip.Message, localPort int) *ppb.NetInterface {
	ip := net.ParseIP(c.BindAddr)
	v := msg.Via()
	if ip == nil || ip.IsUnspecified() || v == nil || v.Transport == "" {
		return &ppb.NetInterface{}
	}
	t, err := TransportOf(v.Transport)
	if err != nil {
		return &ppb.NetInterface{}
	}
	return &ppb.NetInterface{Host: c.BindAddr, Port: int32(localPort), Transport: t}
}

// MessageRequest is MessageConverter.createMessageRequest. localPort is the
// port of the listening point the message arrived on.
func (c *Converter) MessageRequest(msg sip.Message, localPort int) (*ppb.MessageRequest, error) {
	var method string
	var sender *ppb.NetInterface
	var err error

	switch m := msg.(type) {
	case *sip.Request:
		method = string(m.Method)
		sender, err = senderFromVia(m.Via())
	case *sip.Response:
		cseq := m.CSeq()
		if cseq == nil {
			return nil, fmt.Errorf("response without CSeq")
		}
		method = string(cseq.MethodName)
		sender, err = senderFromResponse(m)
	default:
		return nil, fmt.Errorf("unsupported message type %T", msg)
	}
	if err != nil {
		return nil, err
	}

	callID := msg.CallID()
	if callID == nil {
		return nil, fmt.Errorf("message without Call-ID")
	}
	m, err := MethodOf(method)
	if err != nil {
		return nil, err
	}
	dto, err := MessageToDTO(msg)
	if err != nil {
		return nil, err
	}

	return &ppb.MessageRequest{
		Ref:             callID.Value(),
		EdgePortRef:     c.EdgePortRef,
		EdgePortVersion: c.EdgePortVersion,
		Method:          m,
		Sender:          sender,
		ListeningPoints: c.ListeningPoints,
		ExternalAddrs:   c.ExternalAddrs,
		Localnets:       c.Localnets,
		Aliases:         c.Aliases,
		Message:         dto,
		ReceivedOn:      c.receivedOn(msg, localPort),
	}, nil
}
