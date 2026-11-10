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

package processor

import (
	"strings"

	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The extension-header functions of mods/processor/src/extensions.ts. Like
// the alterations, the ones that change the request change it in place.

// HeaderValue is the value of the first extension header of that name,
// ignoring case; empty when absent.
func HeaderValue(req *MessageRequest, name string) string {
	for _, ext := range req.GetMessage().GetExtensions() {
		if strings.EqualFold(ext.GetName(), name) {
			return ext.GetValue()
		}
	}
	return ""
}

// AddHeader appends an extension header.
func AddHeader(req *MessageRequest, h Header) {
	req.Message.Extensions = append(req.Message.Extensions, &sipmessage.Extension{Name: h.Name, Value: h.Value})
}

// UpdateHeader sets the value of every extension header of exactly that
// name; the case counts, as it does in the Node twin.
func UpdateHeader(req *MessageRequest, h Header) {
	for _, ext := range req.GetMessage().GetExtensions() {
		if ext.GetName() == h.Name {
			ext.Value = h.Value
		}
	}
}

// RemoveHeader removes every extension header of exactly that name; the case
// counts, as it does in the Node twin. RemoveHeaders ignores it.
func RemoveHeader(req *MessageRequest, name string) {
	kept := req.Message.Extensions[:0:0]
	for _, ext := range req.Message.Extensions {
		if ext.GetName() != name {
			kept = append(kept, ext)
		}
	}
	req.Message.Extensions = kept
}
