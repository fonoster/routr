//go:build !goja

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

package dispatcher

import "fmt"

// Without the JavaScript matcher (github.com/dop251/goja is not yet pinned in
// go.mod; see matchfunc_goja.go) only `req => true`, the matchFunc of every
// shipped config, loads. Any other function is a load-time error rather
// than a silent mismatch. Delete this file once goja is pinned and the build
// tag on matchfunc_goja.go is dropped.

func compileMatchFunc(src string) (matchFunc, error) {
	if isConstantTrue(src) {
		return alwaysMatch, nil
	}
	return nil, fmt.Errorf("matchFunc %q needs the JavaScript matcher, which this build lacks (build with -tags goja)", src)
}
