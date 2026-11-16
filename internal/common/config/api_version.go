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
package config

import "errors"

// errAPIVersion is the one message every standalone loader gives for an
// apiVersion it doesn't take, or for none.
var errAPIVersion = errors.New(".apiVersion should be equal to one of the allowed values (v2beta1, v2, v3)")

// ValidateAPIVersion checks the apiVersion of a standalone component file:
// v2beta1, v2 or v3, required. routr.yaml has its own rule (v3 only).
func ValidateAPIVersion(raw map[string]any) error {
	switch v, _ := raw["apiVersion"].(string); v {
	case "v2beta1", "v2", "v3":
		return nil
	}
	return errAPIVersion
}
