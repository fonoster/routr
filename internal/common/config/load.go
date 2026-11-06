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
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"

	"gopkg.in/yaml.v3"
)

// Validator checks a resolved configuration tree against the schema of one
// file kind. Its error names the key, never a value.
type Validator func(tree map[string]any) error

// finisher is a decoded file that fills in the defaults that depend on
// decoded values and runs the checks that need them.
type finisher interface {
	finish() error
}

// Load reads the YAML (or JSON) configuration file at path, resolves its
// ${VAR} placeholders and secret:// references through opts, validates the
// tree and decodes it into the struct. Every file Routr reads comes through
// here: routr.yaml and the standalone files. An error names the file and the
// key, never a value: "config file <path>: <key>: <reason>".
func Load(path string, validate Validator, into any, opts ResolveOptions) error {
	if path == "" {
		return errors.New("CONFIG_PATH is not set")
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return fmt.Errorf("config file %s does not exist", path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("config file %s does not exist", path)
	}
	if err := Parse(data, validate, into, opts); err != nil {
		return fmt.Errorf("config file %s: %w", path, err)
	}
	return nil
}

// Parse is Load on the content of a file already read.
func Parse(data []byte, validate Validator, into any, opts ResolveOptions) error {
	raw := map[string]any{}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return errors.New("file is not a valid JSON or YAML file")
	}
	resolved, err := Resolve(raw, opts)
	if err != nil {
		return err
	}
	tree, _ := resolved.(map[string]any)
	if validate != nil {
		if err := validate(tree); err != nil {
			return err
		}
	}
	if err := decodeTree(tree, into); err != nil {
		return err
	}
	if f, ok := into.(finisher); ok {
		return f.finish()
	}
	return nil
}

// decodeTree fills a struct from a validated tree through its yaml tags. A
// value the schema let through but the struct cannot hold is reported by
// its key, never its value.
func decodeTree(tree map[string]any, into any) error {
	data, err := yaml.Marshal(tree)
	if err != nil {
		return err
	}
	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return err
	}
	if err := doc.Decode(into); err != nil {
		key, want := decodeFailure(&doc, err)
		return fmt.Errorf("%s: %s", key, want)
	}
	return nil
}

// yaml's type errors read "line N: cannot unmarshal !!tag `value` into type"
var decodeError = regexp.MustCompile("line (\\d+): cannot unmarshal (!!\\S+)(?: `[^`]*`)? into (\\S+)")

// decodeFailure names the key whose value yaml could not decode (the
// deepest node on the line the error reports, of the kind it reports) and
// what the key should hold.
func decodeFailure(doc *yaml.Node, err error) (key, want string) {
	key, want = "(root)", "does not match the schema"
	var te *yaml.TypeError
	if !errors.As(err, &te) || len(te.Errors) == 0 {
		return key, want
	}
	m := decodeError.FindStringSubmatch(te.Errors[0])
	if m == nil {
		return key, want
	}
	line, _ := strconv.Atoi(m[1])
	kind := kindOfTag(m[2])
	switch m[3] {
	case "string":
		want = "should be string"
	case "int", "int32", "int64":
		want = "should be integer"
	case "bool":
		want = "should be boolean"
	case "[]string":
		want = "should be array"
	}

	var walk func(n *yaml.Node, path string)
	walk = func(n *yaml.Node, path string) {
		if n.Line == line && n.Kind == kind {
			key = pathOrRoot(path)
		}
		switch n.Kind {
		case yaml.DocumentNode:
			for _, c := range n.Content {
				walk(c, path)
			}
		case yaml.MappingNode:
			for i := 0; i+1 < len(n.Content); i += 2 {
				walk(n.Content[i+1], childPath(path, n.Content[i].Value))
			}
		case yaml.SequenceNode:
			for i, c := range n.Content {
				walk(c, fmt.Sprintf("%s[%d]", path, i))
			}
		}
	}
	walk(doc, "")
	return key, want
}

func kindOfTag(tag string) yaml.Kind {
	switch tag {
	case "!!seq":
		return yaml.SequenceNode
	case "!!map":
		return yaml.MappingNode
	}
	return yaml.ScalarNode
}

// The logLevel key, at the top level of every configuration file.
const DefaultLogLevel = "info"

var logLevels = []string{"debug", "info", "warn", "error"}

// validateLogLevel checks the optional logLevel key.
func validateLogLevel(raw map[string]any) error {
	v, ok := raw["logLevel"]
	if !ok {
		return nil
	}
	s, isString := v.(string)
	if !isString {
		return errors.New("logLevel: should be string")
	}
	for _, level := range logLevels {
		if s == level {
			return nil
		}
	}
	return errors.New("logLevel: should be equal to one of the allowed values (debug, info, warn, error)")
}
