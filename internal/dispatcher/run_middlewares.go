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

package dispatcher

import (
	"context"
	"errors"

	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// middleware is a MiddlewareConfig ready to serve.
type middleware struct {
	ref           string
	addr          string
	postProcessor bool
	client        processor.ProcessorClient
}

// runMiddlewares sends the request through the middlewares of one stage
// (postProcessor false before the processor, true after), in config order.
// Each middleware sees the message the previous one returned; a middleware
// that returns a response ends the chain. The result is a new request; the
// one received is never changed (run_middlewares.ts runMiddlewares).
func (d *Dispatcher) runMiddlewares(ctx context.Context, request *processor.MessageRequest, postProcessor bool) (*processor.MessageRequest, error) {
	req := cloneRequest(request)
	for _, m := range d.middlewares {
		if m.postProcessor != postProcessor {
			continue
		}
		d.log.Debug("sending request to middleware",
			"ref", request.GetRef(), "middlewareRef", m.ref, "addr", m.addr,
			"postProcessor", m.postProcessor)
		res, err := m.client.ProcessMessage(ctx, req)
		if err != nil {
			if isUnavailable(err) {
				return nil, errMiddlewareUnavailable(m.ref)
			}
			return nil, errMiddlewareFailed(m.ref, err)
		}
		if res.GetMessage() == nil {
			return nil, errMiddlewareFailed(m.ref, errors.New("no message in the response"))
		}
		req.Message = res.GetMessage()
		if isResponse(req.GetMessage()) {
			d.log.Debug("found messageType to be responseType and broke the chain",
				"ref", request.GetRef(), "middlewareRef", m.ref, "addr", m.addr)
			break
		}
	}
	return req, nil
}

// isResponse tells whether the message is a SIP response (Helper.isTypeResponse).
func isResponse(msg *sipmessage.SIPMessage) bool {
	_, ok := msg.GetMessageType().(*sipmessage.SIPMessage_ResponseType)
	return ok
}

// isErrorResponse tells whether the request carries a response that is
// neither 200 OK nor 180 Ringing: such a message skips the middlewares and
// goes to the processor alone (processor.ts isErrorResponse).
func isErrorResponse(req *processor.MessageRequest) bool {
	msg := req.GetMessage()
	if !isResponse(msg) {
		return false
	}
	t := msg.GetResponseType()
	return t != sipmessage.ResponseType_OK && t != sipmessage.ResponseType_RINGING
}

// cloneRequest returns a new MessageRequest with the fields of the one given
// (the `{ ...request }` of the Node dispatcher). Nested messages are shared,
// never changed.
func cloneRequest(r *processor.MessageRequest) *processor.MessageRequest {
	return &processor.MessageRequest{
		Ref:             r.GetRef(),
		EdgePortRef:     r.GetEdgePortRef(),
		Method:          r.GetMethod(),
		Sender:          r.GetSender(),
		ListeningPoints: r.GetListeningPoints(),
		ExternalAddrs:   r.GetExternalAddrs(),
		Localnets:       r.GetLocalnets(),
		Message:         r.GetMessage(),
		Metadata:        r.GetMetadata(),
		EdgePortVersion: r.GetEdgePortVersion(),
		ReceivedOn:      r.GetReceivedOn(),
		Aliases:         r.GetAliases(),
	}
}
