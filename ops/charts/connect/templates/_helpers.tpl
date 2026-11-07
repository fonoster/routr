{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define ".helm.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define ".helm.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define ".helm.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define ".helm.labels" -}}
helm.sh/chart: {{ include ".helm.chart" . }}
{{ include ".helm.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define ".helm.selectorLabels" -}}
app.kubernetes.io/name: {{ include ".helm.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define ".helm.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include ".helm.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
EdgePort SIP ports for every enabled transport, in a fixed order. Call it with
(dict "ctx" $ "transports" (list "udp" "tcp" ...)) to choose which transports to
list, and add "container" true to render container ports instead of service ports.
*/}}
{{- define ".helm.edgeportPorts" -}}
{{- $defaults := dict "udp" (list "sipudp" "UDP" 5060) "tcp" (list "siptcp" "TCP" 5060) "tls" (list "siptls" "TCP" 5061) "ws" (list "sipws" "TCP" 5062) "wss" (list "sipwss" "TCP" 5063) }}
{{- range $key := list "udp" "tcp" "tls" "ws" "wss" }}
{{- $transport := index $.ctx.Values.edgeport.transport $key }}
{{- if and $transport.enabled (has $key $.transports) }}
{{- $default := index $defaults $key }}
{{- $port := $transport.port | default (index $default 2) }}
- name: {{ index $default 0 }}
  protocol: {{ index $default 1 }}
{{- if $.container }}
  containerPort: {{ $port }}
{{- else }}
  port: {{ $port }}
  targetPort: {{ $port }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}

{{/*
The logLevel every component file carries, from global.logsLevel. Routr 3 knows four
levels; the components stop at startup on any other, so the chart stops first.
*/}}
{{- define ".helm.logLevel" -}}
{{- $level := .Values.global.logsLevel | default "info" -}}
{{- if not (has $level (list "debug" "info" "warn" "error")) -}}
{{- fail (printf "global.logsLevel must be debug, info, warn or error, not %q" $level) -}}
{{- end -}}
{{- $level -}}
{{- end }}

{{/*
The Redis parameters of a cache: the value, or the chart's own Redis. Call it with
(dict "ctx" $ "component" "location" "parameters" .Values.location.cache.parameters).
*/}}
{{- define ".helm.redisParameters" -}}
{{- if .parameters -}}
{{- .parameters -}}
{{- else if .ctx.Values.redis.enabled -}}
host={{ .ctx.Release.Name }}-redis-master.{{ .ctx.Release.Namespace }},port=6379
{{- else -}}
{{- fail (printf "%s.cache.parameters is required when %s.cache.provider is redis and redis.enabled is false" .component .component) -}}
{{- end -}}
{{- end }}

{{/*
The Routr 2 image that applies the schema: no migration ships with Routr 3, so its tag
is pinned in the values instead of following Chart.AppVersion.
*/}}
{{- define ".helm.migrationsImage" -}}
{{- $image := .Values.apiserver.migrations.image -}}
{{ $image.repository }}:{{ required "apiserver.migrations.image.tag is required: Routr 3 publishes no migrations image, so it can't follow the chart's appVersion" $image.tag }}
{{- end }}

{{/*
The telemetry key of every component file, when global.otlpEndpoint is set: the OTLP/HTTP
base URL of its traces, metrics and logs.
*/}}
{{- define ".helm.telemetry" -}}
{{- with .Values.global.otlpEndpoint -}}
telemetry:
  otlpEndpoint: {{ . | quote }}
{{- end -}}
{{- end }}

{{/*
The name that resolves to exactly the Requester's pods, requester/service-headless.yaml.
*/}}
{{- define ".helm.requesterHeadless" -}}
{{ .Release.Name }}-routr-requester-headless.{{ .Release.Namespace }}
{{- end }}

{{/*
connect.trustedRegistryAddresses as a JSON list, each entry rendered as a template. With
registry.enabled false there is no Requester, so the default name is left out.
*/}}
{{- define ".helm.trustedRegistryAddresses" -}}
{{- $ctx := . -}}
{{- $addresses := list -}}
{{- range .Values.connect.trustedRegistryAddresses -}}
{{- $entry := tpl . $ctx -}}
{{- if or $ctx.Values.registry.enabled (ne $entry (include ".helm.requesterHeadless" $ctx)) -}}
{{- $addresses = append $addresses $entry -}}
{{- end -}}
{{- end -}}
{{- toJson $addresses -}}
{{- end }}
