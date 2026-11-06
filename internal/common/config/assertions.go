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
package config

import (
	"errors"
	"strings"
)

// The checks of mods/edgeport/src/assertions.ts.

func isSecureProto(proto string) bool {
	return proto == "wss" || proto == "tls"
}

// assertHasSecurityContext requires spec.securityContext when a secure
// protocol (tls, wss) is configured.
func assertHasSecurityContext(spec *Spec) error {
	for _, t := range spec.Transport {
		if isSecureProto(t.Protocol) && spec.SecurityContext == nil {
			return errors.New("found at least one secure protocol which requires setting the .spec.securityContext")
		}
	}
	return nil
}

// assertNoDuplicatedProto allows one entry per protocol.
func assertNoDuplicatedProto(transports []Transport) error {
	seen := map[string]bool{}
	for _, t := range transports {
		if seen[t.Protocol] {
			return errors.New("found duplicated entries at .spec.transport")
		}
		seen[t.Protocol] = true
	}
	return nil
}

// assertNoDuplicatedPort: only udp and tcp may share a port.
func assertNoDuplicatedPort(transports []Transport) error {
	for _, t1 := range transports {
		proto := strings.ToUpper(t1.Protocol)
		if proto == "UDP" || proto == "TCP" {
			continue
		}
		count := 0
		for _, t2 := range transports {
			if t1.Port == t2.Port {
				count++
			}
		}
		if count > 1 {
			return errors.New("found the same port on more that one entry at .spec.transport")
		}
	}
	return nil
}
