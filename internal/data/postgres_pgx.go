//go:build pgx

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

// This file is the real database: pgx v5 over a connection pool. It builds
// with -tags pgx once github.com/jackc/pgx/v5 is in go.mod; until then the
// stub in postgres_nopgx.go takes its place and the backend is tested
// against a fake Querier.

package data

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxQuerier adapts a pgxpool.Pool to Querier.
type PgxQuerier struct {
	Pool *pgxpool.Pool
}

// Query runs the query on the pool.
func (q PgxQuerier) Query(ctx context.Context, sql string, args ...any) (Rows, error) {
	rows, err := q.Pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// OpenPostgres connects to the database the URL names, checks it answers,
// and returns the postgres Store over it.
func OpenPostgres(ctx context.Context, url string, cipher Cipher) (Store, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres: %w", err)
	}
	return NewPostgres(PgxQuerier{Pool: pool}, PostgresOptions{Cipher: cipher, Close: pool.Close})
}
