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

import "strings"

// traceMetadataPrefix marks the metadata a component sets for the trace
// recorder (mods/common/src/trace/types.ts); it never leaves the dispatcher.
const traceMetadataPrefix = "trace."

// withoutTraceMetadata returns a copy of metadata without any trace.* key, or
// nil when nothing is left (Trace.withoutTraceMetadata).
func withoutTraceMetadata(metadata map[string]string) map[string]string {
	if len(metadata) == 0 {
		return nil
	}
	rest := make(map[string]string, len(metadata))
	for k, v := range metadata {
		if !strings.HasPrefix(k, traceMetadataPrefix) {
			rest[k] = v
		}
	}
	if len(rest) == 0 {
		return nil
	}
	return rest
}
