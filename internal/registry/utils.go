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

package registry

import (
	"context"
	"errors"
	"fmt"

	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// jsUndefined is how Routr 2's X-Gateway-Auth spells a credential the Data API
// left out: the pair went through a JavaScript template.
const jsUndefined = "undefined"

// findTrunks asks the Data API for the Trunks that want a REGISTER.
func findTrunks(ctx context.Context, client trunks.TrunksClient) ([]*trunks.Trunk, error) {
	res, err := client.FindBy(ctx, &trunks.FindByRequest{FieldName: "sendRegister", FieldValue: "true"})
	if err != nil {
		return nil, err
	}
	return res.GetItems(), nil
}

// unregisteredTrunks leaves out the Trunks with a live entry in the store,
// whatever its status.
func unregisteredTrunks(ctx context.Context, store Store, candidates []*trunks.Trunk) ([]*trunks.Trunk, error) {
	entries, err := store.List(ctx)
	if err != nil {
		return nil, err
	}
	stored := make(map[string]struct{}, len(entries))
	for _, entry := range entries {
		stored[entry.TrunkRef] = struct{}{}
	}
	unregistered := make([]*trunks.Trunk, 0, len(candidates))
	for _, trunk := range candidates {
		if _, ok := stored[trunk.GetRef()]; !ok {
			unregistered = append(unregistered, trunk)
		}
	}
	return unregistered, nil
}

// requestParamsFromTrunk builds a Trunk's REGISTER parameters from its first
// URI, and sends it through the first EdgePort. A Trunk with no outbound
// credentials still gets X-Gateway-Auth, of "undefined:undefined", as in Routr 2.
func requestParamsFromTrunk(trunk *trunks.Trunk, spec Spec) (RequestParams, error) {
	if len(trunk.GetUris()) == 0 {
		return RequestParams{}, errors.New("the trunk has no uris")
	}
	if len(spec.EdgePorts) == 0 {
		return RequestParams{}, errors.New("spec.edgePorts is empty")
	}
	uri := trunk.GetUris()[0]
	if uri.GetHost() == "" || uri.GetPort() == 0 {
		return RequestParams{}, errors.New("the first uri of the trunk needs a host and a port")
	}
	return RequestParams{
		TrunkRef:      trunk.GetRef(),
		User:          uri.GetUser(),
		TargetDomain:  uri.GetHost(),
		TargetAddress: fmt.Sprintf("%s:%d", uri.GetHost(), uri.GetPort()),
		ProxyAddress:  spec.EdgePorts[0].Address,
		Transport:     uri.GetTransport(),
		Auth: &Auth{
			Username: orUndefined(trunk.GetOutboundCredentials().GetUsername()),
			Secret:   orUndefined(trunk.GetOutboundCredentials().GetPassword()),
		},
		Methods: spec.Methods,
	}, nil
}

func orUndefined(value string) string {
	if value == "" {
		return jsUndefined
	}
	return value
}
