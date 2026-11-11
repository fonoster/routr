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
	"github.com/emiago/sipgo/sip"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
	"github.com/fonoster/routr/internal/common/sipconv"
)

// failoverTriedKey is the metadata key Connect answers an initial INVITE
// toward a Trunk with while another of its URIs remains: the URIs tried so
// far, the one it just chose included. The EdgePort only sends the value back.
const failoverTriedKey = "failover.tried"

// failoverState is what is known of an initial INVITE's other Trunk URIs.
type failoverState struct {
	// tried is the processor's failover.tried, empty when no URI remains
	tried string
	// retry: the request is a retry, on the first attempt's dialog
	retry bool
}

// failover moves an initial INVITE to the Trunk's next URI after the one it was
// sent to answered 503 or couldn't be reached (RFC 3263 section 4.3): it asks
// the processor again with the URIs tried, and sends what comes back on a new
// client transaction. previous is the transaction that failed, when it is
// still the call's. It runs in the call's queue.
//
// It reports whether the retry took the call over: sent, or answered by its
// own failure. False leaves the caller to the answer it would have got
// without it: no URI remains, the caller cancelled or already has its final
// response, or the processor gave no new request.
func (e *EdgePort) failover(server *ServerTx, previous *ClientTx, fo failoverState) bool {
	if fo.tried == "" || server == nil {
		return false
	}
	origin := server.Origin()
	if origin.Method != sip.INVITE || hasToTag(origin) {
		return false
	}
	callID := callIDOf(origin)
	if e.txm.IsCancelled(callID) || !server.awaitingFinal() {
		return false
	}

	// The caller's own INVITE, through the whole chain again: the processor
	// builds the message for the next URI, and nothing is taken from the
	// request the failed one got
	mreq, err := e.conv.MessageRequest(origin, e.localPort(origin))
	if err != nil {
		e.log.Debug("unable to convert the request for a failover", "callId", callID, "error", err)
		return false
	}
	mreq.Metadata = map[string]string{failoverTriedKey: fo.tried}
	res, err := e.process(e.traceContext(server), mreq)
	if err != nil {
		e.log.Debug("an exception occurred while asking for the next trunk uri", "callId", callID, "error", err)
		return false
	}
	msg := res.GetMessage()
	next := res.GetMetadata()[failoverTriedKey]
	// The same value back is the Dispatcher returning the request unchanged
	// after its processor failed: there is no route in it
	if _, isRequest := msg.GetMessageType().(*pb.SIPMessage_RequestUri); !isRequest || next == fo.tried {
		e.log.Debug("no next trunk uri", "callId", callID)
		return false
	}
	// The processor took its time: the caller may have gone meanwhile
	if e.txm.IsCancelled(callID) || !server.awaitingFinal() {
		return false
	}

	e.log.Info("trunk uri failed, moving the call to the next one", "callId", callID, "tried", fo.tried)
	if previous != nil {
		previous.info.replaced.Store(true)
	}
	body := origin.Body()
	if msg.GetBody() != "" {
		body = []byte(msg.GetBody())
	}
	client := e.sendRequest(server, origin, sipconv.RequestURIFromDTO(msg.GetRequestUri()), body,
		sipconv.HeadersFromDTO(msg), failoverState{tried: next, retry: true})
	if previous != nil && client != nil {
		e.txm.UpdateClientTransaction(callID, previous, client)
	}
	return true
}
