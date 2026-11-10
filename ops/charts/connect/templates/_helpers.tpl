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

{{/*
The Secret with the API key of the Data API and the Requester, and the reference to it in a
config file. Every pod that reads the reference mounts ".helm.apiKeyVolumeMount".
*/}}
{{- define ".helm.apiKeySecret" -}}
{{ .Release.Name }}-routr-api-key
{{- end }}

{{- define ".helm.apiKeyRef" -}}
{{ printf "secret://k8s/%s#apiKey" (include ".helm.apiKeySecret" .) | quote }}
{{- end }}

{{- define ".helm.apiKeyVolumeMount" -}}
- name: api-key
  mountPath: /var/run/routr/secrets/{{ include ".helm.apiKeySecret" . }}
  readOnly: true
{{- end }}

{{- define ".helm.apiKeyVolume" -}}
- name: api-key
  secret:
    secretName: {{ include ".helm.apiKeySecret" . }}
    defaultMode: 0440
{{- end }}

{{/*
The Secret with the Data API's certificate: tlsSecret, or the one the chart generates.
*/}}
{{- define ".helm.apiserverTLSSecret" -}}
{{ .Values.apiserver.tlsSecret | default (printf "%s-routr-apiserver-tls" .Release.Name) }}
{{- end }}

{{/*
What a client of the Data API writes as spec.apiAuth, at the indentation it includes it.
*/}}
{{- define ".helm.apiAuth" -}}
apiAuth:
  apiKey: {{ include ".helm.apiKeyRef" . }}
  {{- if .Values.apiserver.tlsOn }}
  tls:
    caFile: /etc/routr/certs/apiserver/ca.crt
    # Dialed at the headless Service, the certificate names the ClusterIP one
    serverName: {{ .Release.Name }}-routr-apiserver.{{ .Release.Namespace }}
  {{- end }}
{{- end }}

{{/*
The CA of the Data API's certificate for a client of it: only ca.crt, never the server's key.
*/}}
{{- define ".helm.apiserverCAVolumeMount" -}}
{{- if .Values.apiserver.tlsOn }}
- name: apiserver-ca
  mountPath: /etc/routr/certs/apiserver
  readOnly: true
{{- end }}
{{- end }}

{{- define ".helm.apiserverCAVolume" -}}
{{- if .Values.apiserver.tlsOn }}
- name: apiserver-ca
  secret:
    secretName: {{ include ".helm.apiserverTLSSecret" . }}
    defaultMode: 0440
    items:
      - key: ca.crt
        path: ca.crt
{{- end }}
{{- end }}

{{/*
Scale-out of a stateless Deployment (connect, apiserver, location, dispatcher), called with
(dict "ctx" . "component" "<values key>"). The values key is also the pods' service label.

".helm.replicas": the Deployment's replicas, left to the HorizontalPodAutoscaler when
autoscaling.enabled is true.
*/}}
{{- define ".helm.replicas" -}}
{{- $v := index .ctx.Values .component -}}
{{- if not $v.autoscaling.enabled }}
replicas: {{ $v.replicas }}
{{- end }}
{{- end }}

{{/*
".helm.topologySpread": spreads the pods over the nodes (topologySpread; empty turns it off).
ScheduleAnyway by default, so a small cluster still schedules every replica.
*/}}
{{- define ".helm.topologySpread" -}}
{{- $v := index .ctx.Values .component -}}
{{- with $v.topologySpread }}
topologySpreadConstraints:
  - maxSkew: {{ .maxSkew | default 1 }}
    topologyKey: {{ .topologyKey | default "kubernetes.io/hostname" }}
    whenUnsatisfiable: {{ .whenUnsatisfiable | default "ScheduleAnyway" }}
    labelSelector:
      matchLabels:
        {{- include ".helm.selectorLabels" $.ctx | nindent 8 }}
        service: {{ $.component }}
{{- end }}
{{- end }}

{{/*
".helm.pdb": a PodDisruptionBudget that keeps pdb.minAvailable pods through a node drain. Only
with more than one replica (or the autoscaler): with one, minAvailable 1 would block the drain.
*/}}
{{- define ".helm.pdb" -}}
{{- $v := index .ctx.Values .component -}}
{{- if and $v.pdb $v.pdb.enabled (or $v.autoscaling.enabled (gt (int $v.replicas) 1)) }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ .ctx.Release.Name }}-routr-{{ .component }}
  namespace: {{ .ctx.Release.Namespace }}
  labels:
    {{- include ".helm.labels" .ctx | nindent 4 }}
    service: {{ .component }}
spec:
  minAvailable: {{ $v.pdb.minAvailable }}
  selector:
    matchLabels:
      {{- include ".helm.selectorLabels" .ctx | nindent 6 }}
      service: {{ .component }}
{{- end }}
{{- end }}

{{/*
".helm.headlessService": a Service without a cluster IP, so its name resolves to the IP of every
ready pod and the gRPC clients that dial it (round robin) spread their calls over all of them. A
ClusterIP Service gives a gRPC client one long-lived connection, to one pod. Takes "port" too.
*/}}
{{- define ".helm.headlessService" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ .ctx.Release.Name }}-routr-{{ .component }}-headless
  namespace: {{ .ctx.Release.Namespace }}
  labels:
    {{- include ".helm.labels" .ctx | nindent 4 }}
    service: {{ .component }}
spec:
  clusterIP: None
  ports:
  - port: {{ .port }}
    targetPort: {{ .port }}
  selector:
    {{- include ".helm.selectorLabels" .ctx | nindent 4 }}
    service: {{ .component }}
{{- end }}

{{/*
".helm.headlessAddr": what a gRPC client of the component dials, its headless Service and port.
*/}}
{{- define ".helm.headlessAddr" -}}
{{ .ctx.Release.Name }}-routr-{{ .component }}-headless.{{ .ctx.Release.Namespace }}:{{ .port }}
{{- end }}
