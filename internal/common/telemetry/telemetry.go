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
// Package telemetry exports a process's traces, metrics and logs over
// OTLP/HTTP, what Routr 2's mods/common/src/tracer.ts and the Java EdgePort's
// Telemetry did, from the telemetry key of its configuration file. With no
// endpoint nothing is built: Enabled is false, a server or a connection gets
// no stats handler, and the message path pays nothing.
//
// The TracerProvider, MeterProvider and propagator go in OpenTelemetry's own
// globals, the place the SDK and otelgrpc read them from. A main sets them once
// through Start and clears them through Shutdown; nothing else writes them.
package telemetry

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	metricnoop "go.opentelemetry.io/otel/metric/noop"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	tracenoop "go.opentelemetry.io/otel/trace/noop"

	"github.com/fonoster/routr/internal/common/config"
)

const (
	// shutdownTimeout bounds the flush at the end of a process: a collector
	// that is down never holds up a rollout.
	shutdownTimeout = 5 * time.Second
	// metricInterval is Routr 2's export interval.
	metricInterval = 15 * time.Second
)

// Telemetry is a process's running exporters; the zero value is telemetry off.
type Telemetry struct {
	name    string
	loggers *sdklog.LoggerProvider
	stops   []func(context.Context) error
	log     *slog.Logger
	once    sync.Once
}

// Open reads the telemetry key of the file at path and starts it. Only a bad
// key is an error, reported like any other of the file's.
func Open(path string, opts config.ResolveOptions, name, version string, log *slog.Logger) (*Telemetry, error) {
	cfg, err := config.LoadTelemetry(path, opts)
	if err != nil {
		return nil, err
	}
	return Start(context.Background(), cfg, name, version, log), nil
}

// Start starts telemetry for the service called name. It runs before anything
// listens or dials, since Enabled is read then. An exporter that can't be built
// leaves telemetry off with a warning: it never stops a service. The log is the
// console logger, not Logger's: what fails an export must not be exported.
func Start(ctx context.Context, cfg config.Telemetry, name, version string, log *slog.Logger) *Telemetry {
	if cfg.OTLPEndpoint == "" {
		return &Telemetry{}
	}
	if log == nil {
		log = slog.Default()
	}
	t, err := start(ctx, cfg, name, version, log)
	if err != nil {
		log.Warn("telemetry off: " + err.Error())
		return &Telemetry{}
	}
	log.Info("telemetry on: traces, metrics and logs go over OTLP", "endpoint", cfg.OTLPEndpoint)
	return t
}

// The export settings, written out: the OpenTelemetry SDK reads them from
// OTEL_EXPORTER_OTLP_*, OTEL_BSP_*, OTEL_BLRP_* and OTEL_METRIC_* when an
// option doesn't name them, and no environment variable may change how
// telemetry exports, headers above all (ROUTR3.md § 7). These are the SDK's
// own defaults.
const (
	exportTimeout   = 10 * time.Second
	batchTimeout    = 5 * time.Second
	logBatchTimeout = time.Second
	maxQueueSize    = 2048
	maxBatchSize    = 512
)

func start(ctx context.Context, cfg config.Telemetry, name, version string, log *slog.Logger) (*Telemetry, error) {
	base := strings.TrimRight(cfg.OTLPEndpoint, "/")
	traces, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpointURL(base+"/v1/traces"),
		otlptracehttp.WithHeaders(nil),
		otlptracehttp.WithCompression(otlptracehttp.NoCompression),
		otlptracehttp.WithTimeout(exportTimeout),
		otlptracehttp.WithTLSClientConfig(nil))
	if err != nil {
		return nil, fmt.Errorf("the trace exporter: %w", err)
	}
	metrics, err := otlpmetrichttp.New(ctx,
		otlpmetrichttp.WithEndpointURL(base+"/v1/metrics"),
		otlpmetrichttp.WithHeaders(nil),
		otlpmetrichttp.WithCompression(otlpmetrichttp.NoCompression),
		otlpmetrichttp.WithTimeout(exportTimeout),
		otlpmetrichttp.WithTLSClientConfig(nil))
	if err != nil {
		return nil, fmt.Errorf("the metric exporter: %w", err)
	}
	logs, err := otlploghttp.New(ctx,
		otlploghttp.WithEndpointURL(base+"/v1/logs"),
		otlploghttp.WithHeaders(nil),
		otlploghttp.WithCompression(otlploghttp.NoCompression),
		otlploghttp.WithTimeout(exportTimeout),
		otlploghttp.WithTLSClientConfig(nil))
	if err != nil {
		return nil, fmt.Errorf("the log exporter: %w", err)
	}

	// NewSchemaless and not resource.Default: OTEL_RESOURCE_ATTRIBUTES and
	// OTEL_SERVICE_NAME aren't settings of Routr's (ROUTR3.md § 7)
	res := resource.NewSchemaless(attribute.String("service.name", name), attribute.String("service.version", version))
	ratio := 1.0
	if cfg.SampleRatio != nil {
		ratio = *cfg.SampleRatio
	}
	tracers := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(ratio))),
		sdktrace.WithBatcher(traces,
			sdktrace.WithBatchTimeout(batchTimeout),
			sdktrace.WithExportTimeout(exportTimeout),
			sdktrace.WithMaxQueueSize(maxQueueSize),
			sdktrace.WithMaxExportBatchSize(maxBatchSize)),
	)
	meters := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metrics,
			sdkmetric.WithInterval(metricInterval),
			sdkmetric.WithTimeout(exportTimeout))),
	)
	loggers := sdklog.NewLoggerProvider(
		sdklog.WithResource(res),
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logs,
			sdklog.WithExportInterval(logBatchTimeout),
			sdklog.WithExportTimeout(exportTimeout),
			sdklog.WithMaxQueueSize(maxQueueSize),
			sdklog.WithExportMaxBatchSize(maxBatchSize))),
	)

	otel.SetErrorHandler(otel.ErrorHandlerFunc(func(err error) { log.Warn("telemetry: " + err.Error()) }))
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	otel.SetTracerProvider(tracers)
	otel.SetMeterProvider(meters)

	return &Telemetry{
		name:    name,
		loggers: loggers,
		stops:   []func(context.Context) error{tracers.Shutdown, meters.Shutdown, loggers.Shutdown},
		log:     log,
	}, nil
}

// Enabled tells whether Start turned telemetry on. A caller reads it once, when
// it builds a server, a connection or a component, never per message.
func Enabled() bool {
	_, on := otel.GetTracerProvider().(*sdktrace.TracerProvider)
	return on
}

// Logger is log, also sending its records to the OTLP logs endpoint at the same
// level, or log itself with telemetry off.
func (t *Telemetry) Logger(log *slog.Logger) *slog.Logger {
	if t.loggers == nil {
		return log
	}
	return slog.New(teeHandler{
		console: log.Handler(),
		otlp:    otelslog.NewHandler(t.name, otelslog.WithLoggerProvider(t.loggers)),
	})
}

// Shutdown flushes what is buffered and stops the exporters, all within
// shutdownTimeout. Only the first call does anything.
func (t *Telemetry) Shutdown() {
	t.once.Do(func() {
		if len(t.stops) == 0 {
			return
		}
		otel.SetTracerProvider(tracenoop.NewTracerProvider())
		otel.SetMeterProvider(metricnoop.NewMeterProvider())
		otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator())

		ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		// Side by side: one signal stuck on the deadline doesn't starve the others
		errs := make([]error, len(t.stops))
		var wg sync.WaitGroup
		for i, stop := range t.stops {
			wg.Go(func() { errs[i] = stop(ctx) })
		}
		wg.Wait()
		if err := errors.Join(errs...); err != nil {
			t.log.Warn("telemetry: unable to flush: " + err.Error())
		}
	})
}

// teeHandler writes a record to the console and to OTLP, at the console's level.
type teeHandler struct {
	console slog.Handler
	otlp    slog.Handler
}

func (h teeHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.console.Enabled(ctx, level)
}

func (h teeHandler) Handle(ctx context.Context, r slog.Record) error {
	return errors.Join(h.console.Handle(ctx, r), h.otlp.Handle(ctx, r.Clone()))
}

func (h teeHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return teeHandler{console: h.console.WithAttrs(attrs), otlp: h.otlp.WithAttrs(attrs)}
}

func (h teeHandler) WithGroup(name string) slog.Handler {
	return teeHandler{console: h.console.WithGroup(name), otlp: h.otlp.WithGroup(name)}
}
