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

package rtprelay

import (
	"testing"

	"github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/processor"
)

func TestDirectionFromARequest(t *testing.T) {
	got, err := directionOf(request(processor.Method_INVITE, offeredSDP))
	if err != nil || got != PhoneToPhone {
		t.Errorf("direction = %q, %v", got, err)
	}
}

func TestDirectionFromAResponse(t *testing.T) {
	// examples.ts: sent from WSS, top Via on TCP
	req := request(processor.Method_REGISTER, "")
	req.Sender.Transport = common.Transport_WSS
	req.Message.Via[0].Transport = "TCP"
	got, err := directionOf(req)
	if err != nil || got != WebToPhone {
		t.Errorf("direction = %q, %v", got, err)
	}
}

func TestDirectionFailsWithoutAVia(t *testing.T) {
	req := request(processor.Method_INVITE, offeredSDP)
	req.Message.Via = nil
	if _, err := directionOf(req); err == nil {
		t.Error("no Via must fail")
	}
}

func TestDirectionBetween(t *testing.T) {
	for _, c := range []struct {
		src, dst string
		want     Direction
	}{
		{"WS", "WSS", WebToWeb},
		{"WSS", "UDP", WebToPhone},
		{"TLS", "ws", PhoneToWeb},
		{"UDP", "TCP", PhoneToPhone},
	} {
		if got := directionBetween(c.src, c.dst); got != c.want {
			t.Errorf("%s to %s = %q, want %q", c.src, c.dst, got, c.want)
		}
	}
}

func TestIsSecurePhone(t *testing.T) {
	if !isSecurePhone("TLS") || !isSecurePhone("tls") || isSecurePhone("TCP") || isSecurePhone("") {
		t.Error("only TLS is a secure phone leg")
	}
}
