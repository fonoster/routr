//go:build !unix

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

package edgeport

import "errors"

// getsockoptRcvbuf has no portable reader of SO_RCVBUF off unix; the buffer
// is still set, only the granted size goes unlogged.
func getsockoptRcvbuf(uintptr) (int, error) {
	return 0, errors.ErrUnsupported
}
