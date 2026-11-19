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

import (
	"reflect"
	"testing"
)

// A carrier's Record-Route keeps the URI parameters the DTO has no field for:
// Twilio routes the ACK and BYE by r2 and twnat (RFC 3261 section 12.2.1.1).
func TestURIParametersSurvive(t *testing.T) {
	rr, err := RecordRouteToDTO("<sip:54.172.60.2;transport=tcp;r2=on;lr;twnat=sip:203.0.113.10:16514>")
	if err != nil {
		t.Fatal(err)
	}
	uri := rr.GetAddress().GetUri()
	want := map[string]string{"r2": "on", "twnat": "sip:203.0.113.10:16514"}
	if got := uri.GetParameters(); !reflect.DeepEqual(got, want) {
		t.Errorf("parameters = %v, want %v", got, want)
	}
	if !uri.GetLrParam() || uri.GetTransportParam() != "tcp" {
		t.Errorf("lr = %v, transport = %q", uri.GetLrParam(), uri.GetTransportParam())
	}
	got := EncodeRoute(rr.GetAddress(), rr.GetParameters())
	if want := "<sip:54.172.60.2;lr;transport=tcp;r2=on;twnat=sip:203.0.113.10:16514>"; got != want {
		t.Errorf("encoded = %s, want %s", got, want)
	}
}
