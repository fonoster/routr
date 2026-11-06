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
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// The validations of @routr/common (mods/common/src/connect/validations.ts)
// and the order each pgdata manager ran them in (mods/pgdata/src/mappers),
// with the same messages. The FQDN and IP checks port validator 13.15.26 with
// its default options.

func badRequest(message string) error { return &BadRequestError{Message: message} }

// firstError is the first failed validation of a manager's list.
func firstError(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}

func required(value, message string) error {
	if value == "" {
		return badRequest(message)
	}
	return nil
}

func hasReference(ref string) error {
	return required(ref, "the reference to the resource is required")
}

func hasName(name string) error {
	return required(name, "the friendly name for the resource is required")
}

func isValidName(name string) error {
	if n := validatorLength(name); n < 1 || n > 60 {
		return badRequest("the friendly name must have less than 60 characters")
	}
	return nil
}

// isValidOptionalName validates a name only when an update sends it.
func isValidOptionalName(name *string) error {
	if name == nil {
		return nil
	}
	return isValidName(*name)
}

func hasUsername(username string) error { return required(username, "the username is required") }

func isValidUsername(username string) error {
	if strings.Contains(username, " ") {
		return badRequest("the username must not contain spaces")
	}
	return nil
}

func hasPassword(password string) error { return required(password, "the password is required") }

func isValidDomainURI(domainURI string) error {
	if !isFQDN(domainURI) {
		return badRequest("the domainUri must be a valid fully qualified domain name")
	}
	return nil
}

func hasTelURL(telURL string) error { return required(telURL, "the telUrl is required") }

func isValidTelURL(telURL string) error {
	if !strings.HasPrefix(telURL, "tel:") {
		return badRequest("the telUrl must start with `tel:`")
	}
	return nil
}

var alphanumericRE = regexp.MustCompile(`^[a-zA-Z0-9-]+$`)

func isValidAlphanumeric(value string) bool {
	return !strings.HasSuffix(value, "-") && alphanumericRE.MatchString(value)
}

func isValidSessionAffinityHeader(header string) error {
	if header != "" && !isValidAlphanumeric(header) {
		return badRequest("the sessionAffinityHeader must be alphanumeric and without spaces")
	}
	return nil
}

func hasValidHeaders(headers []*numbers.ExtraHeader) error {
	for _, header := range headers {
		if header.GetValue() == "" {
			return badRequest("the header value cannot be empty")
		}
		if name := header.GetName(); name != "" && !isValidAlphanumeric(name) {
			return badRequest("the header must be alphanumeric and without spaces")
		}
	}
	return nil
}

func hasAOR(aor string) error {
	return required(aor, "the address of record (aor) is required")
}

func isSchemedAOR(aor string) bool {
	return strings.HasPrefix(aor, "backend:") || strings.HasPrefix(aor, "sip:")
}

func isValidAOR(aor string) error {
	if aor != "" && !isSchemedAOR(aor) {
		return badRequest("the aor schema must start with `backend:` or `sip:`")
	}
	return nil
}

func isValidAORLink(aorLink string) error {
	if aorLink != "" && !isSchemedAOR(aorLink) {
		return badRequest("the aorLink must start with backend: or sip:")
	}
	return nil
}

func hasCity(city string) error { return required(city, "the city is required") }

func hasCountry(country string) error { return required(country, "the country is required") }

func hasCountryIsoCode(code string) error {
	return required(code, "the countryIsoCode is required")
}

func hasACLRules(allow, deny []string) error {
	if len(deny) == 0 || len(allow) == 0 {
		return badRequest("acl rules are required")
	}
	return nil
}

func isValidACLRule(rules []string) error {
	for _, cidr := range rules {
		if !isIPv4Range(cidr) && !isIPv4(cidr) {
			return badRequest(cidr + " is not a valid cidr or ip")
		}
	}
	return nil
}

func hasValidACLRules(allow, deny []string) error {
	return firstError(isValidACLRule(deny), isValidACLRule(allow))
}

func hasInboundURI(inboundURI string) error {
	return required(inboundURI, "the inboundUri is required")
}

func isValidInboundURI(inboundURI string) error {
	if inboundURI != "" && !isFQDN(inboundURI) && !isIP(inboundURI) {
		return badRequest("the inbound URI must be a valid FQDN or IP address (e.g., sip.example.com or 47.132.130.31)")
	}
	return nil
}

func isValidContactAddress(address string) error {
	if address == "" {
		return nil
	}
	host, _, _ := strings.Cut(address, ":")
	if !isFQDN(host) && !isIP(host) {
		return badRequest("the contact address must be a valid FQDN or IP")
	}
	return nil
}

// hasValidOutboundURIs validates a Trunk's URIs on create. A proto3 scalar the
// client left out reads as zero here, so a port or a weight of 0 fails as it
// did when absent in Node, and a priority of 0 passes as the explicit 0 did.
func hasValidOutboundURIs(uris []*trunks.TrunkURI) error {
	for _, uri := range uris {
		if uri.GetHost() == "" {
			return badRequest("the host is required")
		}
		if !isFQDN(uri.GetHost()) && !isIP(uri.GetHost()) {
			return badRequest("the host must be a valid FQDN or IP")
		}
		if uri.GetPort() < 1 || uri.GetPort() > 65535 {
			return badRequest("the port must be a valid port")
		}
		if uri.GetPriority() < 0 || uri.GetPriority() > 65535 {
			return badRequest("the priority must be between 0 and 65535")
		}
		if uri.GetWeight() < 1 || uri.GetWeight() > 65535 {
			return badRequest("the weight must be between 1 and 65535")
		}
	}
	return nil
}

// What each manager's validOrThrowCreate and validOrThrowUpdate ran.

func validateCreateACL(r *acl.CreateACLRequest) error {
	return firstError(
		hasName(r.GetName()),
		isValidName(r.GetName()),
		hasACLRules(r.GetAllow(), r.GetDeny()),
		hasValidACLRules(r.GetAllow(), r.GetDeny()),
	)
}

func validateUpdateACL(r *acl.UpdateACLRequest) error {
	return firstError(
		hasReference(r.GetRef()),
		isValidOptionalName(r.Name),
		hasValidACLRules(r.GetAllow(), r.GetDeny()),
	)
}

func validateCreateAgent(r *agents.CreateAgentRequest) error {
	return firstError(
		hasName(r.GetName()),
		isValidName(r.GetName()),
		hasUsername(r.GetUsername()),
		isValidUsername(r.GetUsername()),
	)
}

func validateUpdateAgent(r *agents.UpdateAgentRequest) error {
	return firstError(hasReference(r.GetRef()), isValidOptionalName(r.Name))
}

func validateCreateCredentials(r *credentials.CreateCredentialsRequest) error {
	return firstError(
		hasName(r.GetName()),
		isValidName(r.GetName()),
		hasUsername(r.GetUsername()),
		isValidUsername(r.GetUsername()),
		hasPassword(r.GetPassword()),
	)
}

func validateUpdateCredentials(r *credentials.UpdateCredentialsRequest) error {
	return firstError(
		hasReference(r.GetRef()),
		isValidOptionalName(r.Name),
		isValidUsername(r.GetUsername()),
	)
}

func validateCreateDomain(r *domains.CreateDomainRequest) error {
	return firstError(
		hasName(r.GetName()),
		isValidName(r.GetName()),
		isValidDomainURI(r.GetDomainUri()),
	)
}

func validateUpdateDomain(r *domains.UpdateDomainRequest) error {
	return firstError(hasReference(r.GetRef()), isValidOptionalName(r.Name))
}

func validateCreateNumber(r *numbers.CreateNumberRequest) error {
	return firstError(
		hasTelURL(r.GetTelUrl()),
		isValidTelURL(r.GetTelUrl()),
		hasName(r.GetName()),
		isValidName(r.GetName()),
		isValidAORLink(r.GetAorLink()),
		hasCity(r.GetCity()),
		hasCountry(r.GetCountry()),
		hasCountryIsoCode(r.GetCountryIsoCode()),
		hasValidHeaders(r.GetExtraHeaders()),
		isValidSessionAffinityHeader(r.GetSessionAffinityHeader()),
	)
}

func validateUpdateNumber(r *numbers.UpdateNumberRequest) error {
	return firstError(
		hasReference(r.GetRef()),
		isValidOptionalName(r.Name),
		isValidAORLink(r.GetAorLink()),
		hasValidHeaders(r.GetExtraHeaders()),
		isValidSessionAffinityHeader(r.GetSessionAffinityHeader()),
	)
}

func validateCreatePeer(r *peers.CreatePeerRequest) error {
	return firstError(
		hasName(r.GetName()),
		isValidName(r.GetName()),
		hasUsername(r.GetUsername()),
		isValidUsername(r.GetUsername()),
		hasAOR(r.GetAor()),
		isValidAOR(r.GetAor()),
		isValidContactAddress(r.GetContactAddr()),
	)
}

func validateUpdatePeer(r *peers.UpdatePeerRequest) error {
	return firstError(
		hasReference(r.GetRef()),
		isValidOptionalName(r.Name),
		isValidAOR(r.GetAor()),
		isValidContactAddress(r.GetContactAddr()),
	)
}

func validateCreateTrunk(r *trunks.CreateTrunkRequest) error {
	return firstError(
		hasName(r.GetName()),
		isValidName(r.GetName()),
		hasInboundURI(r.GetInboundUri()),
		isValidInboundURI(r.GetInboundUri()),
		hasValidOutboundURIs(r.GetUris()),
	)
}

func validateUpdateTrunk(r *trunks.UpdateTrunkRequest) error {
	return firstError(
		hasReference(r.GetRef()),
		isValidOptionalName(r.Name),
		isValidInboundURI(r.GetInboundUri()),
	)
}

// validatorLength is validator's isLength: UTF-16 units less the surrogate
// pairs and the presentation sequences, which is the runes less the variation
// selectors that follow another character.
func validatorLength(s string) int {
	n := 0
	var prev rune
	for i, r := range s {
		if !(i > 0 && isVariationSelector(r) && !isVariationSelector(prev)) {
			n++
		}
		prev = r
	}
	return n
}

func isVariationSelector(r rune) bool { return r == 0xFE0E || r == 0xFE0F }

// utf16Length is a JavaScript string's length.
func utf16Length(s string) int {
	n := 0
	for _, r := range s {
		n++
		if r > 0xFFFF {
			n++
		}
	}
	return n
}

const (
	ipv4Segment = `(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])`
	ipv4Address = `(` + ipv4Segment + `[.]){3}` + ipv4Segment
	ipv6Segment = `(?:[0-9a-fA-F]{1,4})`
)

var (
	ipv4RE = regexp.MustCompile(`^` + ipv4Address + `$`)
	ipv6RE = regexp.MustCompile(`^(` +
		`(?:` + ipv6Segment + `:){7}(?:` + ipv6Segment + `|:)|` +
		`(?:` + ipv6Segment + `:){6}(?:` + ipv4Address + `|:` + ipv6Segment + `|:)|` +
		`(?:` + ipv6Segment + `:){5}(?::` + ipv4Address + `|(:` + ipv6Segment + `){1,2}|:)|` +
		`(?:` + ipv6Segment + `:){4}(?:(:` + ipv6Segment + `){0,1}:` + ipv4Address + `|(:` + ipv6Segment + `){1,3}|:)|` +
		`(?:` + ipv6Segment + `:){3}(?:(:` + ipv6Segment + `){0,2}:` + ipv4Address + `|(:` + ipv6Segment + `){1,4}|:)|` +
		`(?:` + ipv6Segment + `:){2}(?:(:` + ipv6Segment + `){0,3}:` + ipv4Address + `|(:` + ipv6Segment + `){1,5}|:)|` +
		`(?:` + ipv6Segment + `:){1}(?:(:` + ipv6Segment + `){0,4}:` + ipv4Address + `|(:` + ipv6Segment + `){1,6}|:)|` +
		`(?::((?::` + ipv6Segment + `){0,5}:` + ipv4Address + `|(?::` + ipv6Segment + `){1,7}|:))` +
		`)(%[0-9a-zA-Z.]{1,})?$`)
	subnetRE = regexp.MustCompile(`^[0-9]{1,3}$`)

	fqdnTLDRE       = regexp.MustCompile(`(?i)^([a-z\x{A1}-\x{A8}\x{AA}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}]{2,}|xn[a-z0-9-]{2,})$`)
	fqdnSpaceRE     = regexp.MustCompile(`[\s\x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]`)
	fqdnPartRE      = regexp.MustCompile(`(?i)^[a-z_\x{A1}-\x{10FFFF}0-9-]+$`)
	fqdnFullWidthRE = regexp.MustCompile(`[\x{FF01}-\x{FF5E}]`)
)

func isIPv4(s string) bool { return ipv4RE.MatchString(s) }

func isIP(s string) bool { return ipv4RE.MatchString(s) || ipv6RE.MatchString(s) }

// isIPv4Range is validator's isIPRange(s, 4).
func isIPv4Range(s string) bool {
	parts := strings.Split(s, "/")
	if len(parts) != 2 || !subnetRE.MatchString(parts[1]) {
		return false
	}
	if len(parts[1]) > 1 && parts[1][0] == '0' {
		return false
	}
	if !isIPv4(parts[0]) {
		return false
	}
	subnet, err := strconv.Atoi(parts[1])
	return err == nil && subnet <= 32
}

// isFQDN is validator's isFQDN with its defaults: a TLD is required and is
// not numeric, no underscores, no trailing dot, labels of at most 63.
func isFQDN(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) < 2 {
		return false
	}
	tld := parts[len(parts)-1]
	if !fqdnTLDRE.MatchString(tld) || fqdnSpaceRE.MatchString(tld) {
		return false
	}
	for _, part := range parts {
		if utf16Length(part) > 63 || !fqdnPartRE.MatchString(part) || fqdnFullWidthRE.MatchString(part) {
			return false
		}
		if strings.HasPrefix(part, "-") || strings.HasSuffix(part, "-") || strings.Contains(part, "_") {
			return false
		}
	}
	return true
}

// quotedValue is the bad request for a FindBy value its column cannot take.
func quotedValue(field string, kind Kind, takes, value string) error {
	return badRequest(fmt.Sprintf("field %q of %s takes %s, not %q", field, kind, takes, value))
}
