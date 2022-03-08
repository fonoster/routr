package io.routr;

import java.util.Map;
import org.graalvm.polyglot.Value;
import org.graalvm.polyglot.proxy.ProxyObject;

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
      return new MapProxyObject((Map) v);
    } else {
      return v;
    }
  }

  public Map<String, Object> getMap() {
    return map;
  }
}
