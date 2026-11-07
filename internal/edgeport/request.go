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
	"strconv"
	"strings"

	"github.com/emiago/sipgo/sip"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
	"github.com/fonoster/routr/internal/common/sipconv"
)

// RequiresKnownDialog tells whether a request is forwarded by its Route set
// with no routing and no access checks, as Connect does anything with a To tag
// and every BYE and ACK. Such a request may only go where a dialog this EdgePort
// proxied goes, or anyone could relay through it. Routr 2 checked INVITE and
// REFER, and only that the dialog existed: a deliberate deviation. REGISTER
// never carries a To tag and CANCEL follows its INVITE.
func RequiresKnownDialog(req *sip.Request) bool {
	switch req.Method {
	case sip.REGISTER, sip.CANCEL:
		return false
	case sip.BYE, sip.ACK:
		return true
	}
	return hasToTag(req)
}

// requiresEstablishedDialog: a re-INVITE or a REFER starts something new, which
// a dialog not answered yet, or already over, can't do.
func requiresEstablishedDialog(req *sip.Request) bool {
	return (req.Method == sip.INVITE || req.Method == sip.REFER) && hasToTag(req)
}

// refreshesTargets: the Contact of any in-dialog request but these may change
// the dialog's remote target (RFC 3261 section 12.2, RFC 3311, RFC 6665).
func refreshesTargets(req *sip.Request) bool {
	return req.Method != sip.ACK && req.Method != sip.BYE
}

// CanSendResponse is GRPCSipListener.canSendResponse: a processor's response
// can't be sent for an ACK (RFC 3261 section 22.1) or a request without a
// server transaction.
func CanSendResponse(req *sip.Request, tx *ServerTx) bool {
	return req.Method != sip.ACK && tx != nil
}

// RegisterExpires is RequestHelper.getRegisterExpires: the Contact's expires
// parameter, else the Expires header, else 0.
func RegisterExpires(req *sip.Request) int {
	if c := req.Contact(); c != nil {
		if v, ok := c.Params.Get("expires"); ok {
			if n, err := strconv.Atoi(v); err == nil && n > -1 {
				return n
			}
		}
	}
	if h := req.GetHeader("Expires"); h != nil {
		if n, err := strconv.Atoi(strings.TrimSpace(h.Value())); err == nil {
			return n
		}
	}
	return 0
}

// onRequest is called by the transaction layer for every new request (a
// retransmission is absorbed by its transaction and never gets here). tx is nil
// for an ACK, which takes no transaction.
func (e *EdgePort) onRequest(req *sip.Request, tx *ServerTx) {
	callID := callIDOf(req)
	if tx != nil {
		tx.ctx, tx.span = e.startRequestSpan(req)
	}
	if !e.enqueue(callID, func() { e.processRequest(req, tx) }) && tx != nil {
		e.rejectOverload(tx, req)
	}
}

// processRequest is GRPCSipListener.processRequest.
func (e *EdgePort) processRequest(req *sip.Request, tx *ServerTx) {
	callID := callIDOf(req)
	ctx := e.traceContext(tx)
	if tx == nil {
		ctx = e.instantSpan(req)
	}

	if RequiresKnownDialog(req) && !e.knownDialogTarget(req, callID) {
		e.rejectUnknownDialog(tx, req)
		return
	}

	mreq, err := e.conv.MessageRequest(req, e.localPort(req))
	if err != nil {
		e.log.Debug("unable to convert the request", "callId", callID, "error", err)
		e.failSpan(tx, "unable to convert the request")
		e.abandon(tx)
		return
	}

	res, err := e.process(ctx, mreq)
	if err != nil {
		e.log.Debug("an exception occurred while processing request", "callId", callID, "error", err)
		// The dispatcher found no processor for this method. Answer rather than
		// drop it: 501 is RFC 3261's answer for a method the server does not
		// implement (section 21.5.2).
		if status.Code(err) == codes.NotFound && tx != nil {
			e.rejectNotImplemented(tx, req)
			return
		}
		// No routing decision was made and none will be: the caller is told now
		// instead of retransmitting for 32 s (RFC 3261 section 21.5.4). An ACK has
		// no answer.
		e.answerFailure(tx, req, sip.StatusServiceUnavailable)
		return
	}

	msg := res.GetMessage()
	headers := sipconv.HeadersFromDTO(msg)
	_, isRequest := msg.GetMessageType().(*pb.SIPMessage_RequestUri)

	switch {
	case isRequest && req.Method == sip.INVITE:
		e.events.CallStarted(res, mreq.GetMessage().GetFrom())
	case isRequest && req.Method == sip.CANCEL:
		e.events.CallEnded(res)
	case !isRequest && req.Method == sip.REGISTER && msg.GetResponseType() == pb.ResponseType_OK:
		e.events.Registration(mreq, RegisterExpires(req))
	}

	if !isRequest {
		if !CanSendResponse(req, tx) {
			e.log.Debug("dropping the processor's response", "method", req.Method, "callId", callID)
			return
		}
		var contentType sip.Header
		for _, h := range headers {
			if strings.EqualFold(h.Name(), "Content-Type") {
				contentType = h
				break
			}
		}
		if contentType == nil {
			contentType = req.GetHeader("Content-Type")
		}
		e.sendResponse(tx, msg, headers, contentType)
		return
	}

	body := req.Body()
	if msg.GetBody() != "" {
		body = []byte(msg.GetBody())
	}

	if req.Method == sip.CANCEL {
		e.sendCancel(tx, req)
		return
	}
	e.sendRequest(tx, req, sipconv.RequestURIFromDTO(msg.GetRequestUri()), body, headers)
}

// knownDialogTarget tells whether an in-dialog request is on a dialog this
// EdgePort proxied, toward one of its targets. A peer EdgePort's request needs
// nothing else: both EdgePorts see the INVITE and its answers.
func (e *EdgePort) knownDialogTarget(req *sip.Request, callID string) bool {
	if requiresEstablishedDialog(req) && !e.txm.HasDialog(callID) {
		return false
	}
	_, target := e.txm.IsDialogTarget(callID, req.Recipient)
	return target
}

// rejectOverload answers 503 to a request a limit won't take: the answer RFC
// 3261 section 21.5.4 has for a server that can't handle one for now.
func (e *EdgePort) rejectOverload(tx *ServerTx, req *sip.Request) {
	if tx == nil {
		return
	}
	res := NewResponse(req, sip.StatusServiceUnavailable, ReasonPhrase(503))
	if err := e.respond(tx, res); err != nil {
		e.log.Debug("an exception occurred while answering 503", "error", err)
	}
}

func (e *EdgePort) rejectNotImplemented(tx *ServerTx, req *sip.Request) {
	e.log.Warn("no processor accepts "+string(req.Method)+" requests, answering 501",
		"callId", callIDOf(req))
	if err := e.respond(tx, NewResponse(req, sip.StatusNotImplemented, ReasonPhrase(501))); err != nil {
		e.log.Debug("an exception occurred while answering 501", "error", err)
	}
}

// rejectUnknownDialog answers 481 to an in-dialog request for a dialog this
// EdgePort did not proxy or toward an address that isn't one of its targets. An
// ACK gets no answer (RFC 3261 section 17).
func (e *EdgePort) rejectUnknownDialog(tx *ServerTx, req *sip.Request) {
	if tx == nil {
		e.log.Debug("dropping an in-dialog "+string(req.Method)+" for a dialog or target this edgeport did not proxy",
			"callId", callIDOf(req))
		return
	}
	e.log.Warn("rejecting in-dialog "+string(req.Method)+" for a dialog or target this edgeport did not proxy",
		"callId", callIDOf(req))
	res := NewResponse(req, sip.StatusCallTransactionDoesNotExists, ReasonPhrase(481))
	if err := e.respond(tx, res); err != nil {
		e.log.Debug("an exception occurred while rejecting an unknown dialog", "error", err)
	}
}

// sendResponse is GRPCSipListener.sendResponse: the processor answers the
// request itself.
func (e *EdgePort) sendResponse(tx *ServerTx, msg *pb.SIPMessage, headers []sip.Header,
	contentType sip.Header) {
	req := tx.Origin()
	code := sipconv.CodeOf(msg.GetResponseType())
	if code < 100 {
		e.log.Debug("the processor answered with no status code", "callId", callIDOf(req))
		e.abandon(tx)
		return
	}
	res := BuildAnswer(req, code, msg, headers, contentType)
	if req.Method == sip.INVITE && code >= 200 && code < 300 {
		// A processor that takes the call itself holds a dialog too
		e.recordRequestTargets(callIDOf(req), true, req, res.GetHeaders("Contact"), res.GetHeaders("Record-Route"))
		e.txm.RecordDialog(callIDOf(req))
	}
	if err := e.respond(tx, res); err != nil {
		e.log.Debug("unable to send the processor's response", "callId", callIDOf(req), "error", err)
	}

	// A processor that answers a CANCEL itself names the destination in
	// x-request-uri (user,host,port); the CANCEL goes there.
	callID := callIDOf(req)
	client := e.txm.ClientTransaction(callID)
	server := e.txm.ServerTransaction(callID)
	if req.Method != sip.CANCEL || client == nil {
		return
	}
	var target string
	for _, h := range headers {
		if strings.EqualFold(h.Name(), "x-request-uri") {
			target = h.Value()
		}
	}
	parts := strings.Split(target, ",")
	if len(parts) < 3 {
		return
	}
	cancel := NewCancel(client.Origin())
	cancel.Recipient = sip.Uri{Scheme: "sip", User: parts[0], Host: parts[1]}
	if port, err := strconv.Atoi(parts[2]); err == nil && port > 0 {
		cancel.Recipient.Port = port
	}
	if client.holdCancel(cancel) {
		e.startCancel(client, cancel)
	}
	if server != nil {
		terminated := NewResponse(server.Origin(), sip.StatusRequestTerminated, ReasonPhrase(487))
		_ = e.respond(server, terminated)
	}
}

// BuildAnswer is the response GRPCSipListener.sendResponse makes from the
// processor's reply: JAIN-SIP's response to the request, the processor's
// headers attached, its body when there is a Content-Type for it, and its
// reason phrase, even when that is empty.
func BuildAnswer(req *sip.Request, code int, msg *pb.SIPMessage, headers []sip.Header,
	contentType sip.Header) *sip.Response {
	base := NewResponse(req, code, ReasonPhrase(code))
	all := AttachHeaders(base.Headers(), headers)
	var body []byte
	if msg.GetBody() != "" && contentType != nil {
		all = withoutHeaders(all, "Content-Type")
		all = append(all, sip.HeaderClone(contentType))
		body = []byte(msg.GetBody())
	}
	return rebuildResponse(base, msg.GetReasonPhrase(), all, body)
}

// BuildForwardedRequest is RequestUpdater.updateRequest: the request with the
// processor's Request-URI and headers only. Content-Length is computed and
// x-gateway-auth is never sent.
func BuildForwardedRequest(req *sip.Request, ruri sip.Uri, body []byte, headers []sip.Header) *sip.Request {
	out := sip.NewRequest(req.Method, ruri)
	out.SipVersion = req.SipVersion
	var forwarded []sip.Header
	for _, h := range headers {
		if strings.EqualFold(h.Name(), "Content-Length") || strings.EqualFold(h.Name(), gatewayAuthHeader) {
			continue
		}
		forwarded = append(forwarded, h)
	}
	for _, h := range JoinListHeaders(AttachHeaders(nil, forwarded)) {
		out.AppendHeader(h)
	}
	out.SetBody(body)
	return out
}

// sendRequest is GRPCSipListener.sendRequest (with RequestUpdater): the
// request goes out with the processor's headers only.
func (e *EdgePort) sendRequest(tx *ServerTx, req *sip.Request, ruri sip.Uri, body []byte,
	headers []sip.Header) {
	callID := callIDOf(req)

	out := BuildForwardedRequest(req, ruri, body, headers)

	// A proxy-initiated authentication retry raised this dialog's CSeq on the
	// downstream leg alone; every later request on it carries the same offset
	if offset := e.txm.CSeqOffset(callID); offset > 0 {
		if cseq := out.CSeq(); cseq != nil {
			e.txm.RecordOriginalCSeq(callID, cseq.MethodName, cseq.SeqNo)
			cseq.SeqNo += uint32(offset)
		}
	}

	via := out.Via()
	if via == nil {
		e.log.Debug("the processor's request has no Via", "callId", callID)
		e.abandon(tx)
		return
	}
	if via.Params == nil {
		via.Params = sip.NewParams()
	}
	e.route(out)

	if RequiresKnownDialog(req) {
		// The Request-URI was checked before the processor; the Route decides
		// where this goes, and only the dialog's own Route set may
		if route, ok := topRoute(out); ok {
			if _, target := e.txm.IsDialogTarget(callID, route); !target {
				e.rejectUnknownDialog(tx, req)
				return
			}
		}
	}
	if create := req.Method == sip.INVITE && !hasToTag(req); create || (RequiresKnownDialog(req) && refreshesTargets(req)) {
		if create && !e.txm.CanCreateDialog(callID) {
			e.overflowed(overflowDialogs)
			e.rejectOverload(tx, req)
			return
		}
		e.recordRequestTargets(callID, create, req, out.GetHeaders("Contact"), out.GetHeaders("Record-Route"))
	}

	e.forwardTraceContext(tx, out)

	if out.IsAck() {
		if b, ok := via.Params.Get("branch"); !ok || b == "" {
			via.Params.Add("branch", statelessBranch(req))
		}
		if err := e.sendStateless(out); err != nil {
			e.log.Debug("an exception occurred while sending request", "callId", callID, "error", err)
		}
		return
	}

	if b, ok := via.Params.Get("branch"); !ok || b == "" {
		via.Params.Add("branch", newBranch())
	}

	creds, err := CredentialsFromHeaders(headers, out.Recipient.Host)
	if err != nil {
		e.log.Warn(err.Error(), "callId", callID)
		e.abandon(tx)
		return
	}

	ctx, err := e.newClientTransaction(out, callID, tx, creds)
	if err != nil {
		// A full table, a name that doesn't resolve, a connection refused, a first
		// write that failed: no next hop took it (RFC 3261 section 16.7, step 6)
		e.log.Debug("an exception occurred while sending request", "callId", callID, "error", err)
		e.answerFailure(tx, req, sip.StatusServiceUnavailable)
		return
	}
	e.txm.PutTransactions(callID, ctx, tx)
}

// recordRequestTargets records the Contact of the request, as it came and as the
// processor left it, which is what the far end answers to, and the Record-Route
// that goes with it.
func (e *EdgePort) recordRequestTargets(callID string, create bool, req *sip.Request, headers ...[]sip.Header) {
	uris := addressURIs(req.GetHeaders("Contact"))
	for _, list := range headers {
		uris = append(uris, addressURIs(list)...)
	}
	e.txm.RecordDialogTargets(callID, create, uris...)
}

// sendCancel is GRPCSipListener.sendCancel, for a CANCEL that matched no
// INVITE transaction here (one that matches is answered by the transaction
// layer and handled by processCancel).
func (e *EdgePort) sendCancel(tx *ServerTx, req *sip.Request) {
	callID := callIDOf(req)
	e.txm.MarkCancelled(callID)
	client := e.txm.ClientTransaction(callID)
	server := e.txm.ServerTransaction(callID)
	if client == nil || server == nil || tx == nil {
		e.log.Debug("no transaction to cancel", "callId", callID)
		e.abandon(tx)
		return
	}
	_ = e.respond(tx, NewResponse(req, sip.StatusOK, ReasonPhrase(200)))
	e.forwardCancel(client)
	_ = e.respond(server, NewResponse(server.Origin(), sip.StatusRequestTerminated, ReasonPhrase(487)))
}

// forwardCancel sends a CANCEL for the INVITE of a client transaction. It
// copies the CSeq of the INVITE on this leg, which RFC 3261 section 9.1 asks
// them to match on, so a proxy-auth retry's offset is kept.
func (e *EdgePort) forwardCancel(client *ClientTx) {
	cancel := NewCancel(client.Origin())
	if client.holdCancel(cancel) {
		e.startCancel(client, cancel)
	}
}

// startCancel sends a CANCEL to where its INVITE went.
func (e *EdgePort) startCancel(client *ClientTx, cancel *sip.Request) {
	if _, err := e.txl.cancel(client, cancel); err != nil {
		e.log.Debug("an exception occurred while sending a CANCEL request", "callId", client.info.callID, "error", err)
	}
}

// processCancel runs when the caller cancels an INVITE this EdgePort holds a
// transaction for. The transaction layer has already answered the CANCEL with
// 200 and the INVITE with 487, as GRPCSipListener.sendCancel does; what is left
// is to tell the processor and cancel the INVITE downstream.
func (e *EdgePort) processCancel(cancel *sip.Request, invite *ServerTx) {
	callID := callIDOf(cancel)
	mreq, err := e.conv.MessageRequest(cancel, e.localPort(cancel))
	if err != nil {
		e.log.Debug("unable to convert the CANCEL", "callId", callID, "error", err)
		return
	}
	res, err := e.process(e.instantSpan(cancel), mreq)
	if err != nil {
		e.log.Debug("an exception occurred while processing a CANCEL", "callId", callID, "error", err)
		return
	}
	if _, isRequest := res.GetMessage().GetMessageType().(*pb.SIPMessage_RequestUri); !isRequest {
		return
	}
	e.events.CallEnded(res)
	client := e.txm.ClientTransaction(callID)
	if client == nil || client.Origin().Method != sip.INVITE {
		e.log.Debug("no transaction to cancel", "callId", callID)
		return
	}
	e.forwardCancel(client)
}
