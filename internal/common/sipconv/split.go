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
package sipconv

import "strings"

// SplitTopLevel splits a header value on sep, ignoring separators inside
// quotes or angle brackets, and trims each part. Empty parts are dropped.
func SplitTopLevel(value string, sep byte) []string {
	var parts []string
	inQuotes, inBrackets, escaped := false, false, false
	start := 0
	for i := 0; i < len(value); i++ {
		c := value[i]
		switch {
		case escaped:
			escaped = false
		case c == '\\' && inQuotes:
			escaped = true
		case c == '"':
			inQuotes = !inQuotes
		case c == '<' && !inQuotes:
			inBrackets = true
		case c == '>' && !inQuotes:
			inBrackets = false
		case c == sep && !inQuotes && !inBrackets:
			if part := strings.TrimSpace(value[start:i]); part != "" {
				parts = append(parts, part)
			}
			start = i + 1
		}
	}
	if part := strings.TrimSpace(value[start:]); part != "" {
		parts = append(parts, part)
	}
	return parts
}
