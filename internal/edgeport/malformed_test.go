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
	"context"
	"testing"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// TestMalformedCounter sets the global providers, so it doesn't run in
// parallel.
func TestMalformedCounter(t *testing.T) {
	tracerBefore, meterBefore := otel.GetTracerProvider(), otel.GetMeterProvider()
	t.Cleanup(func() {
		otel.SetTracerProvider(tracerBefore)
		otel.SetMeterProvider(meterBefore)
	})
	reader := sdkmetric.NewManualReader()
	otel.SetTracerProvider(sdktrace.NewTracerProvider())
	otel.SetMeterProvider(sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader)))

	e := &EdgePort{tel: newSIPTelemetry(discardLog())}
	if e.tel == nil {
		t.Fatal("telemetry is off")
	}
	for want := int64(1); want <= 2; want++ {
		e.malformed()
		var rm metricdata.ResourceMetrics
		if err := reader.Collect(context.Background(), &rm); err != nil {
			t.Fatal(err)
		}
		got, found := int64(0), false
		for _, scope := range rm.ScopeMetrics {
			for _, m := range scope.Metrics {
				if m.Name != "routr.sip.malformed" {
					continue
				}
				sum, ok := m.Data.(metricdata.Sum[int64])
				if !ok {
					t.Fatalf("routr.sip.malformed is %T", m.Data)
				}
				for _, dp := range sum.DataPoints {
					if v, _ := dp.Attributes.Value(attribute.Key("network.transport")); v.AsString() == "udp" {
						got, found = dp.Value, true
					}
				}
			}
		}
		if !found || got != want {
			t.Fatalf("after %d calls routr.sip.malformed{network.transport=udp} = %d (found %v)", want, got, found)
		}
	}
}
