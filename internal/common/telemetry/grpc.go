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
package telemetry

import (
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc/filters"
	metricnoop "go.opentelemetry.io/otel/metric/noop"
	"google.golang.org/grpc"
)

// handlerOptions are what the gRPC stats handlers share: spans and the W3C trace
// context as Routr 2's GrpcInstrumentation had them, and no RPC metrics, which
// Routr 2 did not export either. The chart's probes every few seconds are not
// traces.
func handlerOptions() []otelgrpc.Option {
	return []otelgrpc.Option{
		otelgrpc.WithMeterProvider(metricnoop.NewMeterProvider()),
		otelgrpc.WithFilter(filters.Not(filters.ServiceName("grpc.health.v1.Health"))),
	}
}

// ServerOptions are the options that make a gRPC server continue the trace of
// the calls it gets; none with telemetry off.
func ServerOptions() []grpc.ServerOption {
	if !Enabled() {
		return nil
	}
	return []grpc.ServerOption{grpc.StatsHandler(otelgrpc.NewServerHandler(handlerOptions()...))}
}

// DialOptions is opts plus what makes a connection carry the trace context of
// its calls; opts alone with telemetry off.
func DialOptions(opts ...grpc.DialOption) []grpc.DialOption {
	if !Enabled() {
		return opts
	}
	return append(opts, grpc.WithStatsHandler(otelgrpc.NewClientHandler(handlerOptions()...)))
}
