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

package one

import (
	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/service"
)

// guardOf is how the named service's listener is protected. Nothing in process
// goes through it: RoutrOne's components call each other directly.
func guardOf(cfg *config.Routr, name, addr string) service.Guard {
	g := service.Guard{Name: name, BindAddr: addr}
	switch name {
	case "location":
		g.Section, g.Auth, g.Exposes = "spec.location", cfg.Spec.Location.ServerAuth, service.ExposesLocation
	case "data":
		g.Section, g.Auth, g.Exposes, g.Required = "spec.data", cfg.Spec.Data.ServerAuth, service.ExposesData, true
	case "connect":
		g.Section, g.Auth, g.Exposes = "spec.connect", cfg.Spec.Connect.ServerAuth, service.ExposesProcessor
	case "dispatcher":
		g.Section, g.Auth, g.Exposes = "spec.dispatcher", cfg.Spec.Dispatcher.ServerAuth, service.ExposesProcessor
	case "requester":
		g.Section, g.Auth, g.Exposes, g.Required = "spec.requester", cfg.Spec.Requester.ServerAuth, service.ExposesRequester, true
	}
	return g
}
