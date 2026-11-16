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
	"regexp"
	"time"

	"github.com/fonoster/routr/internal/common/pb/processor"
)

// matchFuncTimeout is the hard limit on one evaluation of a matchFunc. A
// function that runs longer is interrupted and the request fails with
// UNKNOWN, as a throwing matchFunc did in the Node dispatcher.
const matchFuncTimeout = 50 * time.Millisecond

// matchFunc tells whether a processor takes a request: the compiled form of
// ProcessorConfig.MatchFunc. It never sees the request itself, only a copy.
type matchFunc func(req *processor.MessageRequest) (bool, error)

// constantTrue recognizes the matchFunc every shipped config uses,
// `req => true`, in its spellings: an arrow with zero or one parameter, with
// or without parentheses, whose body is the literal true.
var constantTrue = regexp.MustCompile(`^\s*(?:\(\s*(?:[A-Za-z_$][A-Za-z0-9_$]*)?\s*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>\s*(?:true|\{\s*return\s+true\s*;?\s*\})\s*;?\s*$`)

// isConstantTrue tells whether src is a `req => true` arrow function.
func isConstantTrue(src string) bool {
	return constantTrue.MatchString(src)
}

// alwaysMatch is the compiled form of `req => true`.
func alwaysMatch(*processor.MessageRequest) (bool, error) {
	return true, nil
}
