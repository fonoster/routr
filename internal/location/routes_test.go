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

package location

import (
	"time"

	"github.com/fonoster/routr/internal/common/pb/common"
	locationpb "github.com/fonoster/routr/internal/common/pb/location"
	"github.com/fonoster/routr/internal/common/pb/processor"
)

// The routes of mods/location/test/route_examples.ts, registered at the
// given instant.

func listeningPoint(transport common.Transport) []*processor.NetInterface {
	return []*processor.NetInterface{{Host: "proxy", Port: 5060, Transport: transport}}
}

func exampleRoute(user, host, port string, transport common.Transport, sessions int32, now time.Time) *locationpb.Route {
	return &locationpb.Route{
		User:            user,
		Host:            host,
		Port:            port,
		AdvertisedHost:  host,
		AdvertisedPort:  port,
		Transport:       transport,
		RegisteredOn:    now.UnixMilli(),
		SessionCount:    sessions,
		Expires:         600,
		EdgePortRef:     "edgeport-01",
		ListeningPoints: listeningPoint(transport),
	}
}

func simpleRoute01(now time.Time) *locationpb.Route {
	r := exampleRoute("1001", "127.0.0.1", "6060", common.Transport_TCP, -1, now)
	r.Labels = map[string]string{"priority": "1"}
	return r
}

func simpleRoute02(now time.Time) *locationpb.Route {
	r := exampleRoute("1001", "127.0.0.1", "6061", common.Transport_UDP, -1, now)
	r.EdgePortRef = "edgeport-02"
	r.Labels = map[string]string{"priority": "2"}
	return r
}

func voiceBackendRoute01(now time.Time) *locationpb.Route {
	r := exampleRoute("voice01", "192.168.1.2", "5060", common.Transport_TCP, 50, now)
	r.Labels = map[string]string{"region": "us-east01"}
	return r
}

func voiceBackendRoute02(now time.Time) *locationpb.Route {
	return exampleRoute("voice02", "192.168.1.3", "5060", common.Transport_UDP, 200, now)
}

func voiceBackendRoute03(now time.Time) *locationpb.Route {
	return exampleRoute("voice03", "192.168.1.4", "5060", common.Transport_UDP, 150, now)
}

func voiceBackendRoute04(now time.Time) *locationpb.Route {
	return exampleRoute("voice04", "192.168.1.5", "5060", common.Transport_UDP, 201, now)
}

func voiceBackendRoute05(now time.Time) *locationpb.Route {
	return exampleRoute("voice05", "192.168.1.6", "5060", common.Transport_UDP, 3, now)
}

func conferenceBackendRoute01(now time.Time) *locationpb.Route {
	return exampleRoute("conference01", "conference.local", "5060", common.Transport_TCP, 20, now)
}

func conferenceBackendRoute02(now time.Time) *locationpb.Route {
	return exampleRoute("conference02", "conference.local", "5061", common.Transport_TCP, 50, now)
}

// conferenceWithExpiredRoute was registered on 2022-03-12 for ten seconds.
func conferenceWithExpiredRoute() *locationpb.Route {
	r := exampleRoute("conference03", "conference.remote", "5060", common.Transport_TCP, 10, time.UnixMilli(1647054012869))
	r.Expires = 10
	return r
}
