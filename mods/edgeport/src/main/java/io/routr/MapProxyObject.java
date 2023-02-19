/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
package io.routr;

import org.graalvm.polyglot.Value;
import org.graalvm.polyglot.proxy.ProxyObject;

import java.util.Map;

class MapProxyObject implements ProxyObject {
  private final Map<String, Object> map;

  public MapProxyObject(Map<String, Object> map) {
    this.map = map;
  }

  public void putMember(String key, Value value) {
    this.map.put(key, value.isHostObject() ? value.asHostObject() : value);
  }

  public boolean hasMember(String key) {
    return this.map.containsKey(key);
  }

  public Object getMemberKeys() {
    return this.map.keySet().toArray();
  }

  public Object getMember(String key) {
    Object v = this.map.get(key);
    if (v instanceof Map) {
      return new MapProxyObject((Map<String, Object>) v);
    } else {
      return v;
    }
  }

  public Map<String, Object> getMap() {
    return map;
  }
}
