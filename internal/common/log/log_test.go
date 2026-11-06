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

package log

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"
)

func TestLevelOf(t *testing.T) {
	cases := map[string]slog.Level{
		"debug": slog.LevelDebug, "DEBUG": slog.LevelDebug, "verbose": slog.LevelDebug, "silly": slog.LevelDebug, "trace": slog.LevelDebug,
		"info": slog.LevelInfo, "": slog.LevelInfo, "loud": slog.LevelInfo,
		"warn": slog.LevelWarn, "warning": slog.LevelWarn,
		"error": slog.LevelError,
	}
	for level, want := range cases {
		if got := LevelOf(level); got != want {
			t.Errorf("LevelOf(%q) = %v, want %v", level, got, want)
		}
	}
}

func TestNewFiltersBelowTheLevel(t *testing.T) {
	ctx := context.Background()
	if l := New("warn"); l.Enabled(ctx, slog.LevelInfo) || !l.Enabled(ctx, slog.LevelWarn) {
		t.Error("warn keeps warn and error only")
	}
	if l := New("debug"); !l.Enabled(ctx, slog.LevelDebug) {
		t.Error("debug keeps everything")
	}

	var out bytes.Buffer
	l := NewWriter(&out, "info")
	l.Debug("hidden")
	l.Info("shown", "key", "value")
	if strings.Contains(out.String(), "hidden") || !strings.Contains(out.String(), "msg=shown key=value") {
		t.Errorf("text lines at the level: %q", out.String())
	}
}
