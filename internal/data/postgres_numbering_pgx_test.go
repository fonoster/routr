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
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// testNumbering runs the Routr 3 numbering rules through the Data API on the
// real schema: Number aliases (unique per Trunk, never NULL, kept, replaced,
// cleared and carried on a Trunk move), the Trunk number formats with their
// prefixes checked on the Trunk as stored, FindBy trunkRef with the aliases,
// and the telUrl and countryIsoCode checks.
func testNumbering(t *testing.T, ctx context.Context, store Store, pool *pgxpool.Pool, fx fixtures) {
	api, err := New(store, Options{})
	if err != nil {
		t.Fatal(err)
	}
	nums, trks := api.Numbers(), api.Trunks()
	var numberRefs, trunkRefs []string
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		w := store.(Writer)
		for _, ref := range numberRefs {
			_ = w.Delete(ctx, KindNumber, ref)
		}
		for _, ref := range trunkRefs {
			_ = w.Delete(ctx, KindTrunk, ref)
		}
	})
	digits := strings.TrimPrefix(fx.telURL, "tel:+1")
	tel := func(n int) string { return fmt.Sprintf("tel:+3%s%d", digits, n) }
	newTrunk := func(req *trunks.CreateTrunkRequest) *trunks.Trunk {
		t.Helper()
		trunk, err := trks.Create(ctx, req)
		if err != nil {
			t.Fatalf("create Trunk %s: %v", req.GetName(), err)
		}
		trunkRefs = append(trunkRefs, trunk.GetRef())
		return trunk
	}
	numberReq := func(n int, trunkRef string, aliases ...string) *numbers.CreateNumberRequest {
		return &numbers.CreateNumberRequest{
			Name: fmt.Sprintf("N%d", n), TelUrl: tel(n), City: "London", Country: "United Kingdom", CountryIsoCode: "gb",
			TrunkRef: trunkRef, Aliases: aliases,
		}
	}
	newNumber := func(req *numbers.CreateNumberRequest) *numbers.Number {
		t.Helper()
		number, err := nums.Create(ctx, req)
		if err != nil {
			t.Fatalf("create Number %s: %v", req.GetName(), err)
		}
		numberRefs = append(numberRefs, number.GetRef())
		return number
	}
	wantInvalid := func(what string, err error, message string) {
		t.Helper()
		if status.Code(err) != codes.InvalidArgument || status.Convert(err).Message() != message {
			t.Errorf("%s: got %v, want INVALID_ARGUMENT %q", what, err, message)
		}
	}

	a := newTrunk(&trunks.CreateTrunkRequest{
		Name: "A", InboundUri: fx.ref("num-a.acme.com"),
		CalledNumberFormat: trunks.NumberFormat_NATIONAL, CalledNumberPrefix: "9",
		CallerNumberFormat: trunks.NumberFormat_INTERNATIONAL,
	})
	b := newTrunk(&trunks.CreateTrunkRequest{Name: "B", InboundUri: fx.ref("num-b.acme.com")})
	if a.GetCalledNumberFormat() != trunks.NumberFormat_NATIONAL || a.GetCalledNumberPrefix() != "9" || a.GetCallerNumberFormat() != trunks.NumberFormat_INTERNATIONAL || a.GetCallerNumberPrefix() != "" {
		t.Errorf("Trunk A formats = %v", a)
	}
	if b.GetCalledNumberFormat() != trunks.NumberFormat_UNSPECIFIED || b.GetCalledNumberPrefix() != "" {
		t.Errorf("Trunk B formats = %v", b)
	}

	// AC10: the formats on the Trunk as it would be stored
	_, err = trks.Update(ctx, &trunks.UpdateTrunkRequest{Ref: a.GetRef(), CalledNumberFormat: trunks.NumberFormat_UNSPECIFIED.Enum()})
	wantInvalid("reset a format with its prefix stored", err, "calledNumberPrefix needs calledNumberFormat e164-without-plus, national or international")
	_, err = trks.Update(ctx, &trunks.UpdateTrunkRequest{Ref: b.GetRef(), CallerNumberPrefix: ptr("9")})
	wantInvalid("a prefix on a Trunk with no format", err, "callerNumberPrefix needs callerNumberFormat e164-without-plus, national or international")
	_, err = trks.Update(ctx, &trunks.UpdateTrunkRequest{Ref: a.GetRef(), CalledNumberFormat: trunks.NumberFormat_E164.Enum()})
	wantInvalid("e164 with a prefix stored", err, "calledNumberPrefix needs calledNumberFormat e164-without-plus, national or international")
	_, err = trks.Update(ctx, &trunks.UpdateTrunkRequest{Ref: a.GetRef(), CalledNumberPrefix: ptr("9a")})
	wantInvalid("a bad prefix", err, "calledNumberPrefix may contain only digits, * and # (up to 20)")
	updated, err := trks.Update(ctx, &trunks.UpdateTrunkRequest{Ref: a.GetRef(), CallerNumberPrefix: ptr("*#1")})
	if err != nil || updated.GetCallerNumberPrefix() != "*#1" || updated.GetCalledNumberPrefix() != "9" {
		t.Errorf("a prefix for the stored format: %v, %v", updated, err)
	}
	updated, err = trks.Update(ctx, &trunks.UpdateTrunkRequest{Ref: a.GetRef(), CalledNumberFormat: trunks.NumberFormat_UNSPECIFIED.Enum(), CalledNumberPrefix: ptr("")})
	if err != nil || updated.GetCalledNumberFormat() != trunks.NumberFormat_UNSPECIFIED || updated.GetCalledNumberPrefix() != "" {
		t.Errorf("reset the format and clear the prefix together: %v, %v", updated, err)
	}
	updated, err = trks.Update(ctx, &trunks.UpdateTrunkRequest{Ref: a.GetRef(), CalledNumberFormat: trunks.NumberFormat_E164_WITHOUT_PLUS.Enum(), CalledNumberPrefix: ptr("9")})
	if err != nil || updated.GetCalledNumberFormat() != trunks.NumberFormat_E164_WITHOUT_PLUS || updated.GetCalledNumberPrefix() != "9" {
		t.Errorf("set a format and its prefix: %v, %v", updated, err)
	}
	updated, err = trks.Update(ctx, &trunks.UpdateTrunkRequest{Ref: a.GetRef(), Name: ptr("A2")})
	if err != nil || updated.GetCalledNumberFormat() != trunks.NumberFormat_E164_WITHOUT_PLUS || updated.GetCallerNumberFormat() != trunks.NumberFormat_INTERNATIONAL {
		t.Errorf("an update without formats keeps them: %v, %v", updated, err)
	}

	// AC6, AC9: aliases unique per Trunk; none is an empty array
	n1 := newNumber(numberReq(1, a.GetRef(), "sales", "01234"))
	if strings.Join(n1.GetAliases(), ",") != "sales,01234" {
		t.Errorf("Number aliases = %v", n1.GetAliases())
	}
	_, err = nums.Create(ctx, numberReq(2, a.GetRef(), "other", "sales"))
	wantInvalid("an alias another Number of the Trunk has", err, fmt.Sprintf("alias \"sales\" is already used by Number %s on this Trunk", n1.GetRef()))
	n3 := newNumber(numberReq(3, b.GetRef(), "sales"))
	n4 := newNumber(numberReq(4, ""))
	var isNull bool
	if err := pool.QueryRow(ctx, `SELECT aliases IS NULL FROM "numbers" WHERE ref = $1`, n4.GetRef()).Scan(&isNull); err != nil || isNull {
		t.Errorf("a Number without aliases is stored with '{}': null=%v, %v", isNull, err)
	}
	if len(n4.GetAliases()) != 0 {
		t.Errorf("Number without aliases = %v", n4.GetAliases())
	}

	// AC7: kept, replaced, cleared
	kept, err := nums.Update(ctx, &numbers.UpdateNumberRequest{Ref: n1.GetRef(), Name: ptr("N1b")})
	if err != nil || strings.Join(kept.GetAliases(), ",") != "sales,01234" {
		t.Errorf("an update with neither aliases nor clear_aliases keeps them: %v, %v", kept.GetAliases(), err)
	}
	replaced, err := nums.Update(ctx, &numbers.UpdateNumberRequest{Ref: n1.GetRef(), Aliases: []string{"x1"}})
	if err != nil || strings.Join(replaced.GetAliases(), ",") != "x1" {
		t.Errorf("aliases replace the stored ones: %v, %v", replaced.GetAliases(), err)
	}
	cleared, err := nums.Update(ctx, &numbers.UpdateNumberRequest{Ref: n1.GetRef(), Aliases: []string{"y"}, ClearAliases: true})
	if err != nil || len(cleared.GetAliases()) != 0 {
		t.Errorf("clear_aliases empties the list: %v, %v", cleared.GetAliases(), err)
	}
	_, err = nums.Update(ctx, &numbers.UpdateNumberRequest{Ref: n4.GetRef(), Aliases: []string{"bad alias"}})
	wantInvalid("an invalid alias on update", err, "alias \"bad alias\" is invalid: use 1 to 60 letters, digits or + * . _ -")

	// AC8: a Number moving to a Trunk brings its aliases along
	n5 := newNumber(numberReq(5, a.GetRef(), "sales"))
	_, err = nums.Update(ctx, &numbers.UpdateNumberRequest{Ref: n3.GetRef(), TrunkRef: ptr(a.GetRef())})
	wantInvalid("a move onto a Trunk where the alias is taken", err, fmt.Sprintf("alias \"sales\" is already used by Number %s on this Trunk", n5.GetRef()))
	moved, err := nums.Update(ctx, &numbers.UpdateNumberRequest{Ref: n4.GetRef(), TrunkRef: ptr(a.GetRef())})
	if err != nil || moved.GetTrunk().GetRef() != a.GetRef() {
		t.Errorf("a move without aliases: %v, %v", moved, err)
	}
	_, err = nums.Update(ctx, &numbers.UpdateNumberRequest{Ref: n5.GetRef(), Aliases: []string{"sales", "x9"}})
	if err != nil {
		t.Errorf("a Number keeps its own alias on update: %v", err)
	}

	// FindBy trunkRef answers the Trunk's Numbers with their aliases
	found, err := nums.FindBy(ctx, &numbers.FindByRequest{FieldName: "trunkRef", FieldValue: a.GetRef()})
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, n := range found.GetItems() {
		got[n.GetRef()] = strings.Join(n.GetAliases(), ",")
	}
	if len(got) != 3 || got[n5.GetRef()] != "sales,x9" || got[n1.GetRef()] != "" || got[n4.GetRef()] != "" {
		t.Errorf("FindBy trunkRef = %v", got)
	}

	// AC1, AC2, AC12 against the database
	bad := numberReq(6, "")
	bad.TelUrl = "tel:02079460018"
	_, err = nums.Create(ctx, bad)
	wantInvalid("a national telUrl", err, `telUrl "tel:02079460018" is not E.164: use tel:+ followed by 2 to 15 digits, the first not 0; or set spec.data.enforceE164Numbers: false`)
	lenient, err := New(store, Options{AllowNonE164Numbers: true})
	if err != nil {
		t.Fatal(err)
	}
	bad.TelUrl = "tel:0" + digits
	n6, err := lenient.Numbers().Create(ctx, bad)
	if err != nil {
		t.Errorf("enforceE164Numbers false creates a national telUrl: %v", err)
	} else {
		numberRefs = append(numberRefs, n6.GetRef())
	}
	unknown := numberReq(7, "")
	unknown.CountryIsoCode = "XX"
	_, err = nums.Create(ctx, unknown)
	wantInvalid("an unknown country", err, `countryIsoCode "XX" is not a country with a numbering plan`)
}
