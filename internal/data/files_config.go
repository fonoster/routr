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
	"fmt"
	"strings"

	"github.com/fonoster/routr/internal/common/numbering"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// resource is one entry of a resources YAML file: the UserConfig union of
// @routr/common (mods/common/src/connect/config.ts). One struct holds every
// kind's spec; validate() checks the part the kind's JSON schema
// (mods/common/src/connect/schemas) requires.
type resource struct {
	APIVersion string       `yaml:"apiVersion"`
	Kind       string       `yaml:"kind"`
	Ref        string       `yaml:"ref"`
	Metadata   metadata     `yaml:"metadata"`
	Spec       resourceSpec `yaml:"spec"`
}

type metadata struct {
	Name    string   `yaml:"name"`
	GeoInfo *geoInfo `yaml:"geoInfo"`
}

type geoInfo struct {
	City           string `yaml:"city"`
	Country        string `yaml:"country"`
	CountryIsoCode string `yaml:"countryIsoCode"`
}

type resourceSpec struct {
	// Agent and Peer
	Username       string         `yaml:"username"`
	DomainRef      string         `yaml:"domainRef"`
	CredentialsRef string         `yaml:"credentialsRef"`
	Privacy        string         `yaml:"privacy"`
	MaxContacts    *int32         `yaml:"maxContacts"`
	Expires        *int32         `yaml:"expires"`
	Enabled        *bool          `yaml:"enabled"`
	Trace          *traceSettings `yaml:"trace"`
	// Peer
	AOR                  string         `yaml:"aor"`
	ContactAddr          string         `yaml:"contactAddr"`
	AccessControlListRef string         `yaml:"accessControlListRef"`
	LoadBalancing        *loadBalancing `yaml:"loadBalancing"`
	// Credentials
	Credentials *credentialsSpec `yaml:"credentials"`
	// Domain
	Context *domainContext `yaml:"context"`
	// Number
	TrunkRef string          `yaml:"trunkRef"`
	Location *numberLocation `yaml:"location"`
	// Trunk. NormalizeToE164 is read only to refuse it: Routr 3 removed it.
	NormalizeToE164       *bool          `yaml:"normalizeToE164"`
	CalledNumberFormat    string         `yaml:"calledNumberFormat"`
	CalledNumberPrefix    string         `yaml:"calledNumberPrefix"`
	CallerNumberFormat    string         `yaml:"callerNumberFormat"`
	CallerNumberPrefix    string         `yaml:"callerNumberPrefix"`
	RewriteFromWithNumber *bool          `yaml:"rewriteFromWithNumber"`
	FromDomain            string         `yaml:"fromDomain"`
	Inbound               *trunkInbound  `yaml:"inbound"`
	Outbound              *trunkOutbound `yaml:"outbound"`
	// AccessControlList
	AccessControlList *aclRules `yaml:"accessControlList"`
}

type traceSettings struct {
	Enabled *bool `yaml:"enabled"`
}

type loadBalancing struct {
	Algorithm           string `yaml:"algorithm"`
	WithSessionAffinity bool   `yaml:"withSessionAffinity"`
}

type credentialsSpec struct {
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

type domainContext struct {
	DomainURI      string         `yaml:"domainUri"`
	EgressPolicies []egressPolicy `yaml:"egressPolicies"`
}

type egressPolicy struct {
	Rule      string `yaml:"rule"`
	NumberRef string `yaml:"numberRef"`
}

type numberLocation struct {
	TelURL                string        `yaml:"telUrl"`
	AORLink               string        `yaml:"aorLink"`
	SessionAffinityHeader string        `yaml:"sessionAffinityHeader"`
	ExtraHeaders          []extraHeader `yaml:"extraHeaders"`
	Aliases               []string      `yaml:"aliases"`
}

type extraHeader struct {
	Name  string `yaml:"name"`
	Value string `yaml:"value"`
}

type trunkInbound struct {
	URI                  string `yaml:"uri"`
	AccessControlListRef string `yaml:"accessControlListRef"`
	CredentialsRef       string `yaml:"credentialsRef"`
}

type trunkOutbound struct {
	SendRegister   bool       `yaml:"sendRegister"`
	CredentialsRef string     `yaml:"credentialsRef"`
	URIs           []trunkURI `yaml:"uris"`
}

type trunkURI struct {
	URI      trunkURIAddr `yaml:"uri"`
	Priority *int32       `yaml:"priority"`
	Weight   *int32       `yaml:"weight"`
	Enabled  *bool        `yaml:"enabled"`
}

type trunkURIAddr struct {
	User      string `yaml:"user"`
	Host      string `yaml:"host"`
	Port      *int32 `yaml:"port"`
	Transport string `yaml:"transport"`
}

type aclRules struct {
	Allow []string `yaml:"allow"`
	Deny  []string `yaml:"deny"`
}

// badResourceError is a resource its kind's schema rejects, reported as
// @routr/common's assertValidSchema reported it: the failure and its path.
type badResourceError struct {
	Message string
	Path    string
}

func (e *badResourceError) Error() string {
	return "found a bad resource: " + e.Message + " at `" + e.Path + "`"
}

func bad(path, format string, args ...any) error {
	return &badResourceError{Message: fmt.Sprintf(format, args...), Path: path}
}

// kindOf maps the YAML kind, in any case, to the Kind, or "" for an unknown
// one. simpledata lowercases the kind before it picks the loader.
func kindOf(yamlKind string) Kind {
	k := Kind(strings.ToLower(yamlKind))
	for _, known := range Kinds {
		if k == known {
			return k
		}
	}
	return ""
}

// validate checks the resource against its kind's JSON schema: the required
// properties, the enums and the lengths. The YAML decoder already enforced
// the scalar types it could.
func (r *resource) validate(opts FilesOptions) error {
	if r.APIVersion != "v2beta1" && r.APIVersion != "v2" {
		return bad("/apiVersion", "must be equal to one of the allowed values (v2beta1, v2)")
	}
	kind := kindOf(r.Kind)
	if kind == "" {
		return bad("/kind", "must be equal to one of the allowed values")
	}
	if r.Ref == "" {
		return bad("/ref", "must have required property 'ref'")
	}
	if r.Metadata.Name == "" {
		return bad("/metadata", "must have required property 'name'")
	}
	if len(r.Metadata.Name) > 60 {
		return bad("/metadata/name", "must NOT have more than 60 characters")
	}
	if err := r.Spec.Trace.validate("/spec/trace"); err != nil {
		return err
	}
	switch kind {
	case KindAgent:
		return r.validateAgent()
	case KindPeer:
		return r.validatePeer()
	case KindCredentials:
		return r.validateCredentials()
	case KindDomain:
		return r.validateDomain()
	case KindNumber:
		return r.validateNumber(opts)
	case KindTrunk:
		return r.validateTrunk()
	case KindACL:
		return r.validateACL()
	}
	return nil
}

func (t *traceSettings) validate(path string) error {
	if t != nil && t.Enabled == nil {
		return bad(path, "must have required property 'enabled'")
	}
	return nil
}

func validateUsername(username string) error {
	if username == "" {
		return bad("/spec", "must have required property 'username'")
	}
	if len(username) < 4 {
		return bad("/spec/username", "must NOT have fewer than 4 characters")
	}
	if len(username) > 60 {
		return bad("/spec/username", "must NOT have more than 60 characters")
	}
	return nil
}

func (r *resource) validateAgent() error {
	if err := validateUsername(r.Spec.Username); err != nil {
		return err
	}
	switch strings.ToLower(r.Spec.Privacy) {
	case "", "private", "none":
	default:
		return bad("/spec/privacy", "must be equal to one of the allowed values (PRIVATE, NONE)")
	}
	return nil
}

func (r *resource) validatePeer() error {
	if err := validateUsername(r.Spec.Username); err != nil {
		return err
	}
	if r.Spec.AOR != "" && (len(r.Spec.AOR) < 5 || len(r.Spec.AOR) > 323) {
		return bad("/spec/aor", "must have between 5 and 323 characters")
	}
	if r.Spec.ContactAddr != "" && (len(r.Spec.ContactAddr) < 7 || len(r.Spec.ContactAddr) > 20) {
		return bad("/spec/contactAddr", "must have between 7 and 20 characters")
	}
	if lb := r.Spec.LoadBalancing; lb != nil {
		switch lb.Algorithm {
		case "", "round-robin", "least-sessions":
		default:
			return bad("/spec/loadBalancing/algorithm", "must be equal to one of the allowed values (round-robin, least-sessions)")
		}
	}
	return nil
}

func (r *resource) validateCredentials() error {
	c := r.Spec.Credentials
	if c == nil {
		return bad("/spec", "must have required property 'credentials'")
	}
	if c.Username == "" {
		return bad("/spec/credentials", "must have required property 'username'")
	}
	if c.Password == "" {
		return bad("/spec/credentials", "must have required property 'password'")
	}
	if len(c.Username) < 4 || len(c.Username) > 60 {
		return bad("/spec/credentials/username", "must have between 4 and 60 characters")
	}
	if len(c.Password) > 255 {
		return bad("/spec/credentials/password", "must NOT have more than 255 characters")
	}
	return nil
}

func (r *resource) validateDomain() error {
	c := r.Spec.Context
	if c == nil {
		return bad("/spec", "must have required property 'context'")
	}
	if c.DomainURI == "" {
		return bad("/spec/context", "must have required property 'domainUri'")
	}
	if len(c.DomainURI) > 255 {
		return bad("/spec/context/domainUri", "must NOT have more than 255 characters")
	}
	for i, p := range c.EgressPolicies {
		path := fmt.Sprintf("/spec/context/egressPolicies/%d", i)
		if p.Rule == "" {
			return bad(path, "must have required property 'rule'")
		}
		if p.NumberRef == "" {
			return bad(path, "must have required property 'numberRef'")
		}
	}
	return nil
}

func (r *resource) validateNumber(opts FilesOptions) error {
	if r.Metadata.GeoInfo == nil {
		return bad("/metadata", "must have required property 'geoInfo'")
	}
	l := r.Spec.Location
	if l == nil {
		return bad("/spec", "must have required property 'location'")
	}
	if l.TelURL == "" {
		return bad("/spec/location", "must have required property 'telUrl'")
	}
	if l.AORLink != "" && (len(l.AORLink) < 5 || len(l.AORLink) > 255) {
		return bad("/spec/location/aorLink", "must have between 5 and 255 characters")
	}
	if !opts.AllowNonE164Numbers && !numbering.IsE164TelURL(l.TelURL) {
		return r.refused(e164Message(l.TelURL))
	}
	code := r.Metadata.GeoInfo.CountryIsoCode
	if code == "" {
		return bad("/metadata/geoInfo", "must have required property 'countryIsoCode'")
	}
	if !numbering.IsKnownRegion(code) {
		return r.refused(countryIsoCodeMessage(code))
	}
	for _, alias := range l.Aliases {
		if !aliasRE.MatchString(alias) {
			return r.refused(invalidAliasMessage(alias))
		}
	}
	return nil
}

// refused is a resource a Routr 3 storage rule refuses, named by its kind and
// ref, with the message the Data API answers a write with.
func (r *resource) refused(message string) error {
	return fmt.Errorf("%s %s: %s", kindLabel(kindOf(r.Kind)), r.Ref, message)
}

// kindLabel is the kind as the messages name it.
func kindLabel(kind Kind) string {
	switch kind {
	case KindNumber:
		return "Number"
	case KindTrunk:
		return "Trunk"
	}
	return string(kind)
}

// numberFormatsOfYAML maps the YAML number formats to the enum.
var numberFormatsOfYAML = map[string]trunks.NumberFormat{
	"":                  trunks.NumberFormat_UNSPECIFIED,
	"e164":              trunks.NumberFormat_E164,
	"e164-without-plus": trunks.NumberFormat_E164_WITHOUT_PLUS,
	"national":          trunks.NumberFormat_NATIONAL,
	"international":     trunks.NumberFormat_INTERNATIONAL,
}

// numberFormatOf maps a YAML number format, in any case, to the enum.
func numberFormatOf(value string) (trunks.NumberFormat, bool) {
	f, ok := numberFormatsOfYAML[strings.ToLower(value)]
	return f, ok
}

func (r *resource) validateTrunkNumberFormats() error {
	if r.Spec.NormalizeToE164 != nil {
		return r.refused("normalizeToE164 was removed in Routr 3: use calledNumberFormat and callerNumberFormat")
	}
	called, ok := numberFormatOf(r.Spec.CalledNumberFormat)
	if !ok {
		return bad("/spec/calledNumberFormat", "must be equal to one of the allowed values (e164, e164-without-plus, national, international)")
	}
	caller, ok := numberFormatOf(r.Spec.CallerNumberFormat)
	if !ok {
		return bad("/spec/callerNumberFormat", "must be equal to one of the allowed values (e164, e164-without-plus, national, international)")
	}
	err := validateTrunkNumberFormats(
		trunkNumberFormat{"calledNumber", called, r.Spec.CalledNumberPrefix},
		trunkNumberFormat{"callerNumber", caller, r.Spec.CallerNumberPrefix},
	)
	var refused *BadRequestError
	if errors.As(err, &refused) {
		return r.refused(refused.Message)
	}
	return err
}

var trunkTransports = map[string]bool{
	"TCP": true, "SCTP": true, "UDP": true, "TLS": true, "WS": true, "WSS": true,
}

func (r *resource) validateTrunk() error {
	if err := r.validateTrunkNumberFormats(); err != nil {
		return err
	}
	if len(r.Spec.FromDomain) > 255 {
		return bad("/spec/fromDomain", "must NOT have more than 255 characters")
	}
	if in := r.Spec.Inbound; in != nil {
		if in.URI == "" {
			return bad("/spec/inbound", "must have required property 'uri'")
		}
		if len(in.URI) > 255 {
			return bad("/spec/inbound/uri", "must NOT have more than 255 characters")
		}
	}
	out := r.Spec.Outbound
	if out == nil {
		return nil
	}
	if out.URIs == nil {
		return bad("/spec/outbound", "must have required property 'uris'")
	}
	for i, u := range out.URIs {
		path := fmt.Sprintf("/spec/outbound/uris/%d/uri", i)
		if u.URI.Host == "" {
			return bad(path, "must have required property 'host'")
		}
		if len(u.URI.Host) > 255 {
			return bad(path+"/host", "must NOT have more than 255 characters")
		}
		if u.URI.Port == nil {
			return bad(path, "must have required property 'port'")
		}
		if *u.URI.Port > 65535 {
			return bad(path+"/port", "must be <= 65535")
		}
		if u.URI.Transport == "" {
			return bad(path, "must have required property 'transport'")
		}
		if !trunkTransports[strings.ToUpper(u.URI.Transport)] {
			return bad(path+"/transport", "must be equal to one of the allowed values (TCP, SCTP, UDP, TLS, WS, WSS)")
		}
		if len(u.URI.User) > 60 {
			return bad(path+"/user", "must NOT have more than 60 characters")
		}
		if u.Weight != nil && (*u.Weight < 1 || *u.Weight > 65535) {
			return bad(fmt.Sprintf("/spec/outbound/uris/%d/weight", i), "must be between 1 and 65535")
		}
		if u.Priority != nil && (*u.Priority < 0 || *u.Priority > 65535) {
			return bad(fmt.Sprintf("/spec/outbound/uris/%d/priority", i), "must be between 0 and 65535")
		}
	}
	return nil
}

func (r *resource) validateACL() error {
	rules := r.Spec.AccessControlList
	if rules == nil {
		return nil
	}
	if err := validateACLRules("/spec/accessControlList/allow", rules.Allow); err != nil {
		return err
	}
	return validateACLRules("/spec/accessControlList/deny", rules.Deny)
}

// validateACLRules checks one list of the ACL: present means at least one
// item, 7 to 18 characters each, no duplicates.
func validateACLRules(path string, rules []string) error {
	if rules == nil {
		return nil
	}
	if len(rules) == 0 {
		return bad(path, "must NOT have fewer than 1 items")
	}
	seen := make(map[string]bool, len(rules))
	for i, rule := range rules {
		if len(rule) < 7 || len(rule) > 18 {
			return bad(fmt.Sprintf("%s/%d", path, i), "must have between 7 and 18 characters")
		}
		if seen[rule] {
			return bad(path, "must NOT have duplicate items")
		}
		seen[rule] = true
	}
	return nil
}
