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

import "github.com/emiago/sipgo/sip"

// HeaderParsers keeps typed only the headers sipgo's transaction and transport
// layers read. The converter parses the others itself: sipgo's typed Route, for
// one, drops the header parameters (;r2=on) the processors are given.
func HeaderParsers() map[string]sip.HeaderParser {
	all := sip.DefaultHeadersParser()
	keep := map[string]sip.HeaderParser{}
	for _, name := range []string{"via", "v", "from", "f", "to", "t", "call-id", "i", "cseq",
		"contact", "m", "content-length", "l", "content-type", "c", "max-forwards"} {
		if p, ok := all[name]; ok {
			keep[name] = p
		}
	}
	return keep
}

// NewParser returns the SIP parser the EdgePort reads messages with.
func NewParser() *sip.Parser {
	return sip.NewParser(sip.WithHeadersParsers(HeaderParsers()))
}
