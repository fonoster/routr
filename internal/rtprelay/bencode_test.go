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

package rtprelay

import (
	"reflect"
	"strings"
	"testing"
)

func TestEncodesSortedDictionariesAndSkipsNil(t *testing.T) {
	got, err := appendBencode(nil, map[string]any{
		"z":     "last",
		"a":     []string{"x", "yy"},
		"n":     7,
		"gone":  nil,
		"empty": "",
	})
	if err != nil {
		t.Fatal(err)
	}
	if want := "d1:al1:x2:yye5:empty0:1:ni7e1:z4:laste"; string(got) != want {
		t.Errorf("got %s, want %s", got, want)
	}
}

func TestEncodingCountsBytes(t *testing.T) {
	got, err := appendBencode(nil, "ñ")
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "2:ñ" {
		t.Errorf("got %s", got)
	}
}

func TestEncodeRejectsWhatItCannotRepresent(t *testing.T) {
	if _, err := appendBencode(nil, map[string]any{"flag": true}); err == nil || !strings.Contains(err.Error(), "flag") {
		t.Errorf("err = %v", err)
	}
}

func TestDecodesNestedValues(t *testing.T) {
	got, err := decodeBencode([]byte("d6:result2:ok7:createdi1730000000e7:streamsld4:porti10000eeee"))
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"result":  "ok",
		"created": int64(1730000000),
		"streams": []any{map[string]any{"port": int64(10000)}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v", got)
	}
}

func TestDecodeRejectsMalformedData(t *testing.T) {
	for name, data := range map[string]string{
		"empty":          "",
		"garbage":        "x",
		"open int":       "i12",
		"bad int":        "ixe",
		"long string":    "9:abc",
		"no colon":       "12",
		"huge length":    "99999999999999999999:a",
		"open list":      "l1:a",
		"open dict":      "d1:a",
		"key not string": "di1e1:ae",
		"dict no value":  "d1:ae",
		"too deep":       strings.Repeat("l", maxBencodeDepth+2),
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := decodeBencode([]byte(data)); err == nil {
				t.Error("must fail")
			}
		})
	}
}
