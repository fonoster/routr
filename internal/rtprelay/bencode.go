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

package rtprelay

import (
	"bytes"
	"errors"
	"fmt"
	"slices"
	"strconv"
)

// maxBencodeDepth bounds the nesting an answer can make the decoder recurse
// through. RTPEngine's deepest answers (a query's streams) are a few levels.
const maxBencodeDepth = 32

// appendBencode appends the value's bencoding: strings, integers, lists and
// dictionaries with sorted keys, whose nil values are left out, as the bencode
// package rtpengine-client uses does.
func appendBencode(out []byte, value any) ([]byte, error) {
	var err error
	switch v := value.(type) {
	case string:
		out = strconv.AppendInt(out, int64(len(v)), 10)
		out = append(out, ':')
		return append(out, v...), nil
	case int:
		return appendBencodeInt(out, int64(v)), nil
	case int64:
		return appendBencodeInt(out, v), nil
	case []string:
		out = append(out, 'l')
		for _, item := range v {
			out, _ = appendBencode(out, item)
		}
		return append(out, 'e'), nil
	case []any:
		out = append(out, 'l')
		for _, item := range v {
			if out, err = appendBencode(out, item); err != nil {
				return nil, err
			}
		}
		return append(out, 'e'), nil
	case map[string]any:
		return appendBencodeDict(out, v)
	case Profile:
		return appendBencodeDict(out, v)
	case Params:
		return appendBencodeDict(out, v)
	}
	return nil, fmt.Errorf("can't bencode a %T", value)
}

func appendBencodeInt(out []byte, v int64) []byte {
	out = append(out, 'i')
	out = strconv.AppendInt(out, v, 10)
	return append(out, 'e')
}

func appendBencodeDict(out []byte, dict map[string]any) ([]byte, error) {
	keys := make([]string, 0, len(dict))
	for key, value := range dict {
		if value != nil {
			keys = append(keys, key)
		}
	}
	slices.Sort(keys)
	out = append(out, 'd')
	var err error
	for _, key := range keys {
		if out, err = appendBencode(out, key); err != nil {
			return nil, err
		}
		if out, err = appendBencode(out, dict[key]); err != nil {
			return nil, fmt.Errorf("%s: %w", key, err)
		}
	}
	return append(out, 'e'), nil
}

// decodeBencode reads the first value of data: a string, an int64, a []any or a
// map[string]any. Bytes after it are ignored, as the bencode package does. Data
// from the network: it fails with an error, never a panic.
func decodeBencode(data []byte) (any, error) {
	value, _, err := decodeBencodeValue(data, 0)
	return value, err
}

var errBencodeTruncated = errors.New("bencode: truncated")

func decodeBencodeValue(data []byte, depth int) (any, []byte, error) {
	if depth > maxBencodeDepth {
		return nil, nil, errors.New("bencode: too deep")
	}
	if len(data) == 0 {
		return nil, nil, errBencodeTruncated
	}
	switch c := data[0]; {
	case c == 'i':
		return decodeBencodeInt(data[1:])
	case c == 'l':
		return decodeBencodeList(data[1:], depth)
	case c == 'd':
		return decodeBencodeDict(data[1:], depth)
	case c >= '0' && c <= '9':
		return decodeBencodeString(data)
	default:
		return nil, nil, fmt.Errorf("bencode: unexpected byte %q", c)
	}
}

func decodeBencodeInt(data []byte) (any, []byte, error) {
	end := bytes.IndexByte(data, 'e')
	if end < 0 {
		return nil, nil, errBencodeTruncated
	}
	v, err := strconv.ParseInt(string(data[:end]), 10, 64)
	if err != nil {
		return nil, nil, errors.New("bencode: invalid integer")
	}
	return v, data[end+1:], nil
}

func decodeBencodeString(data []byte) (any, []byte, error) {
	colon := bytes.IndexByte(data, ':')
	if colon < 0 {
		return nil, nil, errBencodeTruncated
	}
	n, err := strconv.Atoi(string(data[:colon]))
	if err != nil || n < 0 {
		return nil, nil, errors.New("bencode: invalid string length")
	}
	rest := data[colon+1:]
	if n > len(rest) {
		return nil, nil, errBencodeTruncated
	}
	return string(rest[:n]), rest[n:], nil
}

func decodeBencodeList(data []byte, depth int) (any, []byte, error) {
	list := []any{}
	for {
		if len(data) == 0 {
			return nil, nil, errBencodeTruncated
		}
		if data[0] == 'e' {
			return list, data[1:], nil
		}
		value, rest, err := decodeBencodeValue(data, depth+1)
		if err != nil {
			return nil, nil, err
		}
		list = append(list, value)
		data = rest
	}
}

func decodeBencodeDict(data []byte, depth int) (any, []byte, error) {
	dict := map[string]any{}
	for {
		if len(data) == 0 {
			return nil, nil, errBencodeTruncated
		}
		if data[0] == 'e' {
			return dict, data[1:], nil
		}
		if data[0] < '0' || data[0] > '9' {
			return nil, nil, errors.New("bencode: a dictionary key must be a string")
		}
		key, rest, err := decodeBencodeString(data)
		if err != nil {
			return nil, nil, err
		}
		value, rest, err := decodeBencodeValue(rest, depth+1)
		if err != nil {
			return nil, nil, err
		}
		dict[key.(string)] = value
		data = rest
	}
}
