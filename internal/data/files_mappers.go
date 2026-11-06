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
	"strconv"
	"strings"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trace"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// filesBuilder turns validated resources into the messages the files
// backend serves, resolving every *Ref to the resource it names the way
// simpledata's loaders did (mods/simpledata/src/loaders): an Agent embeds
// its Domain and Credentials, a Domain its ACL and the Numbers of its egress
// policies (each with its Trunk), a Number its Trunk, a Trunk its ACL and
// both Credentials, a Peer its Credentials.
type filesBuilder struct {
	byRef map[string]*resource
	// now is the load time in Unix seconds: every resource's createdAt and
	// updatedAt, as simpledata stamped them at load
	now int32
}

// resolve returns the resource a ref names, or nil for an empty ref. A ref
// that names nothing is the error simpledata exited with; a ref that names a
// resource of another kind is an error too (simpledata embedded it as is).
func (b *filesBuilder) resolve(ref string, want Kind) (*resource, error) {
	if ref == "" {
		return nil, nil
	}
	r, ok := b.byRef[ref]
	if !ok {
		return nil, fmt.Errorf("the resource with ref %s does not exist in the configuration file", ref)
	}
	if got := kindOf(r.Kind); got != want {
		return nil, fmt.Errorf("the resource with ref %s is a %s, not a %s", ref, got, want)
	}
	return r, nil
}

// build maps one resource of any kind.
func (b *filesBuilder) build(r *resource) (proto.Message, error) {
	switch kindOf(r.Kind) {
	case KindAgent:
		return b.agent(r)
	case KindPeer:
		return b.peer(r)
	case KindNumber:
		return b.number(r)
	case KindTrunk:
		return b.trunk(r)
	case KindDomain:
		return b.domain(r)
	case KindCredentials:
		return b.credentials(r), nil
	case KindACL:
		return b.acl(r), nil
	}
	return nil, fmt.Errorf("unknown resource kind %q", r.Kind)
}

func (b *filesBuilder) acl(r *resource) *acl.AccessControlList {
	out := &acl.AccessControlList{
		ApiVersion: r.APIVersion,
		Ref:        r.Ref,
		Name:       r.Metadata.Name,
		CreatedAt:  b.now,
		UpdatedAt:  b.now,
	}
	if rules := r.Spec.AccessControlList; rules != nil {
		out.Allow = rules.Allow
		out.Deny = rules.Deny
	}
	return out
}

func (b *filesBuilder) credentials(r *resource) *credentials.Credentials {
	return &credentials.Credentials{
		ApiVersion: r.APIVersion,
		Ref:        r.Ref,
		Name:       r.Metadata.Name,
		Username:   r.Spec.Credentials.Username,
		Password:   r.Spec.Credentials.Password,
		CreatedAt:  b.now,
		UpdatedAt:  b.now,
	}
}

func (b *filesBuilder) trunk(r *resource) (*trunks.Trunk, error) {
	out := &trunks.Trunk{
		ApiVersion:            r.APIVersion,
		Ref:                   r.Ref,
		Name:                  r.Metadata.Name,
		NormalizeToE164:       boolOf(r.Spec.NormalizeToE164, false),
		RewriteFromWithNumber: boolOf(r.Spec.RewriteFromWithNumber, false),
		FromDomain:            r.Spec.FromDomain,
		Trace:                 traceOf(r.Spec.Trace),
		CreatedAt:             b.now,
		UpdatedAt:             b.now,
	}
	if in := r.Spec.Inbound; in != nil {
		out.InboundUri = in.URI
		aclRes, err := b.resolve(in.AccessControlListRef, KindACL)
		if err != nil {
			return nil, err
		}
		if aclRes != nil {
			out.AccessControlList = b.acl(aclRes)
		}
		creds, err := b.resolve(in.CredentialsRef, KindCredentials)
		if err != nil {
			return nil, err
		}
		if creds != nil {
			out.InboundCredentials = b.credentials(creds)
		}
	}
	if o := r.Spec.Outbound; o != nil {
		out.SendRegister = o.SendRegister
		creds, err := b.resolve(o.CredentialsRef, KindCredentials)
		if err != nil {
			return nil, err
		}
		if creds != nil {
			out.OutboundCredentials = b.credentials(creds)
		}
		for _, u := range o.URIs {
			out.Uris = append(out.Uris, &trunks.TrunkURI{
				User:      u.URI.User,
				Host:      u.URI.Host,
				Port:      int32Of(u.URI.Port, 0),
				Transport: strings.ToUpper(u.URI.Transport),
				Enabled:   boolOf(u.Enabled, false),
				Weight:    int32Of(u.Weight, 0),
				Priority:  int32Of(u.Priority, 0),
			})
		}
	}
	return out, nil
}

func (b *filesBuilder) number(r *resource) (*numbers.Number, error) {
	geo := r.Metadata.GeoInfo
	loc := r.Spec.Location
	out := &numbers.Number{
		ApiVersion:            r.APIVersion,
		Ref:                   r.Ref,
		Name:                  r.Metadata.Name,
		City:                  geo.City,
		Country:               geo.Country,
		CountryIsoCode:        geo.CountryIsoCode,
		TelUrl:                loc.TelURL,
		AorLink:               loc.AORLink,
		SessionAffinityHeader: loc.SessionAffinityHeader,
		CreatedAt:             b.now,
		UpdatedAt:             b.now,
	}
	for _, h := range loc.ExtraHeaders {
		out.ExtraHeaders = append(out.ExtraHeaders, &numbers.ExtraHeader{Name: h.Name, Value: h.Value})
	}
	trunkRes, err := b.resolve(r.Spec.TrunkRef, KindTrunk)
	if err != nil {
		return nil, err
	}
	if trunkRes != nil {
		if out.Trunk, err = b.trunk(trunkRes); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (b *filesBuilder) domain(r *resource) (*domains.Domain, error) {
	out := &domains.Domain{
		ApiVersion: r.APIVersion,
		Ref:        r.Ref,
		Name:       r.Metadata.Name,
		DomainUri:  r.Spec.Context.DomainURI,
		Trace:      traceOf(r.Spec.Trace),
		CreatedAt:  b.now,
		UpdatedAt:  b.now,
	}
	aclRes, err := b.resolve(r.Spec.AccessControlListRef, KindACL)
	if err != nil {
		return nil, err
	}
	if aclRes != nil {
		out.AccessControlList = b.acl(aclRes)
	}
	for _, p := range r.Spec.Context.EgressPolicies {
		numRes, err := b.resolve(p.NumberRef, KindNumber)
		if err != nil {
			return nil, err
		}
		policy := &domains.EgressPolicy{Rule: p.Rule, NumberRef: p.NumberRef}
		if numRes != nil {
			if policy.Number, err = b.number(numRes); err != nil {
				return nil, err
			}
		}
		out.EgressPolicies = append(out.EgressPolicies, policy)
	}
	return out, nil
}

func (b *filesBuilder) agent(r *resource) (*agents.Agent, error) {
	out := &agents.Agent{
		ApiVersion:  r.APIVersion,
		Ref:         r.Ref,
		Name:        r.Metadata.Name,
		Username:    r.Spec.Username,
		Privacy:     privacyOf(r.Spec.Privacy),
		Enabled:     boolOf(r.Spec.Enabled, false),
		MaxContacts: int32Of(r.Spec.MaxContacts, -1),
		Expires:     int32Of(r.Spec.Expires, 0),
		Trace:       traceOf(r.Spec.Trace),
		CreatedAt:   b.now,
		UpdatedAt:   b.now,
	}
	domainRes, err := b.resolve(r.Spec.DomainRef, KindDomain)
	if err != nil {
		return nil, err
	}
	if domainRes != nil {
		if out.Domain, err = b.domain(domainRes); err != nil {
			return nil, err
		}
	}
	creds, err := b.resolve(r.Spec.CredentialsRef, KindCredentials)
	if err != nil {
		return nil, err
	}
	if creds != nil {
		out.Credentials = b.credentials(creds)
	}
	return out, nil
}

func (b *filesBuilder) peer(r *resource) (*peers.Peer, error) {
	out := &peers.Peer{
		ApiVersion:  r.APIVersion,
		Ref:         r.Ref,
		Name:        r.Metadata.Name,
		Username:    r.Spec.Username,
		Aor:         r.Spec.AOR,
		ContactAddr: r.Spec.ContactAddr,
		Enabled:     boolOf(r.Spec.Enabled, false),
		MaxContacts: int32Of(r.Spec.MaxContacts, -1),
		Expires:     int32Of(r.Spec.Expires, 0),
		Trace:       traceOf(r.Spec.Trace),
		CreatedAt:   b.now,
		UpdatedAt:   b.now,
	}
	if lb := r.Spec.LoadBalancing; lb != nil {
		out.BalancingAlgorithm = balancingAlgorithmOf(lb.Algorithm)
		out.WithSessionAffinity = lb.WithSessionAffinity
	}
	creds, err := b.resolve(r.Spec.CredentialsRef, KindCredentials)
	if err != nil {
		return nil, err
	}
	if creds != nil {
		out.Credentials = b.credentials(creds)
	}
	return out, nil
}

// privacyOf maps the YAML privacy (Private, None, in any case) to the enum.
// Absent means NONE, as mapToAgent defaulted it.
func privacyOf(value string) agents.Privacy {
	if strings.EqualFold(value, "private") {
		return agents.Privacy_PRIVATE
	}
	return agents.Privacy_NONE
}

// balancingAlgorithmOf maps the YAML algorithm (round-robin, least-sessions)
// to the enum the way mapToPeer normalized it: dashes to underscores, upper
// case. Absent or unknown means UNSPECIFIED.
func balancingAlgorithmOf(value string) peers.LoadBalancingAlgorithm {
	name := strings.ToUpper(strings.ReplaceAll(value, "-", "_"))
	if v, ok := peers.LoadBalancingAlgorithm_value[name]; ok {
		return peers.LoadBalancingAlgorithm(v)
	}
	return peers.LoadBalancingAlgorithm_UNSPECIFIED
}

func traceOf(t *traceSettings) *trace.Trace {
	if t == nil {
		return nil
	}
	return &trace.Trace{Enabled: boolOf(t.Enabled, false)}
}

func boolOf(v *bool, def bool) bool {
	if v == nil {
		return def
	}
	return *v
}

func int32Of(v *int32, def int32) int32 {
	if v == nil {
		return def
	}
	return *v
}

// fieldsOf lists the scalar fields FindBy can match for the files backend:
// the fields of simpledata's resource model (CommonConnect.ConnectModel),
// each as the string its value prints as, which is how simpledata compared
// them. An absent optional field is not listed, so no value matches it.
func fieldsOf(r *resource) map[string]string {
	f := map[string]string{
		"apiVersion": r.APIVersion,
		"ref":        r.Ref,
		"name":       r.Metadata.Name,
	}
	set := func(name, value string) {
		if value != "" {
			f[name] = value
		}
	}
	spec := r.Spec
	switch kindOf(r.Kind) {
	case KindAgent:
		f["username"] = spec.Username
		f["privacy"] = privacyOf(spec.Privacy).String()
		f["enabled"] = strconv.FormatBool(boolOf(spec.Enabled, false))
		f["maxContacts"] = strconv.Itoa(int(int32Of(spec.MaxContacts, -1)))
		set("domainRef", spec.DomainRef)
		set("credentialsRef", spec.CredentialsRef)
		if spec.Expires != nil {
			f["expires"] = strconv.Itoa(int(*spec.Expires))
		}
	case KindPeer:
		f["username"] = spec.Username
		f["aor"] = spec.AOR
		f["enabled"] = strconv.FormatBool(boolOf(spec.Enabled, false))
		f["maxContacts"] = strconv.Itoa(int(int32Of(spec.MaxContacts, -1)))
		set("contactAddr", spec.ContactAddr)
		set("credentialsRef", spec.CredentialsRef)
		if spec.Expires != nil {
			f["expires"] = strconv.Itoa(int(*spec.Expires))
		}
		if lb := spec.LoadBalancing; lb != nil {
			set("balancingAlgorithm", balancingAlgorithmOf(lb.Algorithm).String())
			f["withSessionAffinity"] = strconv.FormatBool(lb.WithSessionAffinity)
		}
	case KindNumber:
		f["telUrl"] = spec.Location.TelURL
		set("aorLink", spec.Location.AORLink)
		set("sessionAffinityHeader", spec.Location.SessionAffinityHeader)
		set("city", r.Metadata.GeoInfo.City)
		set("country", r.Metadata.GeoInfo.Country)
		set("countryIsoCode", r.Metadata.GeoInfo.CountryIsoCode)
		set("trunkRef", spec.TrunkRef)
	case KindTrunk:
		sendRegister := spec.Outbound != nil && spec.Outbound.SendRegister
		f["sendRegister"] = strconv.FormatBool(sendRegister)
		f["normalizeToE164"] = strconv.FormatBool(boolOf(spec.NormalizeToE164, false))
		f["rewriteFromWithNumber"] = strconv.FormatBool(boolOf(spec.RewriteFromWithNumber, false))
		set("fromDomain", spec.FromDomain)
		if in := spec.Inbound; in != nil {
			set("inboundUri", in.URI)
			set("inboundCredentialsRef", in.CredentialsRef)
			set("accessControlListRef", in.AccessControlListRef)
		}
		if o := spec.Outbound; o != nil {
			set("outboundCredentialsRef", o.CredentialsRef)
		}
	case KindDomain:
		f["domainUri"] = spec.Context.DomainURI
		set("accessControlListRef", spec.AccessControlListRef)
	case KindCredentials:
		f["username"] = spec.Credentials.Username
		f["password"] = spec.Credentials.Password
	}
	return f
}
