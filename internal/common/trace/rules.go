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

package trace

import "sort"

// report records a finding of the rule being evaluated.
type report func(message string, side Side, header string)

// Rule is one check over a record and the earlier records of the same Call-ID,
// oldest first. In rctl the earlier records are the whole file up to this one;
// in the Dispatcher they are the configured window.
type Rule struct {
	ID       string
	Profile  Profile
	Severity Severity
	// Spec is the citation shown with the finding
	Spec string
	// Summary says what the rule checks, in one line
	Summary string
	check   func(record *Record, call []*Record, fail report)
}

// rules is every rule, in evaluation order (rules/index.ts).
var rules = []*Rule{
	ruleMaxForwards,
	ruleVia,
	ruleRecordRouteSelf,
	ruleRouteSelfRemoved,
	ruleCredentialsStripped,
	rulePrivateAddress,
	ruleRegisterOK,
	ruleCSeqACK,
	ruleCSeqMonotonic,
	ruleCancelMatches,
	ruleACK2xx,
	ruleRetransmission,
	rulePAISingle,
	rulePAIE164,
	ruleRequestURIE164,
	ruleFromE164OrAnonymous,
	rulePrivacy,
}

// Evaluate runs the rules of the given profiles on one record and returns the
// findings, errors first.
func Evaluate(record *Record, call []*Record, profiles []Profile) []Finding {
	findings := []Finding{}
	for _, rule := range rules {
		wanted := false
		for _, p := range profiles {
			if p == rule.Profile {
				wanted = true
				break
			}
		}
		if !wanted {
			continue
		}
		rule.check(record, call, func(message string, side Side, header string) {
			findings = append(findings, Finding{
				Rule:     rule.ID,
				Profile:  rule.Profile,
				Severity: rule.Severity,
				Spec:     rule.Spec,
				Message:  message,
				Side:     side,
				Header:   header,
			})
		})
	}
	sort.SliceStable(findings, func(i, j int) bool {
		return findings[i].Severity == SeverityError && findings[j].Severity != SeverityError
	})
	return findings
}
