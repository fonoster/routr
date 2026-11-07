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
	"net/url"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// defaultPostgresSchema is the schema Prisma uses when a URL names none, the
// one Routr 2's migrations create the tables in.
const defaultPostgresSchema = "public"

// searchPathParam is the Postgres setting the schema becomes.
const searchPathParam = "search_path"

// parsePostgresURL reads a DATABASE_URL as Routr 2 wrote it. Prisma's schema
// parameter means nothing to Postgres, and pgx would send it as a setting the
// server refuses at connect, so it comes out of the URL and goes back in as
// search_path. With no schema the search_path is public, what Prisma's queries
// named, whatever the role's own default is, unless the URL sets search_path
// itself. Any other parameter is pgx's to read. A URL that doesn't parse is
// left for pgx to report, whose errors don't carry the password.
func parsePostgresURL(raw string) (*pgxpool.Config, error) {
	dsn, schema := splitPrismaSchema(raw)
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	// Prisma's default needs no startup parameter, and a pgbouncer without
	// ignore_startup_parameters refuses one, so only another schema sends it.
	if schema != "" && schema != defaultPostgresSchema {
		cfg.ConnConfig.RuntimeParams[searchPathParam] = pgx.Identifier{schema}.Sanitize()
	}
	return cfg, nil
}

// splitPrismaSchema returns the URL without its schema parameter, and that
// parameter's value. Anything that isn't a URL with a query comes back as it is:
// pgx also takes keyword/value strings, which never carried Prisma's parameter.
func splitPrismaSchema(raw string) (string, string) {
	u, err := url.Parse(raw)
	if err != nil || u.RawQuery == "" {
		return raw, ""
	}
	query := u.Query()
	if !query.Has("schema") {
		return raw, ""
	}
	schema := query.Get("schema")
	query.Del("schema")
	u.RawQuery = query.Encode()
	return u.String(), schema
}
