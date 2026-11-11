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

import (
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"
)

const cloakKey = "k1.aesgcm256.DbQoar8ZLuUsOHZqyyBwUWiOaquZ5DBbVKvtg9dZnCY="

// The example of ROUTR3.md § 3.7, with every kind of value.
const routrExample = `
apiVersion: v3
kind: Routr
ref: routr-01
metadata:
  region: default
spec:
  edgeport:
    externalAddrs: [203.0.113.10]
    localnets: [10.0.0.0/8]
    transport:
      - { protocol: udp, port: 5060 }
      - { protocol: TCP, port: 5060 }
      - { protocol: tls, port: 5061 }
    securityContext:
      keyStore: /etc/routr/certs/signaling.p12
      keyStorePassword: secret://k8s/routr-tls#password
  connect:
    nonceMaxAge: 0
    registerDefaultExpires: 600
  location:
    cache: { provider: Redis, parameters: "host=redis,port=6379,password=${REDIS_PASSWORD}" }
  data:
    backend: postgres
    url: secret://env/DATABASE_URL
    encryptionKey: secret://file/var/run/routr/secrets/cloak
  rtprelay:
    host: ${RTPENGINE_HOST:-rtpengine}
    port: 22222
`

// The least routr.yaml RoutrOne accepts.
const routrMinimum = `
apiVersion: v3
kind: Routr
spec:
  edgeport:
    transport:
      - protocol: udp
        port: 5060
  data:
    backend: files
    path: /etc/routr/resources
`

func exampleOptions() ResolveOptions {
	return ResolveOptions{
		Env: EnvFromMap(map[string]string{
			"DATABASE_URL":   "postgres://u:p@db/routr",
			"REDIS_PASSWORD": "r3d1s",
		}),
		ReadFile: func(path string) (string, error) {
			switch path {
			case "/var/run/routr/secrets/routr-tls/password":
				return "changeme\n", nil
			case "/var/run/routr/secrets/cloak":
				return cloakKey + "\n", nil
			}
			return "", os.ErrNotExist
		},
	}
}

func TestLoadsTheRepositoryRoutrConfig(t *testing.T) {
	cfg, err := LoadRoutr(filepath.Join("..", "..", "..", "config", "routr.yaml"), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Ref != "routr-01" || cfg.LogLevel != "info" || len(cfg.Spec.EdgePort.Transport) != 5 || cfg.Spec.Data.Path != "/etc/routr/resources" {
		t.Errorf("%+v", cfg)
	}
	if cfg.Spec.Dispatcher.BindAddr != DefaultDispatcherBindAddr || cfg.Spec.Connect.BindAddr != DefaultConnectBindAddr || cfg.Spec.Location.BindAddr != DefaultLocationBindAddr || cfg.Spec.Data.BindAddr != DefaultDataBindAddr {
		t.Errorf("every service on its Routr 2 port: %+v", cfg.Spec)
	}
}

func TestParseRoutrExample(t *testing.T) {
	cfg, err := ParseRoutr([]byte(routrExample), exampleOptions())
	if err != nil {
		t.Fatal(err)
	}
	if cfg.APIVersion != "v3" || cfg.Kind != "Routr" || cfg.Ref != "routr-01" || cfg.Metadata["region"] != "default" || cfg.LogLevel != "info" {
		t.Errorf("header: %+v", cfg)
	}

	ep := cfg.Spec.EdgePort
	if ep.BindAddr != "0.0.0.0" || len(ep.Transport) != 3 || ep.Transport[1].Protocol != "tcp" || ep.Transport[1].BindAddr != "0.0.0.0" {
		t.Errorf("edgeport defaults as edgeport.yaml: %+v", ep)
	}
	if !reflect.DeepEqual(ep.Methods, DefaultMethods) || !slices.Contains(ep.Methods, "OPTIONS") || slices.Contains(ep.Methods, "MESSAGE") {
		t.Errorf("methods default to Routr 2's list plus OPTIONS: %v", ep.Methods)
	}
	if ep.SecurityContext == nil || ep.SecurityContext.KeyStorePassword != "changeme" {
		t.Errorf("secret://k8s resolved: %+v", ep.SecurityContext)
	}
	if ep.Processor != nil {
		t.Errorf("no processor in RoutrOne: %+v", ep.Processor)
	}
	epCfg := cfg.EdgePortConfig()
	if epCfg.Kind != "EdgePort" || epCfg.Spec != ep || epCfg.Ref != "routr-01" {
		t.Errorf("EdgePortConfig: %+v", epCfg)
	}

	if !reflect.DeepEqual(cfg.Spec.Connect, ConnectSpec{BindAddr: DefaultConnectBindAddr, NonceMaxAge: 0, RegisterDefaultExpires: 600}) {
		t.Errorf("connect, with an explicit 0: %+v", cfg.Spec.Connect)
	}
	if cfg.Spec.Location.Cache != (Cache{Provider: "redis", Parameters: "host=redis,port=6379,password=r3d1s"}) {
		t.Errorf("location, provider lower-cased and ${VAR} resolved: %+v", cfg.Spec.Location.Cache)
	}
	if !reflect.DeepEqual(cfg.Spec.Data, DataSpec{BindAddr: DefaultDataBindAddr, Backend: "postgres", URL: "postgres://u:p@db/routr", EncryptionKey: cloakKey}) {
		t.Errorf("data, secret://env and secret://file resolved: %+v", cfg.Spec.Data)
	}
	if cfg.Spec.RTPRelay == nil || !reflect.DeepEqual(*cfg.Spec.RTPRelay, RTPRelaySpec{Host: "rtpengine", Port: 22222}) {
		t.Errorf("rtprelay, ${VAR:-default} resolved: %+v", cfg.Spec.RTPRelay)
	}
}

func TestParseRoutrMinimum(t *testing.T) {
	cfg, err := ParseRoutr([]byte(routrMinimum), ResolveOptions{Env: EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.Spec.Connect, ConnectSpec{BindAddr: "0.0.0.0:51904", NonceMaxAge: 300, RegisterDefaultExpires: 3600}) {
		t.Errorf("connect defaults: %+v", cfg.Spec.Connect)
	}
	if !reflect.DeepEqual(cfg.Spec.Location, LocationSpec{BindAddr: "0.0.0.0:51902", Cache: Cache{Provider: "memory"}}) {
		t.Errorf("location defaults: %+v", cfg.Spec.Location)
	}
	if !reflect.DeepEqual(cfg.Spec.Dispatcher, DispatcherSpec{BindAddr: "0.0.0.0:51901"}) {
		t.Errorf("dispatcher defaults: %+v", cfg.Spec.Dispatcher)
	}
	if !reflect.DeepEqual(cfg.Spec.Data, DataSpec{BindAddr: "0.0.0.0:51907", Backend: "files", Path: "/etc/routr/resources"}) {
		t.Errorf("data: %+v", cfg.Spec.Data)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("logLevel defaults to info: %q", cfg.LogLevel)
	}
	if cfg.Spec.RTPRelay != nil {
		t.Errorf("no rtprelay means nil: %+v", cfg.Spec.RTPRelay)
	}
	if cfg.Spec.EdgePort.SecurityContext != nil || len(cfg.Spec.EdgePort.Methods) != len(DefaultMethods) {
		t.Errorf("edgeport: %+v", cfg.Spec.EdgePort)
	}

	redis := strings.Replace(routrMinimum, "  data:", "  location:\n    cache:\n      provider: redis\n  data:", 1)
	cfg, err = ParseRoutr([]byte(redis), ResolveOptions{Env: EnvFromMap(nil)})
	if err != nil || cfg.Spec.Location.Cache != (Cache{Provider: "redis", Parameters: DefaultRedisParameters}) {
		t.Errorf("redis without parameters gets Routr 2's default: %+v %v", cfg, err)
	}
}

// Every component section takes a bindAddr: absent is the Routr 2 port,
// empty turns the listener off, anything else is where it listens.
func TestParseRoutrBindAddrs(t *testing.T) {
	text := routrMinimum + `  dispatcher: {bindAddr: ""}
  connect: {bindAddr: "127.0.0.1:0"}
  location: {bindAddr: ""}
logLevel: debug
`
	cfg, err := ParseRoutr([]byte(strings.Replace(text, "    path: /etc/routr/resources\n", "    path: /etc/routr/resources\n    bindAddr: 127.0.0.1:51907\n", 1)), ResolveOptions{Env: EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	got := []string{cfg.Spec.Dispatcher.BindAddr, cfg.Spec.Connect.BindAddr, cfg.Spec.Location.BindAddr, cfg.Spec.Data.BindAddr}
	if want := []string{"", "127.0.0.1:0", "", "127.0.0.1:51907"}; !reflect.DeepEqual(got, want) {
		t.Errorf("bindAddrs = %q, want %q", got, want)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("logLevel: %q", cfg.LogLevel)
	}
}

func TestParseRoutrValidation(t *testing.T) {
	with := func(old, new string) string { return strings.Replace(routrMinimum, old, new, 1) }
	cases := map[string]struct{ text, want string }{
		"not yaml":             {"{{{", "file is not a valid JSON or YAML file"},
		"missing spec":         {"apiVersion: v3\nkind: Routr\n", "spec: is required"},
		"missing apiVersion":   {with("apiVersion: v3\n", ""), "apiVersion: is required"},
		"bad apiVersion":       {with("apiVersion: v3", "apiVersion: v2"), "apiVersion: should be equal to constant v3"},
		"bad kind":             {with("kind: Routr", "kind: RoutrOne"), "kind: should be equal to constant Routr"},
		"unknown root key":     {routrMinimum + "extra: 1\n", "extra: unknown key"},
		"unknown section":      {routrMinimum + "  nope: {}\n", "spec.nope: unknown key"},
		"bad metadata":         {with("kind: Routr", "kind: Routr\nmetadata: {region: 1}"), "metadata.region: should be string"},
		"missing edgeport":     {with("  edgeport:\n    transport:\n      - protocol: udp\n        port: 5060\n", ""), "spec.edgeport: is required"},
		"missing transport":    {with("    transport:\n      - protocol: udp\n        port: 5060\n", "    bindAddr: 0.0.0.0\n"), "spec.edgeport should have required property 'transport'"},
		"empty transport":      {with("    transport:\n      - protocol: udp\n        port: 5060\n", "    transport: []\n"), "spec.edgeport.transport: should NOT have fewer than 1 items"},
		"unknown edgeport":     {with("  edgeport:\n", "  edgeport:\n    bogus: 1\n"), "spec.edgeport.bogus: unknown key"},
		"unknown transport":    {with("        port: 5060\n", "        port: 5060\n        tls: true\n"), "spec.edgeport.transport[0].tls: unknown key"},
		"bad port":             {with("port: 5060", "port: sip"), "spec.edgeport.transport[0].port should be integer"},
		"unknown security":     {with("  edgeport:\n", "  edgeport:\n    securityContext:\n      password: x\n"), "spec.edgeport.securityContext.password: unknown key"},
		"unknown client":       {with("  edgeport:\n", "  edgeport:\n    securityContext:\n      client:\n        verify: true\n"), "spec.edgeport.securityContext.client.verify: unknown key"},
		"unknown processor":    {with("  edgeport:\n", "  edgeport:\n    processor:\n      host: x\n"), "spec.edgeport.processor.host: unknown key"},
		"duplicated protocol":  {with("        port: 5060\n", "        port: 5060\n      - protocol: udp\n        port: 5070\n"), "spec.edgeport: found duplicated entries at .spec.transport"},
		"tls without security": {with("        port: 5060\n", "        port: 5060\n      - protocol: tls\n        port: 5061\n"), "spec.edgeport: found at least one secure protocol"},
		"unknown connect":      {routrMinimum + "  connect: {verifier: {}}\n", "spec.connect.verifier: unknown key"},
		"negative nonce":       {routrMinimum + "  connect: {nonceMaxAge: -1}\n", "spec.connect.nonceMaxAge: should be >= 0"},
		"zero expires":         {routrMinimum + "  connect: {registerDefaultExpires: 0}\n", "spec.connect.registerDefaultExpires: should be >= 1"},
		"float expires":        {routrMinimum + "  connect: {registerDefaultExpires: 1.5}\n", "spec.connect.registerDefaultExpires: should be integer"},
		"bad provider":         {routrMinimum + "  location: {cache: {provider: memcached}}\n", "spec.location.cache.provider: should be equal to one of the allowed values"},
		"bad cache key":        {routrMinimum + "  location: {cache: {provider: redis, host: x}}\n", "spec.location.cache.host: unknown key"},
		"bad parameters":       {routrMinimum + "  location: {cache: {provider: redis, parameters: 'host=x,password=s3cr3t,db=1'}}\n", "spec.location.cache.parameters: invalid parameter: db"},
		"empty parameters":     {routrMinimum + "  location: {cache: {provider: redis, parameters: ''}}\n", "spec.location.cache.parameters: should NOT be shorter than 1 characters"},
		"location bindAddr":    {routrMinimum + "  location: {bindAddr: 51902}\n", "spec.location.bindAddr: should be string"},
		"connect bindAddr":     {routrMinimum + "  connect: {bindAddr: [a]}\n", "spec.connect.bindAddr: should be string"},
		"data bindAddr":        {routrMinimum + "    bindAddr: {}\n", "spec.data.bindAddr: should be string"},
		"dispatcher bindAddr":  {routrMinimum + "  dispatcher: {bindAddr: 1}\n", "spec.dispatcher.bindAddr: should be string"},
		"dispatcher unknown":   {routrMinimum + "  dispatcher: {processors: []}\n", "spec.dispatcher.processors: unknown key"},
		"bad logLevel":         {routrMinimum + "logLevel: verbose\n", "logLevel: should be equal to one of the allowed values"},
		"logLevel not string":  {routrMinimum + "logLevel: [info]\n", "logLevel: should be string"},
		"missing data":         {with("  data:\n    backend: files\n    path: /etc/routr/resources\n", ""), "spec.data: is required"},
		"missing backend":      {with("    backend: files\n", ""), "spec.data.backend: is required"},
		"bad backend":          {with("backend: files", "backend: mysql"), "spec.data.backend: should be equal to one of the allowed values"},
		"files without path":   {with("    path: /etc/routr/resources\n", ""), "spec.data.path: is required"},
		"postgres without url": {with("backend: files", "backend: postgres"), "spec.data.url: is required"},
		"empty url":            {with("backend: files", "backend: postgres\n    url: ''"), "spec.data.url: should NOT be shorter than 1 characters"},
		"bad encryptionKey":    {routrMinimum + "    encryptionKey: s3cr3t\n", "spec.data.encryptionKey: should be a cloak key"},
		"unknown data key":     {routrMinimum + "    startInternal: true\n", "spec.data.startInternal: unknown key"},
		"requester bindAddr":   {routrMinimum + "  requester: {bindAddr: 51909}\n", "spec.requester.bindAddr: should be string"},
		"requester sipHost":    {routrMinimum + "  requester: {sipHost: ''}\n", "spec.requester.sipHost: should NOT be shorter than 1 characters"},
		"requester unknown":    {routrMinimum + "  requester: {host: x}\n", "spec.requester.host: unknown key"},
		"registry no ways out": {routrMinimum + "  registry: {registerInterval: 20}\n", "spec.registry.edgePorts: is required"},
		"registry empty list":  {routrMinimum + "  registry: {edgePorts: []}\n", "spec.registry.edgePorts: should NOT have fewer than 1 items"},
		"registry no address":  {routrMinimum + "  registry: {edgePorts: [{region: a}]}\n", "spec.registry.edgePorts[0].address: is required"},
		"registry interval":    {routrMinimum + "  registry: {registerInterval: 0, edgePorts: [{address: 'a:1'}]}\n", "spec.registry.registerInterval: should be > 0"},
		"registry unknown":     {routrMinimum + "  registry: {apiAddr: x, edgePorts: [{address: 'a:1'}]}\n", "spec.registry.apiAddr: unknown key"},
		"registry loopback":    {routrMinimum + "  requester: {sipHost: 127.0.0.1}\n  registry: {edgePorts: [{address: 'a:1'}]}\n", "spec.requester.sipHost: with spec.registry"},
		"registry unspecified": {routrMinimum + "  requester: {sipHost: 0.0.0.0}\n  registry: {edgePorts: [{address: 'a:1'}]}\n", "spec.requester.sipHost: with spec.registry"},
		"registry host name":   {routrMinimum + "  requester: {sipHost: requester}\n  registry: {edgePorts: [{address: 'a:1'}]}\n", "spec.requester.sipHost: with spec.registry"},
		"rtprelay no port":     {routrMinimum + "  rtprelay: {host: rtpengine}\n", "spec.rtprelay.port: is required"},
		"rtprelay bad port":    {routrMinimum + "  rtprelay: {host: rtpengine, port: 70000}\n", "spec.rtprelay.port: should be <= 65535"},
		"rtprelay empty host":  {routrMinimum + "  rtprelay: {host: '', port: 1}\n", "spec.rtprelay.host: should NOT be shorter than 1 characters"},
		"rtprelay unknown":     {routrMinimum + "  rtprelay: {host: h, port: 1, timeout: 5}\n", "spec.rtprelay.timeout: unknown key"},
		"rtprelay not object":  {routrMinimum + "  rtprelay: rtpengine\n", "spec.rtprelay: should be object"},
		"unset placeholder":    {with("path: /etc/routr/resources", "path: ${RESOURCES}"), "spec.data.path: references undefined environment variable ${RESOURCES}"},
		"unset reference":      {with("path: /etc/routr/resources", "path: secret://env/RESOURCES"), "spec.data.path: secret://env/RESOURCES: environment variable RESOURCES is not set"},
	}
	for name, c := range cases {
		_, err := ParseRoutr([]byte(c.text), ResolveOptions{Env: EnvFromMap(nil)})
		if err == nil {
			t.Errorf("%s: accepted", name)
			continue
		}
		if !strings.HasPrefix(err.Error(), c.want) {
			t.Errorf("%s: got %q, want prefix %q", name, err, c.want)
		}
		if strings.Contains(err.Error(), "s3cr3t") {
			t.Errorf("%s: the error carries a value: %v", name, err)
		}
	}
}

func TestParseRoutrErrorsNeverCarryAResolvedSecret(t *testing.T) {
	// The url resolves to a secret before validation finds the bad port.
	text := strings.Replace(routrExample, "port: 22222", "port: 0", 1)
	_, err := ParseRoutr([]byte(text), exampleOptions())
	if err == nil || !strings.HasPrefix(err.Error(), "spec.rtprelay.port: should be >= 1") {
		t.Fatalf("%v", err)
	}
	for _, secret := range []string{"u:p@db", "r3d1s", "changeme", cloakKey} {
		if strings.Contains(err.Error(), secret) {
			t.Errorf("the error carries %s", secret)
		}
	}
}

func TestLoadRoutr(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "routr.yaml")
	text := strings.Replace(routrMinimum, "path: /etc/routr/resources", "path: ${ROUTR_TEST_RESOURCES}", 1)
	if err := os.WriteFile(path, []byte(text), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ROUTR_TEST_RESOURCES", dir)

	cfg, err := LoadRoutr(path, ResolveOptions{})
	if err != nil || cfg.Spec.Data.Path != dir {
		t.Errorf("reads the process environment: %+v %v", cfg, err)
	}

	cfg, err = LoadRoutr(path, ResolveOptions{Env: EnvFromMap(map[string]string{"ROUTR_TEST_RESOURCES": "/other"})})
	if err != nil || cfg.Spec.Data.Path != "/other" {
		t.Errorf("injected environment: %+v %v", cfg, err)
	}

	_, err = LoadRoutr(path, ResolveOptions{Env: EnvFromMap(nil)})
	if err == nil || !strings.HasPrefix(err.Error(), "config file "+path+": spec.data.path: ") {
		t.Errorf("names the file: %v", err)
	}
	if _, err := LoadRoutr("", noEnv); err == nil {
		t.Error("an unset CONFIG_PATH fails")
	}
	if _, err := LoadRoutr(filepath.Join(dir, "nope.yaml"), noEnv); err == nil {
		t.Error("a missing file fails")
	}
}

// spec.requester has its Routr 2 port by default; spec.registry is off until
// asked for.
func TestParseRoutrRequesterAndRegistry(t *testing.T) {
	cfg, err := ParseRoutr([]byte(routrMinimum), ResolveOptions{Env: EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.Spec.Requester, RequesterSpec{BindAddr: DefaultRequesterBindAddr}) || cfg.Spec.Registry != nil {
		t.Errorf("defaults: %+v %+v", cfg.Spec.Requester, cfg.Spec.Registry)
	}

	cfg, err = ParseRoutr([]byte(routrMinimum+`  requester: {bindAddr: "", sipHost: 10.0.0.1}
  registry:
    registerInterval: 2.5
    methods: [INVITE, MESSAGE]
    edgePorts:
      - {address: "sip01.edgeport.net:5060", region: us-east1}
`), ResolveOptions{Env: EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.Spec.Requester, RequesterSpec{SIPHost: "10.0.0.1"}) {
		t.Errorf("requester: %+v", cfg.Spec.Requester)
	}
	want := &RegistrySpec{
		RegisterInterval: 2.5,
		Methods:          []string{"INVITE", "MESSAGE"},
		EdgePorts:        []RegistryEdgePort{{Address: "sip01.edgeport.net:5060", Region: "us-east1"}},
	}
	if !reflect.DeepEqual(cfg.Spec.Registry, want) {
		t.Errorf("registry: %+v", cfg.Spec.Registry)
	}
}

func TestRoutrHealthSection(t *testing.T) {
	const minimal = `
apiVersion: v3
kind: Routr
spec:
  edgeport:
    transport:
      - { protocol: udp, port: 5060 }
  data:
    backend: files
    path: /etc/routr/resources
`
	opts := ResolveOptions{Env: EnvFromMap(nil)}
	cfg, err := ParseRoutr([]byte(minimal), opts)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Spec.Health != nil {
		t.Errorf("absent is off: %+v", cfg.Spec.Health)
	}
	cfg, err = ParseRoutr([]byte(minimal+"  health: {}\n"), opts)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Spec.Health == nil || cfg.Spec.Health.BindAddr != DefaultHealthBindAddr {
		t.Errorf("an empty section takes the default: %+v", cfg.Spec.Health)
	}
	cfg, err = ParseRoutr([]byte(minimal+"  health: { bindAddr: 127.0.0.1:9090 }\n"), opts)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Spec.Health.BindAddr != "127.0.0.1:9090" {
		t.Errorf("bindAddr: %+v", cfg.Spec.Health)
	}
	for text, key := range map[string]string{
		"  health: { port: 8080 }\n":     "spec.health",
		"  health: { bindAddr: \"\" }\n": "spec.health.bindAddr",
		"  health: true\n":               "spec.health",
	} {
		if _, err := ParseRoutr([]byte(minimal+text), opts); err == nil || !strings.Contains(err.Error(), key) {
			t.Errorf("%q names %s: %v", text, key, err)
		}
	}
}
