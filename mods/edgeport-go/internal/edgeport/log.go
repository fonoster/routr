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

import (
	"log/slog"
	"os"
	"strings"
	"sync/atomic"
)

var log atomic.Pointer[slog.Logger]

func logger() *slog.Logger {
	if l := log.Load(); l != nil {
		return l
	}
	return slog.Default()
}

// LevelOf maps LOGS_LEVEL (the Node services' levels: error, warn, info,
// verbose, debug, silly) to a slog level. Unset is info.
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

// SetupLogging sends the EdgePort's logs to stdout at the given level.
func SetupLogging(level string) *slog.Logger {
	l := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: LevelOf(level)}))
	log.Store(l)
	return l
}
