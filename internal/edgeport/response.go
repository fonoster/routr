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
	"strings"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/sipconv"
)

func hasMethod(res *sip.Response, methods ...sip.RequestMethod) bool {
	cseq := res.CSeq()
	if cseq == nil {
		return false
	}
	for _, m := range methods {
		if cseq.MethodName == m {
			return true
		}
	}
	return false
}

// IsStackJob is ResponseHelper.isStackJob: 100 Trying, 487 Request Terminated
// and the responses to CANCEL are the stack's business and not relayed.
func IsStackJob(res *sip.Response) bool {
	return res.StatusCode == sip.StatusTrying || res.StatusCode == sip.StatusRequestTerminated ||
		hasMethod(res, sip.CANCEL)
}

// isTransactional is ResponseHelper.isTransactional.
func isTransactional(tx *sip.ClientTx, res *sip.Response) bool {
	return tx != nil && hasMethod(res, sip.INVITE, sip.MESSAGE, sip.REGISTER)
}

// onStrayResponse gets the responses no client transaction matched, such as a
// 2xx retransmitted after its transaction ended. They are relayed statelessly.
func (e *EdgePort) onStrayResponse(res *sip.Response) {
	e.queue.Run(callIDOf(res), func() { e.processResponse(res, nil) })
}

// processResponse is GRPCSipListener.processResponse. tx is the client
// transaction the response arrived on, or nil.
func (e *EdgePort) processResponse(res *sip.Response, tx *sip.ClientTx) {
	if IsStackJob(res) {
		return
	}
	callID := callIDOf(res)

	body := res.Body()
	headers := cloneHeaders(res.Headers())
	if e.env.StripSessionProgressSdp && res.StatusCode == sip.StatusSessionInProgress {
		body = nil
		headers = withoutHeaders(headers, "Content-Type")
	}
	in := rebuildResponse(res, res.Reason, headers, body)
	in.SetSource(res.Source())
	in.SetTransport(res.Transport())

	transactional := isTransactional(tx, in)
	if transactional && isAuthChallenge(in) {
		if info := e.clientInfo(tx); info != nil && info.creds != nil {
			if e.callerGaveUp(tx, callID) {
				e.log.Debug("not authenticating; the caller's transaction is already over", "callId", callID)
				return
			}
			e.log.Debug("authenticating on behalf of the caller", "callId", callID)
			if retry := e.handleAuthChallenge(in, tx, info); retry != nil {
				info.replaced.Store(true)
				e.txm.UpdateClientTransaction(callID, tx, retry)
				e.txm.RecordAuthenticated(callID)
			}
			return
		}
	}

	mreq, err := e.conv.MessageRequest(in, e.localPort(in))
	if err != nil {
		e.log.Debug("unable to convert the response", "callId", callID, "error", err)
		return
	}
	reply, err := e.process(mreq)
	if err != nil {
		e.log.Debug("an exception occurred while processing response", "callId", callID, "error", err)
		return
	}
	msg := reply.GetMessage()
	added := sipconv.HeadersFromDTO(msg)

	// A failed re-INVITE leaves the call up (RFC 3261 section 14.1)
	reInvite := transactional && hasMethod(in, sip.INVITE) && hasToTag(tx.Origin())
	if hasMethod(in, sip.BYE) || (hasMethod(in, sip.INVITE) && in.StatusCode > 300 && !reInvite) {
		e.events.CallEnded(reply)
	}

	outBody := in.Body()
	if msg.GetBody() != "" {
		outBody = []byte(msg.GetBody())
	}
	all := RelayedHeaders(in, added)

	// Before the caller can act on this response. Only from a response to a
	// request this EdgePort sent: what matches no transaction, anyone can send
	if tx != nil {
		e.recordResponseTargets(in, all, callID)
		e.recordDialogIfEstablished(in, callID)
	}

	// Answer on the server transaction of the request this response belongs to,
	// found through the client transaction it arrived on
	server := e.txm.ServerTransactionFor(tx)
	if server == nil && transactional {
		server = e.txm.ServerTransaction(callID)
	}

	if server != nil {
		original := server.Origin()
		// A response must echo the caller's own From, To and CSeq (RFC 3261
		// section 8.2.6.2), which the Trunk or a proxy-auth retry changed
		all = RestoreIdentity(all, original)
		if cseq := original.CSeq(); cseq != nil {
			all = ReplaceCSeq(all, cseq)
		}
		out := rebuildResponse(in, msg.GetReasonPhrase(), all, outBody)
		if err := e.respond(server, out); err != nil {
			e.log.Debug("an exception occurred while relaying a response", "callId", callID, "error", err)
		}
	} else {
		out := rebuildResponse(in, msg.GetReasonPhrase(), all, outBody)
		if out.Via() != nil {
			e.restoreCallerCSeq(out, callID)
			if err := e.sendStatelessResponse(out); err != nil {
				e.log.Debug("an exception occurred while relaying a response", "callId", callID, "error", err)
			}
		}
	}

	if tx != nil {
		e.releaseDialogIfEnded(in, callID, reInvite)
	}
}

// recordResponseTargets records the Contact and the Record-Route of a response
// that may set or refresh a dialog's targets: any provisional or 2xx answer to
// an INVITE, for what is sent on an early dialog (PRACK, UPDATE), and the 2xx
// of anything else in-dialog but a BYE.
func (e *EdgePort) recordResponseTargets(res *sip.Response, relayed []sip.Header, callID string) {
	invite := hasMethod(res, sip.INVITE)
	if callID == "" || res.StatusCode >= 300 || (!invite && (res.StatusCode < 200 || hasMethod(res, sip.BYE))) {
		return
	}
	uris := addressURIs(res.GetHeaders("Contact"))
	uris = append(uris, addressURIs(res.GetHeaders("Record-Route"))...)
	for _, h := range relayed {
		if strings.EqualFold(h.Name(), "Contact") || strings.EqualFold(h.Name(), "Record-Route") {
			uris = append(uris, addressURIs([]sip.Header{h})...)
		}
	}
	e.txm.RecordDialogTargets(callID, invite, uris...)
}

// RelayedHeaders are the headers of a relayed response: the response's own,
// less Via, Contact, Route, Record-Route and WWW-Authenticate
// (ResponseHelper.removeHeadersToReplace), with the processor's attached.
func RelayedHeaders(in *sip.Response, added []sip.Header) []sip.Header {
	kept := withoutHeaders(in.Headers(), "Via", "Contact", "Route", "Record-Route", "WWW-Authenticate")
	return AttachHeaders(kept, added)
}

// restoreCallerCSeq puts back the caller's CSeq on a response relayed with no
// server transaction, from the number sendRequest recorded.
func (e *EdgePort) restoreCallerCSeq(res *sip.Response, callID string) {
	cseq := res.CSeq()
	if cseq == nil || callID == "" {
		return
	}
	seq, ok := e.txm.OriginalCSeq(callID, cseq.MethodName)
	if !ok {
		return
	}
	cseq.SeqNo = seq
	if res.StatusCode >= 200 {
		e.txm.RemoveOriginalCSeq(callID, cseq.MethodName)
	}
}

func (e *EdgePort) recordDialogIfEstablished(res *sip.Response, callID string) {
	if callID != "" && hasMethod(res, sip.INVITE) && res.StatusCode >= 200 && res.StatusCode < 300 {
		e.txm.RecordDialog(callID)
	}
}

// releaseDialogIfEnded drops the dialog's state once an answered BYE or a
// failed INVITE (not a re-INVITE) ends it.
func (e *EdgePort) releaseDialogIfEnded(res *sip.Response, callID string, reInvite bool) {
	if res.StatusCode < 200 || callID == "" {
		return
	}
	ended := hasMethod(res, sip.BYE) || (hasMethod(res, sip.INVITE) && res.StatusCode >= 300 && !reInvite)
	if ended {
		e.txm.RemoveDialog(callID)
	}
}

// callerGaveUp: the caller cancelled, or its transaction already got a final
// response. A challenge then must not be answered: the retry would start a call
// nobody is waiting for.
func (e *EdgePort) callerGaveUp(tx *sip.ClientTx, callID string) bool {
	if callID != "" && e.txm.IsCancelled(callID) {
		return true
	}
	server := e.txm.ServerTransactionFor(tx)
	if server == nil && callID != "" {
		server = e.txm.ServerTransaction(callID)
	}
	if server == nil {
		return false
	}
	return e.finalSent(server)
}

// handleAuthChallenge is AuthenticationHandler.handleAuthChallenge (JAIN-SIP's
// AuthenticationHelperImpl.handleChallenge): the challenged request again, with
// CSeq + 1, a new branch and an answer to each challenge it can answer.
func (e *EdgePort) handleAuthChallenge(res *sip.Response, tx *sip.ClientTx, info *clientInfo) *sip.ClientTx {
	origin := tx.Origin()
	retry := origin.Clone()
	retry.RemoveHeader("Authorization")
	retry.RemoveHeader("Proxy-Authorization")
	for retry.GetHeader("Authorization") != nil {
		retry.RemoveHeader("Authorization")
	}
	for retry.GetHeader("Proxy-Authorization") != nil {
		retry.RemoveHeader("Proxy-Authorization")
	}
	if cseq := retry.CSeq(); cseq != nil {
		cseq.SeqNo++
	}
	if via := retry.Via(); via != nil {
		via.Params.Add("branch", newBranch())
	}

	challengeName, answerName := "WWW-Authenticate", "Authorization"
	if res.StatusCode == sip.StatusProxyAuthRequired {
		challengeName, answerName = "Proxy-Authenticate", "Proxy-Authorization"
	}
	var challenges []string
	for _, h := range res.GetHeaders(challengeName) {
		challenges = append(challenges, h.Value())
	}
	if len(challenges) == 0 {
		e.log.Debug("challenge without "+challengeName, "callId", info.callID)
		return nil
	}
	uri := retry.Recipient.String()
	for _, c := range SupportedChallenges(challenges) {
		answer, err := DigestAuthorization(c, info.creds, string(retry.Method), uri, retry.Body(), "")
		if err != nil {
			e.log.Debug("unable to answer the challenge", "callId", info.callID, "error", err)
			return nil
		}
		retry.AppendHeader(sip.NewHeader(answerName, answer))
	}
	retry.SetTransport(origin.Transport())
	retry.SetDestination(origin.Destination())
	retry.Laddr = origin.Laddr

	next, err := e.newClientTransaction(retry)
	if err != nil {
		e.log.Debug("an exception occurred while handling authentication challenge",
			"callId", info.callID, "error", err)
		return nil
	}
	e.trackClient(next, info.callID, info.server, info.creds)
	return next
}
