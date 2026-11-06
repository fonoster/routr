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
	"github.com/fonoster/routr/internal/common/pb/processor"
)

// compiledProcessor is a Binding ready to serve: its methods as a set, its
// matchFunc compiled.
type compiledProcessor struct {
	ref     string
	methods map[processor.Method]struct{}
	match   matchFunc
	client  processor.ProcessorClient
}

// hasMethod tells whether the processor accepts the request's method
// (find_processor.ts hasMethod).
func (p *compiledProcessor) hasMethod(req *processor.MessageRequest) bool {
	_, ok := p.methods[req.GetMethod()]
	return ok
}

// matches tells whether the processor takes the request: its method is
// enabled and its matchFunc says so (find_processor.ts filter). The
// matchFunc only runs when the method matches, as in Node.
func (p *compiledProcessor) matches(req *processor.MessageRequest) (bool, error) {
	if !p.hasMethod(req) {
		return false, nil
	}
	ok, err := p.match(req)
	if err != nil {
		return false, errMatchFuncFailed(p.ref, err)
	}
	return ok, nil
}

// findProcessor returns the first processor, in config order, that takes
// the request, or NotMatchingProcessorFound (find_processor.ts).
func findProcessor(list []*compiledProcessor, req *processor.MessageRequest) (*compiledProcessor, error) {
	for _, p := range list {
		ok, err := p.matches(req)
		if err != nil {
			return nil, err
		}
		if ok {
			return p, nil
		}
	}
	return nil, errNotMatchingProcessor(req.GetRef())
}

// methodSet turns the method names of a binding into the set hasMethod
// uses. New already rejected unknown names.
func methodSet(names []string) map[processor.Method]struct{} {
	set := make(map[processor.Method]struct{}, len(names))
	for _, n := range names {
		if v, ok := processor.Method_value[n]; ok {
			set[processor.Method(v)] = struct{}{}
		}
	}
	return set
}
