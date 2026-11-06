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

import (
	"strconv"
	"strings"
	"testing"
)

func TestCompileMatchFuncWithoutGojaRejectsEverythingElse(t *testing.T) {
	for _, src := range []string{"req => false", `req => req.method === "INVITE"`, "req => req.method ==="} {
		_, err := compileMatchFunc(src)
		if err == nil || !strings.Contains(err.Error(), "-tags goja") || !strings.Contains(err.Error(), strconv.Quote(src)) {
			t.Fatalf("compileMatchFunc(%q) = %v, want an error naming the function and the build", src, err)
		}
	}
}
