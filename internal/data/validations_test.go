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

package data

import (
	"errors"
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

func TestValidators(t *testing.T) {
	long := strings.Repeat("a", 61)
	tests := []struct {
		name    string
		err     error
		message string
	}{
		{"hasReference", hasReference(""), "the reference to the resource is required"},
		{"hasName", hasName(""), "the friendly name for the resource is required"},
		{"isValidName empty", isValidName(""), "the friendly name must have less than 60 characters"},
		{"isValidName long", isValidName(long), "the friendly name must have less than 60 characters"},
		{"isValidName 60", isValidName(long[1:]), ""},
		{"isValidOptionalName absent", isValidOptionalName(nil), ""},
		{"hasUsername", hasUsername(""), "the username is required"},
		{"isValidUsername", isValidUsername("a b"), "the username must not contain spaces"},
		{"isValidUsername ok", isValidUsername("ab"), ""},
		{"hasPassword", hasPassword(""), "the password is required"},
		{"hasValidEgressRules none", hasValidEgressRules(nil), ""},
		{"hasValidEgressRules ok", hasValidEgressRules([]*domains.EgressPolicy{{Rule: ".*"}, {Rule: `^\+1\d{3}$`}}), ""},
		{"hasValidEgressRules bad", hasValidEgressRules([]*domains.EgressPolicy{{Rule: ".*"}, {Rule: "("}}), "the egressPolicies rule `(` is not a valid regular expression"},
		{"isValidDomainURI", isValidDomainURI("nodots"), "the domainUri must be a valid fully qualified domain name"},
		{"isValidDomainURI ok", isValidDomainURI("sip.local"), ""},
		{"hasTelURL", hasTelURL(""), "the telUrl is required"},
		{"isValidTelURL", isValidTelURL("+1"), "the telUrl must start with `tel:`"},
		{"isValidTelURL ok", isValidTelURL("tel:+1"), ""},
		{"isValidSessionAffinityHeader", isValidSessionAffinityHeader("X_A"), "the sessionAffinityHeader must be alphanumeric and without spaces"},
		{"isValidSessionAffinityHeader dash", isValidSessionAffinityHeader("X-A-"), "the sessionAffinityHeader must be alphanumeric and without spaces"},
		{"isValidSessionAffinityHeader empty", isValidSessionAffinityHeader(""), ""},
		{"hasValidHeaders value", hasValidHeaders([]*numbers.ExtraHeader{{Name: "X-A"}}), "the header value cannot be empty"},
		{"hasValidHeaders name", hasValidHeaders([]*numbers.ExtraHeader{{Name: "X A", Value: "b"}}), "the header must be alphanumeric and without spaces"},
		{"hasValidHeaders ok", hasValidHeaders([]*numbers.ExtraHeader{{Name: "X-A", Value: "b"}}), ""},
		{"hasAOR", hasAOR(""), "the address of record (aor) is required"},
		{"isValidAOR", isValidAOR("tel:1"), "the aor schema must start with `backend:` or `sip:`"},
		{"isValidAOR ok", isValidAOR("backend:a"), ""},
		{"isValidAORLink", isValidAORLink("tel:1"), "the aorLink must start with backend: or sip:"},
		{"isValidAORLink empty", isValidAORLink(""), ""},
		{"hasCity", hasCity(""), "the city is required"},
		{"hasCountry", hasCountry(""), "the country is required"},
		{"hasCountryIsoCode", hasCountryIsoCode(""), "the countryIsoCode is required"},
		{"hasACLRules", hasACLRules(nil, []string{"0.0.0.0/0"}), "acl rules are required"},
		{"hasACLRules ok", hasACLRules([]string{"10.0.0.1"}, []string{"0.0.0.0/0"}), ""},
		{"hasValidACLRules deny first", hasValidACLRules([]string{"a"}, []string{"b"}), "b is not a valid cidr or ip"},
		{"hasValidACLRules allow", hasValidACLRules([]string{"10.0.0.0/33"}, nil), "10.0.0.0/33 is not a valid cidr or ip"},
		{"hasValidACLRules ok", hasValidACLRules([]string{"10.0.0.0/8"}, []string{"10.0.0.1"}), ""},
		{"hasInboundURI", hasInboundURI(""), "the inboundUri is required"},
		{"isValidInboundURI", isValidInboundURI("nodots"), "the inbound URI must be a valid FQDN or IP address (e.g., sip.example.com or 47.132.130.31)"},
		{"isValidInboundURI ip", isValidInboundURI("47.132.130.31"), ""},
		{"isValidContactAddress", isValidContactAddress("nodots:5060"), "the contact address must be a valid FQDN or IP"},
		{"isValidContactAddress ok", isValidContactAddress("10.0.0.1:5060"), ""},
		{"host", hasValidOutboundURIs([]*trunks.TrunkURI{{}}), "the host is required"},
		{"bad host", hasValidOutboundURIs([]*trunks.TrunkURI{{Host: "nodots"}}), "the host must be a valid FQDN or IP"},
		{"port", hasValidOutboundURIs([]*trunks.TrunkURI{{Host: "a.com", Port: 70000}}), "the port must be a valid port"},
		{"priority", hasValidOutboundURIs([]*trunks.TrunkURI{{Host: "a.com", Port: 5060, Priority: -1}}), "the priority must be between 0 and 65535"},
		{"weight", hasValidOutboundURIs([]*trunks.TrunkURI{{Host: "a.com", Port: 5060}}), "the weight must be between 1 and 65535"},
		{"uri ok", hasValidOutboundURIs([]*trunks.TrunkURI{{Host: "a.com", Port: 5060, Weight: 1}}), ""},
		{"transport", hasValidTransports([]*trunks.TrunkURI{{Transport: "udp"}, {Transport: "sip"}}), `the transport must be one of UDP, TCP, SCTP, TLS, WS, WSS (in any case), not "sip"`},
		{"transport ok", hasValidTransports([]*trunks.TrunkURI{{Transport: "wss"}}), ""},
		{"privacy", isValidPrivacy(ptr(agents.Privacy(2))), "the privacy must be PRIVATE or NONE, not 2"},
		{"privacy unset", isValidPrivacy(nil), ""},
		{"balancing", isValidBalancingAlgorithm(peers.LoadBalancingAlgorithm(-1)), "the balancingAlgorithm must be ROUND_ROBIN or LEAST_SESSIONS, not -1"},
		{"balancing ok", isValidBalancingAlgorithm(peers.LoadBalancingAlgorithm_LEAST_SESSIONS), ""},
	}
	for _, tt := range tests {
		got := ""
		if tt.err != nil {
			var bad *BadRequestError
			if !errors.As(tt.err, &bad) {
				t.Errorf("%s: %v is not a BadRequestError", tt.name, tt.err)
			}
			got = tt.err.Error()
		}
		if got != tt.message {
			t.Errorf("%s = %q, want %q", tt.name, got, tt.message)
		}
	}
}

func TestIsFQDN(t *testing.T) {
	for value, want := range map[string]bool{
		"sip.local":                      true,
		"a.b-c.example.com":              true,
		"":                               false,
		"nodots":                         false,
		"a.b":                            false,
		"a.123":                          false,
		"sip.local.":                     false,
		"-a.example.com":                 false,
		"a-.example.com":                 false,
		"a_b.example.com":                false,
		"a b.example.com":                false,
		"10.0.0.1":                       false,
		"xn--p1ai.xn--p1ai":              true,
		strings.Repeat("a", 64) + ".com": false,
	} {
		if got := isFQDN(value); got != want {
			t.Errorf("isFQDN(%q) = %v, want %v", value, got, want)
		}
	}
}

func TestIsIP(t *testing.T) {
	for value, want := range map[string]bool{
		"10.0.0.1":    true,
		"256.0.0.1":   false,
		"10.0.0":      false,
		"::1":         true,
		"fe80::1%en0": true,
		"2001:db8::":  true,
		"1:2":         false,
		"":            false,
	} {
		if got := isIP(value); got != want {
			t.Errorf("isIP(%q) = %v, want %v", value, got, want)
		}
	}
}

func TestIsIPv4Range(t *testing.T) {
	for value, want := range map[string]bool{
		"10.0.0.0/8":  true,
		"0.0.0.0/0":   true,
		"10.0.0.0/32": true,
		"10.0.0.0/33": false,
		"10.0.0.0/08": false,
		"10.0.0.0":    false,
		"::1/128":     false,
		"10.0.0.0/a":  false,
	} {
		if got := isIPv4Range(value); got != want {
			t.Errorf("isIPv4Range(%q) = %v, want %v", value, got, want)
		}
	}
}

func TestValidatorLength(t *testing.T) {
	for value, want := range map[string]int{
		"":           0,
		"abc":        3,
		"\U0001F600": 1,
		"❤️":         1,
		"️":          1,
		"❤️️":        2,
	} {
		if got := validatorLength(value); got != want {
			t.Errorf("validatorLength(%q) = %d, want %d", value, got, want)
		}
	}
}

// The order of each manager's checks shows in which message comes first.
func TestValidateRequests(t *testing.T) {
	name, empty := "n", ""
	tests := []struct {
		name    string
		err     error
		message string
	}{
		{"create ACL", validateCreateACL(&acl.CreateACLRequest{}), "the friendly name for the resource is required"},
		{"create ACL rules", validateCreateACL(&acl.CreateACLRequest{Name: "n"}), "acl rules are required"},
		{"create ACL ok", validateCreateACL(&acl.CreateACLRequest{Name: "n", Allow: []string{"10.0.0.1"}, Deny: []string{"0.0.0.0/0"}}), ""},
		{"update ACL ref", validateUpdateACL(&acl.UpdateACLRequest{}), "the reference to the resource is required"},
		{"update ACL partial", validateUpdateACL(&acl.UpdateACLRequest{Ref: "r"}), ""},
		{"update ACL rules", validateUpdateACL(&acl.UpdateACLRequest{Ref: "r", Allow: []string{"x"}}), "x is not a valid cidr or ip"},
		{"create Agent", validateCreateAgent(&agents.CreateAgentRequest{Name: "n"}), "the username is required"},
		{"create Agent ok", validateCreateAgent(&agents.CreateAgentRequest{Name: "n", Username: "u"}), ""},
		{"update Agent empty name", validateUpdateAgent(&agents.UpdateAgentRequest{Ref: "r", Name: &empty}), "the friendly name must have less than 60 characters"},
		{"update Agent name", validateUpdateAgent(&agents.UpdateAgentRequest{Ref: "r", Name: &name}), ""},
		{"create Credentials", validateCreateCredentials(&credentials.CreateCredentialsRequest{Name: "n", Username: "u"}), "the password is required"},
		{"update Credentials", validateUpdateCredentials(&credentials.UpdateCredentialsRequest{}), "the reference to the resource is required"},
		{"create Domain", validateCreateDomain(&domains.CreateDomainRequest{Name: "n"}), "the domainUri must be a valid fully qualified domain name"},
		{"update Domain", validateUpdateDomain(&domains.UpdateDomainRequest{Ref: "r"}), ""},
		{"create Domain with a bad rule", validateCreateDomain(&domains.CreateDomainRequest{Name: "n", DomainUri: "sip.local", EgressPolicies: []*domains.EgressPolicy{{Rule: "["}}}), "the egressPolicies rule `[` is not a valid regular expression"},
		{"update Domain with a bad rule", validateUpdateDomain(&domains.UpdateDomainRequest{Ref: "r", EgressPolicies: []*domains.EgressPolicy{{Rule: "["}}}), "the egressPolicies rule `[` is not a valid regular expression"},
		{"create Number", validateCreateNumber(&numbers.CreateNumberRequest{}, true), "the telUrl is required"},
		{"create Number city", validateCreateNumber(&numbers.CreateNumberRequest{TelUrl: "tel:1", Name: "n"}, false), "the city is required"},
		{"update Number", validateUpdateNumber(&numbers.UpdateNumberRequest{Ref: "r"}), ""},
		{"create Peer", validateCreatePeer(&peers.CreatePeerRequest{Name: "n", Username: "u"}), "the address of record (aor) is required"},
		{"update Peer", validateUpdatePeer(&peers.UpdatePeerRequest{Ref: "r"}), ""},
		{"create Trunk", validateCreateTrunk(&trunks.CreateTrunkRequest{Name: "n"}), "the inboundUri is required"},
		{"update Trunk", validateUpdateTrunk(&trunks.UpdateTrunkRequest{Ref: "r"}), ""},
	}
	for _, tt := range tests {
		got := ""
		if tt.err != nil {
			got = tt.err.Error()
		}
		if got != tt.message {
			t.Errorf("%s = %q, want %q", tt.name, got, tt.message)
		}
	}
}

// TestEnumLikeFields covers the fields the schema stores as an enum: a Trunk
// URI's transport in any case, written in upper case, and the values no enum
// has, which are bad requests before anything reaches the database.
func TestEnumLikeFields(t *testing.T) {
	uri := func(transport string) []*trunks.TrunkURI {
		return []*trunks.TrunkURI{{Host: "sip.provider.net", Port: 5060, Transport: transport, Weight: 1}}
	}
	createTrunk := func(transport string) *trunks.CreateTrunkRequest {
		return &trunks.CreateTrunkRequest{Name: "n", InboundUri: "trunk.acme.com", Uris: uri(transport)}
	}
	updateTrunk := func(transport string) *trunks.UpdateTrunkRequest {
		return &trunks.UpdateTrunkRequest{Ref: "t1", Uris: uri(transport)}
	}
	const (
		unknownTransport  = `the transport must be one of UDP, TCP, SCTP, TLS, WS, WSS (in any case), not "quic"`
		requiredTransport = "the transport is required: one of UDP, TCP, SCTP, TLS, WS, WSS (in any case)"
		unknownPrivacy    = "the privacy must be PRIVATE or NONE, not 5"
		unknownBalancing  = "the balancingAlgorithm must be ROUND_ROBIN or LEAST_SESSIONS, not 7"
	)
	privacy, balancing := agents.Privacy(5), peers.LoadBalancingAlgorithm(7)
	private, unspecified := agents.Privacy_PRIVATE, peers.LoadBalancingAlgorithm_UNSPECIFIED
	for _, tt := range []struct {
		name    string
		err     error
		message string
	}{
		{"create Trunk udp", validateCreateTrunk(createTrunk("udp")), ""},
		{"create Trunk Tls", validateCreateTrunk(createTrunk("Tls")), ""},
		{"create Trunk UDP", validateCreateTrunk(createTrunk("UDP")), ""},
		{"create Trunk quic", validateCreateTrunk(createTrunk("quic")), unknownTransport},
		{"create Trunk no transport", validateCreateTrunk(createTrunk("")), requiredTransport},
		{"create Trunk host before transport", validateCreateTrunk(&trunks.CreateTrunkRequest{Name: "n", InboundUri: "trunk.acme.com", Uris: []*trunks.TrunkURI{{Transport: "quic"}}}), "the host is required"},
		{"update Trunk tcp", validateUpdateTrunk(updateTrunk("tcp")), ""},
		{"update Trunk quic", validateUpdateTrunk(updateTrunk("quic")), unknownTransport},
		{"update Trunk no transport", validateUpdateTrunk(updateTrunk("")), requiredTransport},
		{"create Agent privacy 5", validateCreateAgent(&agents.CreateAgentRequest{Name: "n", Username: "u", Privacy: &privacy}), unknownPrivacy},
		{"create Agent PRIVATE", validateCreateAgent(&agents.CreateAgentRequest{Name: "n", Username: "u", Privacy: &private}), ""},
		{"update Agent privacy 5", validateUpdateAgent(&agents.UpdateAgentRequest{Ref: "r", Privacy: &privacy}), unknownPrivacy},
		{"update Agent PRIVATE", validateUpdateAgent(&agents.UpdateAgentRequest{Ref: "r", Privacy: &private}), ""},
		{"create Peer balancing 7", validateCreatePeer(&peers.CreatePeerRequest{Name: "n", Username: "u", Aor: "sip:a@sip.local", BalancingAlgorithm: balancing}), unknownBalancing},
		{"create Peer UNSPECIFIED", validateCreatePeer(&peers.CreatePeerRequest{Name: "n", Username: "u", Aor: "sip:a@sip.local"}), ""},
		{"update Peer balancing 7", validateUpdatePeer(&peers.UpdatePeerRequest{Ref: "r", BalancingAlgorithm: &balancing}), unknownBalancing},
		{"update Peer UNSPECIFIED", validateUpdatePeer(&peers.UpdatePeerRequest{Ref: "r", BalancingAlgorithm: &unspecified}), ""},
	} {
		got := ""
		if tt.err != nil {
			var bad *BadRequestError
			if !errors.As(tt.err, &bad) {
				t.Errorf("%s: %v is not a BadRequestError", tt.name, tt.err)
			}
			got = tt.err.Error()
		}
		if got != tt.message {
			t.Errorf("%s = %q, want %q", tt.name, got, tt.message)
		}
	}

	// What reaches the column is the enum's label, whatever the case sent
	s := writeStore(t, sampleDB())
	for sent, stored := range map[string]string{"udp": "UDP", "Tls": "TLS", "WSS": "WSS"} {
		w, err := s.insertOf(createTrunk(sent))
		if err != nil {
			t.Fatal(err)
		}
		if got := w.children.rows[0][2]; got != stored {
			t.Errorf("insertOf with transport %q writes %v, want %q", sent, got, stored)
		}
		w, err = s.updateOf(updateTrunk(sent))
		if err != nil {
			t.Fatal(err)
		}
		if got := w.children.rows[0][2]; got != stored {
			t.Errorf("updateOf with transport %q writes %v, want %q", sent, got, stored)
		}
	}
}

// messageOf is the message of a validation's BadRequestError, "" for none.
func messageOf(t *testing.T, err error) string {
	t.Helper()
	if err == nil {
		return ""
	}
	var bad *BadRequestError
	if !errors.As(err, &bad) {
		t.Fatalf("err = %v, want a BadRequestError", err)
	}
	return bad.Message
}

func TestEnforceE164Numbers(t *testing.T) {
	number := func(telURL, country string) *numbers.CreateNumberRequest {
		return &numbers.CreateNumberRequest{TelUrl: telURL, Name: "n", City: "London", Country: "United Kingdom", CountryIsoCode: country}
	}
	notE164 := func(telURL string) string {
		return `telUrl "` + telURL + `" is not E.164: use tel:+ followed by 2 to 15 digits, the first not 0; or set spec.data.enforceE164Numbers: false`
	}
	tests := []struct {
		name    string
		req     *numbers.CreateNumberRequest
		enforce bool
		want    string
	}{
		{"national", number("tel:02079460018", "GB"), true, notE164("tel:02079460018")},
		{"leading zero", number("tel:+0123", "GB"), true, notE164("tel:+0123")},
		{"16 digits", number("tel:+1234567890123456", "GB"), true, notE164("tel:+1234567890123456")},
		{"a sip URI", number("sip:x", "GB"), true, notE164("sip:x")},
		{"E.164", number("tel:+442079460018", "GB"), true, ""},
		{"off: national", number("tel:02079460018", "GB"), false, ""},
		{"off: a sip URI", number("sip:x", "GB"), false, "the telUrl must start with `tel:`"},
		{"unknown country", number("tel:+442079460018", "XX"), true, `countryIsoCode "XX" is not a country with a numbering plan`},
		{"three letters", number("tel:+442079460018", "GBR"), true, `countryIsoCode "GBR" is not a country with a numbering plan`},
		{"lower case country", number("tel:+442079460018", "gb"), true, ""},
		{"no country", number("tel:+442079460018", ""), true, "the countryIsoCode is required"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := messageOf(t, validateCreateNumber(tt.req, tt.enforce)); got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestNumberAliases(t *testing.T) {
	create := func(aliases ...string) error {
		return validateCreateNumber(&numbers.CreateNumberRequest{
			TelUrl: "tel:+442079460018", Name: "n", City: "London", Country: "United Kingdom", CountryIsoCode: "GB", Aliases: aliases,
		}, true)
	}
	invalid := func(alias string) string {
		return `alias "` + alias + `" is invalid: use 1 to 60 letters, digits or + * . _ -`
	}
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"none", create(), ""},
		{"every allowed character", create("Sales+1*2.3_4-5", strings.Repeat("a", 60)), ""},
		{"a space", create("ok", "two words"), invalid("two words")},
		{"too long", create(strings.Repeat("a", 61)), invalid(strings.Repeat("a", 61))},
		{"empty", create(""), invalid("")},
		{"a hash", create("#1"), invalid("#1")},
		{"on update", validateUpdateNumber(&numbers.UpdateNumberRequest{Ref: "r", Aliases: []string{"sales", "a/b"}}), invalid("a/b")},
		{"update ok", validateUpdateNumber(&numbers.UpdateNumberRequest{Ref: "r", Aliases: []string{"sales"}}), ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := messageOf(t, tt.err); got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
	if got := usedAliasMessage("sales", "number-uk"); got != `alias "sales" is already used by Number number-uk on this Trunk` {
		t.Errorf("used alias message = %q", got)
	}
}

func TestTrunkNumberFormats(t *testing.T) {
	create := func(calledFormat trunks.NumberFormat, calledPrefix string, callerFormat trunks.NumberFormat, callerPrefix string) error {
		return validateCreateTrunk(&trunks.CreateTrunkRequest{
			Name: "n", InboundUri: "trunk.acme.com",
			CalledNumberFormat: calledFormat, CalledNumberPrefix: calledPrefix,
			CallerNumberFormat: callerFormat, CallerNumberPrefix: callerPrefix,
		})
	}
	const (
		calledNeeds    = "calledNumberPrefix needs calledNumberFormat e164-without-plus, national or international"
		callerNeeds    = "callerNumberPrefix needs callerNumberFormat e164-without-plus, national or international"
		calledContains = "calledNumberPrefix may contain only digits, * and # (up to 20)"
		callerContains = "callerNumberPrefix may contain only digits, * and # (up to 20)"
	)
	none, e164 := trunks.NumberFormat_UNSPECIFIED, trunks.NumberFormat_E164
	plusless, national, international := trunks.NumberFormat_E164_WITHOUT_PLUS, trunks.NumberFormat_NATIONAL, trunks.NumberFormat_INTERNATIONAL
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"none", create(none, "", none, ""), ""},
		{"every format, no prefix", create(international, "", e164, ""), ""},
		{"a prefix with each format that takes one", create(national, "9", plusless, "*#0"), ""},
		{"international with a prefix", create(international, "9", none, ""), ""},
		{"a called prefix with no format", create(none, "9", none, ""), calledNeeds},
		{"a called prefix with e164", create(e164, "9", none, ""), calledNeeds},
		{"a caller prefix with no format", create(none, "", none, "9"), callerNeeds},
		{"a caller prefix with e164", create(none, "", e164, "9"), callerNeeds},
		{"a letter", create(national, "9a", none, ""), calledContains},
		{"21 digits", create(national, strings.Repeat("1", 21), none, ""), calledContains},
		{"20 digits", create(national, strings.Repeat("1", 20), none, ""), ""},
		{"a caller letter", create(none, "", national, "x"), callerContains},
		{"an unknown format", create(trunks.NumberFormat(7), "", none, ""), "calledNumberFormat must be E164, E164_WITHOUT_PLUS, NATIONAL or INTERNATIONAL, not 7"},
		{"update: a bad prefix", validateUpdateTrunk(&trunks.UpdateTrunkRequest{Ref: "r", CallerNumberPrefix: ptr("9a")}), callerContains},
		{"update: an empty prefix clears", validateUpdateTrunk(&trunks.UpdateTrunkRequest{Ref: "r", CalledNumberPrefix: ptr("")}), ""},
		{"update: an unknown format", validateUpdateTrunk(&trunks.UpdateTrunkRequest{Ref: "r", CallerNumberFormat: trunks.NumberFormat(9).Enum()}), "callerNumberFormat must be E164, E164_WITHOUT_PLUS, NATIONAL or INTERNATIONAL, not 9"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := messageOf(t, tt.err); got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
	// The rule on the Trunk as stored, which an Update merges into
	stored := trunkNumberFormat{"calledNumber", national, "9"}
	stored.format = none
	if got := messageOf(t, validateTrunkNumberFormats(stored, trunkNumberFormat{"callerNumber", none, ""})); got != calledNeeds {
		t.Errorf("a reset format with the prefix stored: %q", got)
	}
}
