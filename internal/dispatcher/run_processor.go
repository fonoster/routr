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

	"github.com/fonoster/routr/internal/common/pb/processor"
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
func (d *Dispatcher) runProcessor(ctx context.Context, request *processor.MessageRequest) (*processor.MessageRequest, error) {
	p, err := findProcessor(d.processors, request)
	if err != nil {
		return nil, err
	}
	d.log.Debug("forwarding request to processor", "ref", request.GetRef(), "processorRef", p.ref)

	res, err := p.client.ProcessMessage(ctx, request)
	if err != nil {
		if isUnavailable(err) {
			return nil, errProcessorUnavailable(p.ref)
		}
		d.log.Warn("processor failed; returning the request unchanged, as the Node dispatcher did",
			"ref", request.GetRef(), "processorRef", p.ref, "error", err)
		return cloneRequest(request), nil
	}

	result := cloneRequest(request)
	result.Sender = res.GetSender()
	result.Message = res.GetMessage()
	result.Metadata = res.GetMetadata()
	return result, nil
}
