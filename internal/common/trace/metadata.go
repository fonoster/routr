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

import "strings"

// SplitMetadata is a component's response metadata, separated.
type SplitMetadata struct {
	// Hop holds the trace.* keys other than the flag, prefix removed
	Hop map[string]string
	// Rest holds everything the EdgePort may see
	Rest map[string]string
	// Flag is the value of trace.record, when a processor asked for the recording
	Flag string
}

// Split separates the trace keys of a response's metadata from the rest.
func Split(metadata map[string]string) SplitMetadata {
	var split SplitMetadata
	for key, value := range metadata {
		switch {
		case key == FlagMetadataKey:
			split.Flag = value
		case strings.HasPrefix(key, MetadataPrefix):
			if split.Hop == nil {
				split.Hop = map[string]string{}
			}
			split.Hop[strings.TrimPrefix(key, MetadataPrefix)] = value
		default:
			if split.Rest == nil {
				split.Rest = map[string]string{}
			}
			split.Rest[key] = value
		}
	}
	return split
}
