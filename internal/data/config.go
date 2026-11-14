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
	"log/slog"

	"github.com/fonoster/routr/internal/common/cloak"
	"github.com/fonoster/routr/internal/common/config"
)

// The backends spec.data.backend names, as config spells them.
const (
	BackendFiles    = config.BackendFiles
	BackendPostgres = config.BackendPostgres
)

// OpenStore opens the backend spec.data names (config.LoadData for a
// standalone Data API, config.LoadRoutr for RoutrOne). The caller closes
// it. An error names the key of spec.data it comes from. It logs to
// slog.Default(); a process with its own logger uses OpenStoreWithLogger.
func OpenStore(ctx context.Context, spec config.DataSpec) (Store, error) {
	return OpenStoreWithLogger(ctx, spec, slog.Default())
}

// OpenStoreWithLogger is OpenStore logging to log. On the postgres backend
// with no spec.data.encryptionKey it refuses a database that holds cloaked
// passwords (see refuseCloakedPasswords) and warns about the plain text.
func OpenStoreWithLogger(ctx context.Context, spec config.DataSpec, log *slog.Logger) (Store, error) {
	switch spec.Backend {
	case BackendFiles:
		store, err := NewFilesWithOptions(spec.Path, FilesOptions{AllowNonE164Numbers: !spec.EnforcesE164Numbers()})
		if err != nil {
			return nil, fmt.Errorf("spec.data.path: %w", err)
		}
		return store, nil
	case BackendPostgres:
		var cipher Cipher = Identity{}
		if spec.EncryptionKey != "" {
			c, err := cloak.New(spec.EncryptionKey)
			if err != nil {
				return nil, fmt.Errorf("spec.data.encryptionKey: %w", err)
			}
			cipher = c
		}
		store, err := OpenPostgres(ctx, spec.URL, PostgresOptions{Cipher: cipher, Logger: log})
		if err != nil {
			return nil, fmt.Errorf("spec.data.url: %w", err)
		}
		if pg, ok := store.(*postgresStore); ok && spec.EncryptionKey == "" {
			if err := pg.refuseCloakedPasswords(ctx); err != nil {
				_ = store.Close()
				return nil, err
			}
		}
		return store, nil
	}
	return nil, fmt.Errorf("spec.data.backend: unknown backend %q", spec.Backend)
}
