//go:build !pgx

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
	"errors"
)

// ErrNoPgx is OpenPostgres's answer in a build without the pgx driver.
var ErrNoPgx = errors.New("postgres: this build has no database driver; " +
	"add github.com/jackc/pgx/v5 to go.mod and build with -tags pgx")

// OpenPostgres cannot connect in this build: go.mod has no pgx yet. The
// backend itself (NewPostgres over any Querier) is here and tested.
func OpenPostgres(_ context.Context, _ string, _ Cipher) (Store, error) {
	return nil, ErrNoPgx
}
