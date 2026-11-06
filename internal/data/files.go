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

package data

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"google.golang.org/protobuf/proto"
	"gopkg.in/yaml.v3"
)

// filesStore serves the resources of a directory of YAML files, loaded once
// at start the way @routr/simpledata loaded them: every file of the
// directory holds a list of resources of any kind, refs are unique across
// files, and every *Ref names a resource of the right kind. Reads never
// touch the disk again.
type filesStore struct {
	tables map[Kind]*fileTable
}

// fileTable holds one kind: the items in file order, the position of each
// ref (the List cursor) and an index of every scalar field's values (FindBy).
type fileTable struct {
	items []proto.Message
	pos   map[string]int
	index map[string]map[string][]int
}

// NewFiles loads a directory of resource files into a Store. simpledata
// exited on the first bad resource; this returns the same message as an
// error, and main exits.
func NewFiles(dir string) (Store, error) {
	resources, err := readResources(dir)
	if err != nil {
		return nil, err
	}
	return buildFilesStore(resources, int32(time.Now().Unix()))
}

// readResources reads every file of the directory, in name order. A file
// holds a YAML (or JSON) list of resources; an empty file holds none.
func readResources(dir string) ([]*resource, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("resources path %s: %w", dir, err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)

	var all []*resource
	for _, name := range names {
		path := filepath.Join(dir, name)
		info, err := os.Stat(path)
		if err != nil {
			return nil, fmt.Errorf("config file %s: %w", path, err)
		}
		if !info.Mode().IsRegular() {
			return nil, fmt.Errorf("config file %s does not exist", path)
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("config file %s: %w", path, err)
		}
		list, err := parseResources(content)
		if err != nil {
			return nil, fmt.Errorf("config file %s: %w", path, err)
		}
		all = append(all, list...)
	}
	return all, nil
}

// parseResources decodes one file: a list of resources, or nothing.
func parseResources(content []byte) ([]*resource, error) {
	var doc yaml.Node
	if err := yaml.Unmarshal(content, &doc); err != nil {
		return nil, fmt.Errorf("file is not a valid JSON or YAML file: %w", err)
	}
	if doc.Kind == 0 || len(doc.Content) == 0 {
		return nil, nil
	}
	root := doc.Content[0]
	if root.Kind == yaml.ScalarNode && root.Tag == "!!null" {
		return nil, nil
	}
	if root.Kind != yaml.SequenceNode {
		return nil, fmt.Errorf("file must hold a list of resources")
	}
	var list []*resource
	if err := root.Decode(&list); err != nil {
		return nil, fmt.Errorf("file is not a valid JSON or YAML file: %w", err)
	}
	for _, r := range list {
		if r == nil {
			return nil, fmt.Errorf("file holds an empty resource")
		}
		if strings.Contains(r.Ref, " ") {
			return nil, fmt.Errorf("resource type %s has spaces in the reference: %q", strings.ToLower(r.Kind), r.Ref)
		}
	}
	return list, nil
}

// buildFilesStore checks the refs, validates every resource and builds the
// messages. now is the load time in Unix seconds, stamped on every item.
func buildFilesStore(resources []*resource, now int32) (*filesStore, error) {
	if err := checkReferences(resources); err != nil {
		return nil, err
	}
	b := &filesBuilder{byRef: make(map[string]*resource, len(resources)), now: now}
	for _, r := range resources {
		if err := r.validate(); err != nil {
			return nil, err
		}
		b.byRef[r.Ref] = r
	}

	s := &filesStore{tables: make(map[Kind]*fileTable, len(Kinds))}
	for _, kind := range Kinds {
		s.tables[kind] = &fileTable{
			pos:   make(map[string]int),
			index: make(map[string]map[string][]int),
		}
	}
	for _, r := range resources {
		msg, err := b.build(r)
		if err != nil {
			return nil, err
		}
		t := s.tables[kindOf(r.Kind)]
		i := len(t.items)
		t.items = append(t.items, msg)
		t.pos[r.Ref] = i
		for field, value := range fieldsOf(r) {
			values := t.index[field]
			if values == nil {
				values = make(map[string][]int)
				t.index[field] = values
			}
			values[value] = append(values[value], i)
		}
	}
	return s, nil
}

// checkReferences rejects duplicated refs across every file.
func checkReferences(resources []*resource) error {
	seen := make(map[string]bool, len(resources))
	var duplicates []string
	for _, r := range resources {
		if seen[r.Ref] {
			duplicates = append(duplicates, r.Ref)
		}
		seen[r.Ref] = true
	}
	if len(duplicates) > 0 {
		return fmt.Errorf("found duplicated references: %s", strings.Join(duplicates, ","))
	}
	return nil
}

func (s *filesStore) table(kind Kind) (*fileTable, error) {
	t, ok := s.tables[kind]
	if !ok {
		return nil, fmt.Errorf("unknown kind %q", kind)
	}
	return t, nil
}

// Get answers the item with the ref, as simpledata's get did: a copy, or
// not found.
func (s *filesStore) Get(_ context.Context, kind Kind, ref string) (proto.Message, error) {
	t, err := s.table(kind)
	if err != nil {
		return nil, err
	}
	i, ok := t.pos[ref]
	if !ok {
		return nil, &NotFoundError{Ref: ref}
	}
	return proto.Clone(t.items[i]), nil
}

// FindBy answers every item whose field prints as the value, as
// simpledata's findBy compared them. A field the model has not is no match.
func (s *filesStore) FindBy(_ context.Context, kind Kind, field, value string) ([]proto.Message, error) {
	t, err := s.table(kind)
	if err != nil {
		return nil, err
	}
	hits := t.index[field][value]
	items := make([]proto.Message, 0, len(hits))
	for _, i := range hits {
		items = append(items, proto.Clone(t.items[i]))
	}
	return items, nil
}

// List answers one page in file order, with Prisma's take as pgdata's list
// read it: a size of 0 is no limit (the wire can't tell it from an absent
// pageSize, which an SDK list({}) sends) and a negative size is the items
// before the token. A token that names no item is an empty page, as Prisma's
// cursor answered pgdata.
func (s *filesStore) List(_ context.Context, kind Kind, page Page) ([]proto.Message, error) {
	t, err := s.table(kind)
	if err != nil {
		return nil, err
	}
	cursor := -1
	if page.Token != "" {
		i, ok := t.pos[page.Token]
		if !ok {
			return []proto.Message{}, nil
		}
		cursor = i
	}
	start, end := cursor+1, len(t.items)
	if page.Size < 0 {
		if cursor >= 0 {
			end = cursor
		}
		start = max(end+int(page.Size), 0)
	} else if page.Size > 0 && start+int(page.Size) < end {
		end = start + int(page.Size)
	}
	items := make([]proto.Message, 0, end-start)
	for _, item := range t.items[start:end] {
		items = append(items, proto.Clone(item))
	}
	return items, nil
}

// Close has nothing to release.
func (s *filesStore) Close() error { return nil }
