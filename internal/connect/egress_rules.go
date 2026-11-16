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

package connect

import (
	"sync"
	"time"

	"github.com/dlclark/regexp2/v2"
)

const (
	// egressRuleTimeout bounds one rule against one number: the engine
	// backtracks, and the rules are written through the API.
	egressRuleTimeout = 100 * time.Millisecond
	// maxEgressRules bounds the cache. Past it the cache starts over, which
	// costs a compile per rule and nothing else.
	maxEgressRules = 4096
)

// compiledRule is a rule as compiled, or why it doesn't compile: a bad rule
// costs one compile, not one per call.
type compiledRule struct {
	re  *regexp2.Regexp
	err error
}

// ruleCache compiles each egress rule once. The rules are ECMAScript, as they
// were on Node, with a match timeout.
type ruleCache struct {
	mu    sync.RWMutex
	rules map[string]compiledRule
}

func newRuleCache() *ruleCache {
	return &ruleCache{rules: map[string]compiledRule{}}
}

func (c *ruleCache) compiled(rule string) compiledRule {
	c.mu.RLock()
	found, ok := c.rules[rule]
	c.mu.RUnlock()
	if ok {
		return found
	}
	re, err := regexp2.Compile(rule, regexp2.ECMAScript)
	if err == nil {
		re.MatchTimeout = egressRuleTimeout
	}
	found = compiledRule{re: re, err: err}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.rules) >= maxEgressRules {
		c.rules = map[string]compiledRule{}
	}
	c.rules[rule] = found
	return found
}

// match tells whether the rule matches the number. A rule that doesn't compile
// or times out is an error.
func (c *ruleCache) match(rule, number string) (bool, error) {
	found := c.compiled(rule)
	if found.err != nil {
		return false, found.err
	}
	return found.re.MatchString(number)
}
