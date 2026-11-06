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

package dispatcher

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/dop251/goja"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/fonoster/routr/internal/common/pb/processor"
)

// The JavaScript matcher: a matchFunc is a JavaScript arrow function over
// the MessageRequest, as Routr 2 configs write it, evaluated with goja (pure
// Go, no I/O, no host access). It is compiled once at load; each evaluation
// runs in a pooled runtime with a hard time limit and sees a fresh copy of
// the request, so it can neither mutate the message nor outlive the call.

// maxCallStackSize bounds recursion inside a matchFunc.
const maxCallStackSize = 128

// matchFuncWrapper gives the function the `req` the Node dispatcher passed:
// the MessageRequest as grpc-js decoded it (camelCase names, enums as
// strings, defaults present, and the oneof `messageType` set to the name of
// the member present: "requestUri" or "responseType").
const matchFuncWrapper = `(function (fn) {
  if (typeof fn !== "function") throw new TypeError("matchFunc is not a function")
  return function (json) {
    var req = JSON.parse(json)
    var m = req.message
    if (m !== null && typeof m === "object") {
      m.messageType = "responseType" in m ? "responseType" : ("requestUri" in m ? "requestUri" : undefined)
    }
    return fn(req)
  }
})(
%s
)`

// requestJSON encodes the request the way grpc-js presented it to Node: the
// fields the proto has, unset ones included.
var requestJSON = protojson.MarshalOptions{EmitUnpopulated: true}

// jsRuntime is one goja runtime holding the compiled function. Runtimes are
// not safe for concurrent use, so each evaluation takes one from the pool.
type jsRuntime struct {
	vm *goja.Runtime
	fn goja.Callable
}

type jsMatcher struct {
	program *goja.Program
	pool    sync.Pool
	timeout time.Duration
}

// compileMatchFunc compiles a matchFunc. `req => true` short-circuits to a
// Go function; anything else must be a JavaScript expression that evaluates
// to a function, or the load fails.
func compileMatchFunc(src string) (matchFunc, error) {
	if isConstantTrue(src) {
		return alwaysMatch, nil
	}
	program, err := goja.Compile("matchFunc", fmt.Sprintf(matchFuncWrapper, src), true)
	if err != nil {
		return nil, fmt.Errorf("matchFunc %q does not compile: %w", src, err)
	}
	m := &jsMatcher{program: program, timeout: matchFuncTimeout}
	// Instantiate once now so a value that is not a function fails the load
	rt, err := m.newRuntime()
	if err != nil {
		return nil, fmt.Errorf("matchFunc %q: %w", src, err)
	}
	m.pool.Put(rt)
	return m.match, nil
}

func (m *jsMatcher) newRuntime() (*jsRuntime, error) {
	vm := goja.New()
	vm.SetMaxCallStackSize(maxCallStackSize)
	v, err := vm.RunProgram(m.program)
	if err != nil {
		return nil, fmt.Errorf("does not evaluate: %w", err)
	}
	fn, ok := goja.AssertFunction(v)
	if !ok {
		return nil, errors.New("is not a function")
	}
	return &jsRuntime{vm: vm, fn: fn}, nil
}

func (m *jsMatcher) match(req *processor.MessageRequest) (bool, error) {
	data, err := requestJSON.Marshal(req)
	if err != nil {
		return false, fmt.Errorf("request cannot be encoded: %w", err)
	}
	rt, _ := m.pool.Get().(*jsRuntime)
	if rt == nil {
		if rt, err = m.newRuntime(); err != nil {
			return false, err
		}
	}
	timer := time.AfterFunc(m.timeout, func() { rt.vm.Interrupt("timed out after " + m.timeout.String()) })
	result, err := rt.fn(goja.Undefined(), rt.vm.ToValue(string(data)))
	if !timer.Stop() {
		// The interrupt fired (or may fire): this runtime is tainted
		rt.vm.ClearInterrupt()
		rt = nil
	}
	if rt != nil {
		m.pool.Put(rt)
	}
	if err != nil {
		var interrupted *goja.InterruptedError
		if errors.As(err, &interrupted) {
			return false, fmt.Errorf("matchFunc %v", interrupted.Value())
		}
		var overflow *goja.StackOverflowError
		if errors.As(err, &overflow) {
			return false, errors.New("matchFunc threw: RangeError: Maximum call stack size exceeded")
		}
		var exception *goja.Exception
		if errors.As(err, &exception) {
			return false, fmt.Errorf("matchFunc threw: %s", exception.Value().String())
		}
		return false, err
	}
	return result.ToBoolean(), nil
}
