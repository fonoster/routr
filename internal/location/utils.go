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

package location

import (
	"maps"
	"slices"
	"strings"
	"time"

	locationpb "github.com/fonoster/routr/internal/common/pb/location"
)

// The route predicates of mods/location/src/utils.ts.

// deadline is the instant a route expires: registeredOn (Unix milliseconds)
// plus expires seconds.
func deadline(r *locationpb.Route) time.Time {
	return time.UnixMilli(r.GetRegisteredOn() + int64(r.GetExpires())*1000)
}

// isLive is expiredFilter: a route is live while some of its expires is left.
// A route with expires 0 (the unregistration of RFC 3261 section 10.3) is
// never live, so putting it replaces and drops the binding.
func isLive(r *locationpb.Route, now time.Time) bool {
	return r != nil && deadline(r).After(now)
}

// sameEndpoint is the complement of duplicateFilter: two routes reach the same
// host, port and transport, so the newer one replaces the older in a store.
func sameEndpoint(a, b *locationpb.Route) bool {
	return a.GetHost() == b.GetHost() &&
		a.GetPort() == b.GetPort() &&
		a.GetTransport() == b.GetTransport()
}

// sameContact is the "route already exists" check of AddRoute: a registration
// of a contact that is already bound does not count against maxContacts.
func sameContact(a, b *locationpb.Route) bool {
	return a.GetUser() == b.GetUser() && sameEndpoint(a, b)
}

// labelsKey formats the labels of a lookup as the Node service does, sorted
// by key, "key=value" joined by ";", for the per-call key; "" for no labels.
func labelsKey(labels map[string]string) string {
	if len(labels) == 0 {
		return ""
	}
	keys := slices.Sorted(maps.Keys(labels))
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+labels[k])
	}
	return strings.Join(parts, ";")
}

// matchesLabels is filterOnlyMatchingLabels: a route matches when it carries
// exactly the labels of the request; a route without labels never matches.
func matchesLabels(requested map[string]string, r *locationpb.Route) bool {
	return len(r.GetLabels()) > 0 && maps.Equal(requested, r.GetLabels())
}

// withLabels keeps the routes matching the requested labels.
func withLabels(routes []*locationpb.Route, requested map[string]string) []*locationpb.Route {
	matching := routes[:0:0]
	for _, r := range routes {
		if matchesLabels(requested, r) {
			matching = append(matching, r)
		}
	}
	return matching
}

// leastSessions returns the route with the fewest sessions, the first one on
// a tie as the Node service's stable sort did.
func leastSessions(routes []*locationpb.Route) *locationpb.Route {
	var least *locationpb.Route
	for _, r := range routes {
		if least == nil || r.GetSessionCount() < least.GetSessionCount() {
			least = r
		}
	}
	return least
}
