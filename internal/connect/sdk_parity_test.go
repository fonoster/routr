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

package connect

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// The Go processor SDK (pkg/processor) carries a copy of this package's
// alterations, helper, identity, route and phone code: it is a module of its
// own, and this one can't import it (the protobuf stubs would register
// twice). TestSDKMirrorsConnect keeps the two copies together by reading the
// source of both. Every function of the mirrored files is in one of the four
// lists below.
//
// When it fails:
//
//   - A pair of sdkSame differs: carry the change to the other side, with its
//     test case. If the two must differ, move the pair to sdkDeviates with
//     the reason.
//   - A function of sdkDeviates or connectPinned changed: read the change,
//     carry it to the SDK if it applies there, then set the hash the failure
//     prints. The hash only records that someone compared the two.
//   - A function is not listed: pair it with its twin in pkg/processor, pin
//     it in connectPinned when the SDK depends on it without a twin, or add it
//     to connectOnly.
//   - A function of sdkFrozen changed: it is published API that keeps its
//     v0.1.0 behavior. Revert it and add a function next to it instead.

// sdkDir is pkg/processor, from this package's directory (where go test runs).
const sdkDir = "../../pkg/processor"

// mirroredFiles are the files of this package whose functions are accounted
// for. A twin is looked up in every non-test file of pkg/processor.
var mirroredFiles = []string{"alterations.go", "helper.go", "identity.go", "route.go"}

// identicalFiles are the same in both packages after the package clause.
var identicalFiles = []string{"phone.go", "phone_data.go"}

// sdkSame pairs a function here with its twin in pkg/processor: the two
// declarations are equal once comments and layout are out and sdkRenames are
// applied to this package's side.
var sdkSame = map[string]string{
	"(*noListeningPointError).Error": "(*noListeningPointError).Error",
	"addRouteToNextHop":              "AddRouteToNextHop",
	"addRouteToPeerEdgePort":         "AddRouteToPeerEdgePortOwnAddress",
	"addXEdgePortRef":                "AddXEdgePortRef",
	"applyIdentity":                  "applyIdentity",
	"buildRoute":                     "buildRoute",
	"contains":                       "contains",
	"containsFold":                   "containsFold",
	"createRoute":                    "createRoute",
	"decodeIdentity":                 "decodeIdentity",
	"decodeIdentityUser":             "decodeIdentityUser",
	"decreaseMaxForwards":            "DecreaseMaxForwards",
	"encodeIdentity":                 "encodeIdentity",
	"fixInvalidContact":              "FixInvalidContact",
	"fixRequestURI":                  "FixRequestURI",
	"getHeaderValue":                 "HeaderValue",
	"getListeningPoint":              "getListeningPoint",
	"getLocalnetIP":                  "getLocalnetIP",
	"hasIP":                          "hasIP",
	"identityUser":                   "identityUser",
	"isAnonymous":                    "IsAnonymous",
	"isLoopback":                     "isLoopback",
	"isOwnRoute":                     "isOwnRoute",
	"isPeerRoute":                    "isPeerRoute",
	"isResponse":                     "IsTypeResponse",
	"isSelfRoute":                    "isSelfRoute",
	"localnetHost":                   "localnetHost",
	"normalizeE164Alteration":        "NormalizeToE164",
	"parseNet":                       "parseNet",
	"peerFacingInterface":            "peerFacingInterface",
	"peerOwnAddress":                 "peerOwnAddress",
	"portOf":                         "portOf",
	"prependRoute":                   "prependRoute",
	"recordRouteBetween":             "recordRouteBetween",
	"recordRouteEntry":               "recordRouteEntry",
	"removeAuthorization":            "RemoveAuthorization",
	"removeRoutesUpToOwn":            "RemoveRoutesUpToOwn",
	"removeSelfRoutes":               "RemoveSelfRoutes",
	"removeTopVia":                   "RemoveTopVia",
	"routeIdentityMapping":           "routeIdentityMapping",
	"sameIdentity":                   "sameIdentity",
	"sessionCountOf":                 "sessionCountOf",
	"sourceAddress":                  "SourceAddress",
	"swapIdentity":                   "swapIdentity",
	"swapIdentityFromRouteSet":       "SwapIdentityFromRouteSet",
	"transportOf":                    "transportOf",
	"uriChanged":                     "uriChanged",
	"uriPort":                        "uriPort",
}

// deviation is a pair that differs on purpose: why, and the hash of each
// side's declaration when the two were last compared.
type deviation struct {
	sdk     string
	reason  string
	connect string // hash of this package's declaration
	twin    string // hash of pkg/processor's
}

// pinned is a function with no twin in pkg/processor that the comparison
// still depends on: why, and the hash of its declaration.
type pinned struct {
	reason string
	hash   string
}

// connectPinned are pinned by hash: a change to one is looked at for the SDK.
var connectPinned = map[string]pinned{
	"routeFromPB": {
		reason: "the SDK reads *location.Route where Connect reads its own route, which this builds; sdkRenames map one onto the other, so a change in how a field is read here (the transport's spelling, a port) is one the SDK may need",
		hash:   "e04dc710cfe96dcd",
	},
}

// sdkDeviates are the deliberate differences, in form except for
// createRouteFromLastMessage, which the SDK folds Connect's next step into.
// The first five are the cross-EdgePort functions (#613), whose SDK twins sit
// next to the functions sdkFrozen keeps as they were.
var sdkDeviates = map[string]deviation{
	"addSelfViaUsingExternalAddrs": {
		sdk:     "addSelfViaUsingExternalAddrsFromPeer",
		reason:  "form: prependVia takes a host, port and transport; unexported, reached through AddSelfViaTowardNextHop, since the exported AddSelfViaUsingExternalAddrs keeps its v0.1 form",
		connect: "78e65b7c0c2ffb92", twin: "a503cfb5afbad51c",
	},
	"addSelfViaTowardNextHop": {
		sdk:     "AddSelfViaTowardNextHop",
		reason:  "form: prependVia takes a host, port and transport",
		connect: "8128ac3ed36f0b9c", twin: "dc37c32b1c801214",
	},
	"addSelfRecordRoute": {
		sdk:     "AddSelfRecordRouteFromPeer",
		reason:  "form: peerSource is an argument, not a field of Connect's route",
		connect: "86391ee6ec466a36", twin: "572ca4631c32ad3c",
	},
	"createRouteFromLastMessage": {
		sdk:     "createRouteFromPeer",
		reason:  "behavior: also applies handleRequest's transport override (connect.go: the sender's transport when the Request-URI names none), which Connect applies after; the expiry is an argument",
		connect: "ec917b3697786160", twin: "58dad0f346b7e76d",
	},
	"addSelfRecordRouteToPeer": {
		sdk:     "AddSelfRecordRouteToPeer",
		reason:  "form: the fallback passes an empty peerSource, which Connect's route carries (empty on a route toward a peer)",
		connect: "8c2772995befd850", twin: "ceb50a16c3e21065",
	},
	"addSelfVia": {
		sdk:     "AddSelfVia",
		reason:  "form: EdgeInterface takes the route's transport as the enum, and prependVia a host, port and transport",
		connect: "3ca7e7ded4d401ee", twin: "a295ff8e5866fa51",
	},
	"prependVia": {
		sdk:     "prependVia",
		reason:  "form: takes a host, port and transport, since AddSelfViaUsingTheRouteHeaders builds a Via from a Route header, not from an interface",
		connect: "89ac98e98729dbdc", twin: "3337b200b65a48e8",
	},
	"applyXHeaders": {
		sdk:     "ApplyXHeaders",
		reason:  "form: the modifiers are an argument of the exported HeaderModifier, not the route's headers",
		connect: "191e5de44e127b70", twin: "e974b56a940769fc",
	},
	"removeHeaders": {
		sdk:     "RemoveHeaders",
		reason:  "form: the names are variadic",
		connect: "4c0f9ac13c1cd37c", twin: "b9f2541cbd42e879",
	},
	"removeXEdgePortRef": {
		sdk:     "RemoveXEdgePortRef",
		reason:  "form: calls the variadic RemoveHeaders",
		connect: "edec2aa4167249cc", twin: "17bb7fa9192bc19b",
	},
	"getEdgeInterface": {
		sdk:     "edgeInterface",
		reason:  "form: Nets has exported fields, and the two errors wrap ErrNoInterface and ErrListeningPointHost with the same text",
		connect: "de1bc6f1a11c358f", twin: "ddc395802ced7cee",
	},
	"netsOfRequest": {
		sdk:     "NetsOf",
		reason:  "form: returns the exported Nets",
		connect: "ddc9e3a54a555660", twin: "4f2d82753f699ebd",
	},
	"(*route).nets": {
		sdk:     "NetsOfRoute",
		reason:  "form: a function of *location.Route, not a method of Connect's route",
		connect: "4cb173daa480283e", twin: "72943c8da53d4ad7",
	},
	"identityRewriteParameters": {
		sdk:     "IdentityRewriteParameters",
		reason:  "form: takes the request before and after the rewrite, not the four URIs",
		connect: "0154df85c954e743", twin: "e5e1b7b61b7875ad",
	},
	"rewriteFromWithNumber": {
		sdk:     "RewriteFromWithNumber",
		reason:  "form: the rewrite is an argument (FromRewrite), not the route's rewriteFrom",
		connect: "75dffdee901fedde", twin: "e8495a704a03fab2",
	},
	"targetAOR": {
		sdk:     "TargetAOR",
		reason:  "form: delegates to the exported AOR",
		connect: "e91d76eb4c4ca6ed", twin: "bd6a79559222296e",
	},
	"targetExpires": {
		sdk:     "TargetExpires",
		reason:  "form: the default is named def",
		connect: "0e744f0c1145a125", twin: "d8e537e78f7bfb91",
	},
}

// connectOnly have no twin in pkg/processor: what Connect decides about
// trust, peers and its own route type.
var connectOnly = []string{
	"agentAOR",
	"applyTrunkIdentity",
	"hasConnectToken",
	"isFromAddresses",
	"isFromRegistry",
	"isFromTrustedEdgePort",
	"isInDialog",
	"untrustedHeadersToStrip",
}

// frozen is an exported function of pkg/processor kept as it was published:
// why, and the hash of its declaration.
type frozen struct {
	reason string
	hash   string
}

// sdkFrozen are pkg/processor's own functions whose Connect counterpart moved
// to a newer twin (#613). They keep the behavior pkg/processor/v0.1.0
// published; the hash fails any change to one.
var sdkFrozen = map[string]frozen{
	"AddSelfViaUsingExternalAddrs": {
		reason: "v0.1.0: no fromPeer and no fallback to the sender's transport; AddSelfViaTowardNextHop has Connect's",
		hash:   "1eaa99011cb4b701",
	},
	"AddRouteToPeerEdgePort": {
		reason: "v0.1.0: always the peer's interface facing the endpoint; AddRouteToPeerEdgePortOwnAddress has Connect's",
		hash:   "3a4c340a9e1769e0",
	},
	"AddSelfRecordRoute": {
		reason: "v0.1.0: the origin faces the sender, recordRouteBetween inlined; AddSelfRecordRouteFromPeer has Connect's",
		hash:   "8839a2bf0904320b",
	},
}

// sdkRenames turn this package's spelling into pkg/processor's: the import
// names and the fields of Connect's route, which the SDK reads from
// *location.Route. The paired functions' own names are added to them.
var sdkRenames = [][2]string{
	{`\bspb\.`, "sipmessage."},
	{`\blpb\.`, "location."},
	{`\bppb\.`, ""},
	{`\br \*route\b`, "route *location.Route"},
	{`\br\.registeredOn\b`, "route.GetRegisteredOn()"},
	{`\br\.user\b`, "route.GetUser()"},
	{`\br\.host\b`, "route.GetHost()"},
	{`\br\.port\b`, "portOf(route.GetPort())"},
	{`\br\.transport\b`, "route.GetTransport().String()"},
	{`\br\.localnets\b`, "route.GetLocalnets()"},
	{`\br\.listeningPoints\b`, "route.GetListeningPoints()"},
	{`\br\.advertisedHost\b`, "route.GetAdvertisedHost()"},
	{`\br\.nets\(\)`, "NetsOfRoute(route)"},
	{`\(req, r\)`, "(req, route)"},
	{`\(req, r, `, "(req, route, "},
}

// mirroredFunc is a function declaration without its comments and layout.
type mirroredFunc struct {
	file string
	text string
}

func (f mirroredFunc) hash() string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(f.text)))[:16]
}

// functionsOf are the functions and methods the files of dir declare, by
// name ("(*T).name" for a method). The declaration is printed from a parse
// without comments, each line trimmed and the blank ones dropped (the printer
// leaves one where a comment stood), so only a change to the code shows. pkg
// is how a failure names dir.
func functionsOf(t *testing.T, pkg, dir string, files []string) map[string]mirroredFunc {
	t.Helper()
	fset := token.NewFileSet()
	out := map[string]mirroredFunc{}
	for _, name := range files {
		file, err := parser.ParseFile(fset, filepath.Join(dir, name), nil, parser.SkipObjectResolution)
		if err != nil {
			t.Fatalf("unable to read %s: %v", filepath.Join(dir, name), err)
		}
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok {
				continue
			}
			key := fn.Name.Name
			if fn.Recv != nil && len(fn.Recv.List) > 0 {
				var recv bytes.Buffer
				if err := printer.Fprint(&recv, fset, fn.Recv.List[0].Type); err != nil {
					t.Fatal(err)
				}
				key = "(" + recv.String() + ")." + key
			}
			fn.Doc = nil
			var printed bytes.Buffer
			if err := printer.Fprint(&printed, fset, fn); err != nil {
				t.Fatal(err)
			}
			var lines []string
			for _, line := range strings.Split(printed.String(), "\n") {
				if line = strings.TrimSpace(line); line != "" {
					lines = append(lines, line)
				}
			}
			out[key] = mirroredFunc{file: pkg + "/" + name, text: strings.Join(lines, "\n")}
		}
	}
	return out
}

// sdkSpelling applies sdkRenames and the paired names to a declaration of
// this package.
func sdkSpelling(text string) string {
	renames := append([][2]string{}, sdkRenames...)
	pair := func(connect, sdk string) {
		if connect != sdk && !strings.Contains(connect, ".") {
			renames = append(renames, [2]string{`\b` + connect + `\b`, sdk})
		}
	}
	for connect, sdk := range sdkSame {
		pair(connect, sdk)
	}
	for connect, d := range sdkDeviates {
		pair(connect, d.sdk)
	}
	for _, r := range renames {
		text = regexp.MustCompile(r[0]).ReplaceAllString(text, r[1])
	}
	return text
}

// firstDifference is the first line on which two texts differ, from each.
func firstDifference(a, b string) (string, string) {
	as, bs := strings.Split(a, "\n"), strings.Split(b, "\n")
	for i := 0; i < len(as) || i < len(bs); i++ {
		var la, lb string
		if i < len(as) {
			la = as[i]
		}
		if i < len(bs) {
			lb = bs[i]
		}
		if la != lb {
			return la, lb
		}
	}
	return "", ""
}

// afterPackageClause is a file's content from the line after "package x".
func afterPackageClause(t *testing.T, path string) string {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("unable to read %s: %v", path, err)
	}
	_, rest, found := strings.Cut(string(content), "\npackage ")
	if !found {
		t.Fatalf("%s has no package clause", path)
	}
	_, rest, _ = strings.Cut(rest, "\n")
	return rest
}

func TestSDKMirrorsConnect(t *testing.T) {
	for _, name := range identicalFiles {
		ours, theirs := afterPackageClause(t, name), afterPackageClause(t, filepath.Join(sdkDir, name))
		if ours != theirs {
			a, b := firstDifference(ours, theirs)
			t.Errorf("internal/connect/%s and pkg/processor/%s differ: they are the same file but for the package clause; carry the change to the other side\n--- connect\n%s\n+++ sdk\n%s", name, name, a, b)
		}
	}

	sdkFiles, err := filepath.Glob(filepath.Join(sdkDir, "*.go"))
	if err != nil || len(sdkFiles) == 0 {
		t.Fatalf("no Go files in %s (%v)", sdkDir, err)
	}
	var sdkNames []string
	for _, path := range sdkFiles {
		if !strings.HasSuffix(path, "_test.go") {
			sdkNames = append(sdkNames, filepath.Base(path))
		}
	}
	connect := functionsOf(t, "internal/connect", ".", mirroredFiles)
	sdk := functionsOf(t, "pkg/processor", sdkDir, sdkNames)

	listed := map[string]int{}
	for name := range sdkSame {
		listed[name]++
	}
	for name := range sdkDeviates {
		listed[name]++
	}
	for name := range connectPinned {
		listed[name]++
	}
	for _, name := range connectOnly {
		listed[name]++
	}
	names := make([]string, 0, len(connect))
	for name := range connect {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		switch listed[name] {
		case 0:
			t.Errorf("%s %s is not listed: pair it with its twin in pkg/processor (sdkSame or sdkDeviates), pin it in connectPinned, or list it in connectOnly", connect[name].file, name)
		case 1:
		default:
			t.Errorf("%s is in more than one list", name)
		}
	}
	for name := range listed {
		if _, ok := connect[name]; !ok {
			t.Errorf("%s is listed but %v declare no such function: remove it from its list", name, mirroredFiles)
		}
	}

	for _, name := range names {
		ours := connect[name]
		if twin, ok := sdkSame[name]; ok {
			theirs, ok := sdk[twin]
			if !ok {
				t.Errorf("%s %s is paired with %s, which pkg/processor does not declare", ours.file, name, twin)
				continue
			}
			if want := sdkSpelling(ours.text); want != theirs.text {
				a, b := firstDifference(want, theirs.text)
				t.Errorf("%s %s and %s %s differ:\ncarry the change to the other side, or list the pair in sdkDeviates with its reason\n--- connect\n%s\n+++ sdk\n%s", ours.file, name, theirs.file, twin, a, b)
			}
		}
		if d, ok := sdkDeviates[name]; ok {
			theirs, ok := sdk[d.sdk]
			if !ok {
				t.Errorf("%s %s is paired with %s, which pkg/processor does not declare", ours.file, name, d.sdk)
				continue
			}
			if d.reason == "" {
				t.Errorf("%s deviates from %s without a reason", name, d.sdk)
			}
			if sdkSpelling(ours.text) == theirs.text {
				t.Errorf("%s %s and %s %s no longer differ: move the pair to sdkSame", ours.file, name, theirs.file, d.sdk)
			}
			if got := ours.hash(); got != d.connect {
				t.Errorf("%s %s changed since it was last compared with pkg/processor's %s:\ncarry the change to the other side if it applies there, then set the hash (connect) to %q", ours.file, name, d.sdk, got)
			}
			if got := theirs.hash(); got != d.twin {
				t.Errorf("%s %s changed since it was last compared with internal/connect's %s:\ncarry the change to the other side if it applies there, then set the hash (twin) to %q", theirs.file, d.sdk, name, got)
			}
		}
		if p, ok := connectPinned[name]; ok {
			if p.reason == "" {
				t.Errorf("%s is pinned without a reason", name)
			}
			if got := ours.hash(); got != p.hash {
				t.Errorf("%s %s changed since it was last looked at for pkg/processor (see its reason in connectPinned):\ncarry the change to the SDK if it applies there, then set its hash to %q", ours.file, name, got)
			}
		}
	}
	twins := map[string]bool{}
	for _, twin := range sdkSame {
		twins[twin] = true
	}
	for _, d := range sdkDeviates {
		twins[d.sdk] = true
	}
	for name, f := range sdkFrozen {
		theirs, ok := sdk[name]
		switch {
		case !ok:
			t.Errorf("%s is in sdkFrozen but pkg/processor declares no such function: remove it", name)
			continue
		case twins[name]:
			t.Errorf("%s is in sdkFrozen and is a twin of a Connect function: keep it in one place", name)
		case f.reason == "":
			t.Errorf("%s is frozen without a reason", name)
		}
		if got := theirs.hash(); got != f.hash {
			t.Errorf("%s %s changed: it keeps the behavior pkg/processor/v0.1.0 published (%s); add a new function instead, or, for a change in form only, set its hash to %q", theirs.file, name, f.reason, got)
		}
	}
	for _, name := range connectOnly {
		for _, twin := range []string{name, strings.ToUpper(name[:1]) + name[1:]} {
			if theirs, ok := sdk[twin]; ok {
				t.Errorf("%s is listed in connectOnly, but %s declares %s: pair them", name, theirs.file, twin)
			}
		}
	}
}
