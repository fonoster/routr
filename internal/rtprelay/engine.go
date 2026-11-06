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

package rtprelay

import "context"

// resultError is the "result" RTPEngine answers a failed command with.
const resultError = "error"

// Params are the keys of an NG command besides "command" itself.
type Params map[string]any

// Result is what the relay reads from RTPEngine's answer.
type Result struct {
	// Result is "ok", or "error" with ErrorReason set.
	Result      string
	ErrorReason string
	SDP         string
}

// Engine is the RTPEngine the relay drives; NewClient is the real one. An
// answer with result "error" is a Result, not an error: the query for an
// unknown call is how the relay tells a new call. An error is a command that
// got no answer.
type Engine interface {
	Query(ctx context.Context, params Params) (Result, error)
	Offer(ctx context.Context, params Params) (Result, error)
	Answer(ctx context.Context, params Params) (Result, error)
	Delete(ctx context.Context, params Params) (Result, error)
}
