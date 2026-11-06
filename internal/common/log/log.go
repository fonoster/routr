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

// Package log builds the one logger a Routr process writes with, from the
// logLevel key of its configuration file.
package log

import (
	"io"
	"log/slog"
	"os"
	"strings"
)

// LevelOf maps a level name to a slog level: the logLevel values of a
// configuration file (debug, info, warn, error) and, for the standalone
// EdgePort's LOGS_LEVEL, the Node services' names (verbose, silly, warning,
// trace). Unknown or empty is info.
func LevelOf(level string) slog.Level {
	switch strings.ToLower(level) {
	case "error":
		return slog.LevelError
	case "warn", "warning":
		return slog.LevelWarn
	case "verbose", "debug", "silly", "trace":
		return slog.LevelDebug
	default:
		return slog.LevelInfo
	}
}

// New returns a logger that writes text lines to stdout at the level.
func New(level string) *slog.Logger {
	return NewWriter(os.Stdout, level)
}

// NewWriter is New writing to w.
func NewWriter(w io.Writer, level string) *slog.Logger {
	return slog.New(slog.NewTextHandler(w, &slog.HandlerOptions{Level: LevelOf(level)}))
}
