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

	"google.golang.org/grpc/metadata"

	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/trace"
)

// runProcessor finds the processor for the request and forwards it. The
// result is the request with the processor's sender, message and metadata
// (the `{ ...request, ...result }` of run_processor.ts), so the post
// middlewares still see the request's own fields.
//
// Two outcomes are the Node dispatcher's, kept for wire parity:
//   - UNAVAILABLE from the processor becomes ProcessorUnavailableError.
//   - Any other status is swallowed and the request itself is the result,
//     so the EdgePort gets its own message back.
func (d *Dispatcher) runProcessor(ctx context.Context, request *processor.MessageRequest, hops *hopCollector) (*processor.MessageRequest, error) {
	matchStartedAt := hops.start()
	p, err := findProcessor(d.processors, request)
	if err != nil {
		hops.addError("dispatcher", trace.HopDispatcher, matchStartedAt, statusMessage(err))
		return nil, err
	}
	hops.addMatched(matchStartedAt)
	d.log.Debug("forwarding request to processor", "ref", request.GetRef(), "processorRef", p.ref)

	startedAt := hops.start()
	var header metadata.MD
	res, err := p.client.ProcessMessage(ctx, request, hops.callOptions(&header)...)
	if err != nil {
		if isUnavailable(err) {
			unavailable := errProcessorUnavailable(p.ref)
			hops.addError(p.ref, trace.HopProcessor, startedAt, statusMessage(unavailable))
			return nil, unavailable
		}
		d.log.Warn("processor failed; returning the request unchanged, as the Node dispatcher did",
			"ref", request.GetRef(), "processorRef", p.ref, "error", err)
		hops.addCall(p.ref, trace.HopProcessor, header, startedAt, request.GetMessage(), request.GetMessage(), request.GetMetadata())
		return cloneRequest(request), nil
	}
	hops.addCall(p.ref, trace.HopProcessor, header, startedAt, request.GetMessage(), res.GetMessage(), res.GetMetadata())

	result := cloneRequest(request)
	result.Sender = res.GetSender()
	result.Message = res.GetMessage()
	result.Metadata = res.GetMetadata()
	return result, nil
}
