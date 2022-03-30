const opentelemetry = require('@opentelemetry/api');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
const { GrpcInstrumentation } = require('@opentelemetry/instrumentation-grpc');

const EXPORTER = process.env.EXPORTER || '';

export const init = (serviceName: string) => {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
  });

  let exporter;
  if (EXPORTER.toLowerCase().startsWith('z')) {
    exporter = new ZipkinExporter();
  } else {
    exporter = new JaegerExporter({
      endpoint: "http://jaeger:14268/api/traces",
    });
  }

  console.log("XXXXXXXXX STARTING PROVIDER")
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
  provider.register();

  registerInstrumentations({
    instrumentations: [
      new GrpcInstrumentation(),
    ],
  });

  console.log("XXXXXXXXX COMPLETE PROVIDER")

  return opentelemetry.trace.getTracer('grpc-js-example');
};
