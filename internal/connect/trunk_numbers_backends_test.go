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
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/data"
)

// serverNumbers is a numbers.NumbersClient over the Data API's own server,
// as RoutrOne wires them in one process.
type serverNumbers struct{ srv numbers.NumbersServer }

func (s serverNumbers) Create(ctx context.Context, in *numbers.CreateNumberRequest, _ ...grpc.CallOption) (*numbers.Number, error) {
	return s.srv.Create(ctx, in)
}
func (s serverNumbers) Update(ctx context.Context, in *numbers.UpdateNumberRequest, _ ...grpc.CallOption) (*numbers.Number, error) {
	return s.srv.Update(ctx, in)
}
func (s serverNumbers) Get(ctx context.Context, in *numbers.GetNumberRequest, _ ...grpc.CallOption) (*numbers.Number, error) {
	return s.srv.Get(ctx, in)
}
func (s serverNumbers) Delete(ctx context.Context, in *numbers.DeleteNumberRequest, _ ...grpc.CallOption) (*emptypb.Empty, error) {
	return s.srv.Delete(ctx, in)
}
func (s serverNumbers) List(ctx context.Context, in *numbers.ListNumberRequest, _ ...grpc.CallOption) (*numbers.ListNumbersResponse, error) {
	return s.srv.List(ctx, in)
}
func (s serverNumbers) FindBy(ctx context.Context, in *numbers.FindByRequest, _ ...grpc.CallOption) (*numbers.FindByResponse, error) {
	return s.srv.FindBy(ctx, in)
}

// expectLadder matches every form of the GB Number national (without its
// leading 0) on trunkRef through the index Connect builds from the backend.
func expectLadder(t *testing.T, client numbers.NumbersClient, trunkRef, otherTrunkRef, national, wantRef string) {
	t.Helper()
	c := &Connect{numbers: client, now: time.Now}
	ix, err := c.trunkNumbers(context.Background(), trunkRef)
	if err != nil {
		t.Fatal(err)
	}
	for user, want := range map[string]numberMatch{
		"44" + national:   matchDigits,
		"0" + national:    matchNational,
		national:          matchNational,
		"0044" + national: matchInternational,
		"sales":           matchAlias,
	} {
		got := ix.match(user)
		if got == nil || len(got.ambiguous) > 0 || got.number.GetRef() != wantRef || got.match != want {
			t.Errorf("match(%q) = %+v, want %s %s", user, got, wantRef, want)
		}
	}
	for _, user := range []string{"SALES", national[:7]} {
		if got := ix.match(user); got != nil {
			t.Errorf("match(%q) = %+v, want no match", user, got)
		}
	}
	// The same Number seen from another Trunk matches nothing
	other, err := c.trunkNumbers(context.Background(), otherTrunkRef)
	if err != nil {
		t.Fatal(err)
	}
	if got := other.match("44" + national); got != nil {
		t.Errorf("another Trunk matched %+v", got)
	}
}

// TestTrunkNumbersOnTheBackends runs the ladder against the real files and
// Postgres backends, whose FindBy trunkRef must return the aliases, not
// only against the fake.
func TestTrunkNumbersOnTheBackends(t *testing.T) {
	t.Run("files", func(t *testing.T) {
		dir := t.TempDir()
		content := "- apiVersion: v2\n  kind: Trunk\n  ref: trunk-uk\n  metadata: {name: uk}\n  spec: {inbound: {uri: trunk-uk.acme.com}}\n" +
			"- apiVersion: v2\n  kind: Trunk\n  ref: trunk-us\n  metadata: {name: us}\n  spec: {inbound: {uri: trunk-us.acme.com}}\n" +
			"- apiVersion: v2\n  kind: Number\n  ref: number-uk\n  metadata:\n    name: n\n    geoInfo: {city: London, country: UK, countryIsoCode: gb}\n" +
			"  spec:\n    trunkRef: trunk-uk\n    location: {telUrl: \"tel:+442079460018\", aorLink: \"sip:sales@sip.local\", aliases: [sales]}\n"
		if err := os.WriteFile(filepath.Join(dir, "resources.yaml"), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
		store, err := data.NewFiles(dir)
		if err != nil {
			t.Fatal(err)
		}
		api, err := data.New(store, data.Options{})
		if err != nil {
			t.Fatal(err)
		}
		expectLadder(t, serverNumbers{api.Numbers()}, "trunk-uk", "trunk-us", "2079460018", "number-uk")
	})

	t.Run("postgres", func(t *testing.T) {
		url := os.Getenv("TEST_DATABASE_URL")
		if url == "" {
			t.Skip("TEST_DATABASE_URL is not set")
		}
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		store, err := data.OpenPostgres(ctx, url, data.PostgresOptions{})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = store.Close() })
		api, err := data.New(store, data.Options{})
		if err != nil {
			t.Fatal(err)
		}
		// Unique per run: the database is shared with other packages' tests
		suffix := fmt.Sprintf("%04d", time.Now().UnixNano()%10000)
		national := "207946" + suffix
		uk, err := api.Trunks().Create(ctx, &trunks.CreateTrunkRequest{Name: "uk", InboundUri: "uk-" + suffix + ".ladder.example"})
		if err != nil {
			t.Fatal(err)
		}
		us, err := api.Trunks().Create(ctx, &trunks.CreateTrunkRequest{Name: "us", InboundUri: "us-" + suffix + ".ladder.example"})
		if err != nil {
			t.Fatal(err)
		}
		number, err := api.Numbers().Create(ctx, &numbers.CreateNumberRequest{
			Name: "n", TelUrl: "tel:+44" + national, City: "London", Country: "United Kingdom", CountryIsoCode: "gb",
			TrunkRef: uk.GetRef(), Aliases: []string{"sales"}, AorLink: "sip:sales@sip.local",
		})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_, _ = api.Numbers().Delete(ctx, &numbers.DeleteNumberRequest{Ref: number.GetRef()})
			_, _ = api.Trunks().Delete(ctx, &trunks.DeleteTrunkRequest{Ref: uk.GetRef()})
			_, _ = api.Trunks().Delete(ctx, &trunks.DeleteTrunkRequest{Ref: us.GetRef()})
		})
		expectLadder(t, serverNumbers{api.Numbers()}, uk.GetRef(), us.GetRef(), national, number.GetRef())
	})
}
