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
package io.routr.utils;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import javax.sip.SipException;
import javax.sip.address.SipURI;
import javax.sip.header.RouteHeader;
import javax.sip.header.ToHeader;
import javax.sip.message.Request;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.ListIterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.FutureTask;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.LongSupplier;
import java.util.regex.Pattern;

/**
 * Removes the Route entries that name this EdgePort by a hostname that resolves to one of
 * its own addresses (an interface address or an external address), on the port of the
 * listening point for the entry's transport. Only entries the incoming request carried are
 * considered; a Route the processor added is never removed.
 *
 * <p>Runs on the listener thread, so every DNS wait is bounded: a lookup starts only for a
 * new INVITE (no To tag) and its first candidate name, runs on a small executor with no
 * queue, and is waited for at most {@link #WAIT_MS}. Every other request uses the cache
 * only. A name that is not known to be this EdgePort is kept, as before.
 */
public class SelfRoutes {
  private static final Logger LOG = LogManager.getLogger(SelfRoutes.class);
  private static final Pattern IPV4 = Pattern.compile("\\d{1,3}(\\.\\d{1,3}){3}");

  static final int MAX_LOOKUPS = 4;
  static final long WAIT_MS = 200;
  static final long FRESH_MS = 30_000;
  static final long EXPIRE_MS = 60_000;
  static final long NEGATIVE_MS = 10_000;
  static final int MAX_ENTRIES = 1024;

  /** Resolves a name to its addresses; production uses {@code InetAddress::getAllByName}. */
  @FunctionalInterface
  public interface Lookup {
    InetAddress[] lookup(String host) throws UnknownHostException;
  }

  /** A cached answer; {@code addresses} is null for a failed lookup. */
  private static final class Entry {
    private final Set<String> addresses;
    private final long resolvedAt;

    private Entry(final Set<String> addresses, final long resolvedAt) {
      this.addresses = addresses;
      this.resolvedAt = resolvedAt;
    }
  }

  private final Set<String> ownAddresses;
  private final Map<String, Integer> listeningPorts;
  private final Lookup lookup;
  private final LongSupplier clock;
  private final ThreadPoolExecutor executor;
  private final Map<String, Future<Entry>> inflight = new HashMap<>();
  private final LinkedHashMap<String, Entry> cache = new LinkedHashMap<>(16, 0.75f, true) {
    @Override
    protected boolean removeEldestEntry(final Map.Entry<String, Entry> eldest) {
      return size() > MAX_ENTRIES;
    }
  };

  /**
   * @param interfaceAddresses every address of every network interface
   * @param externalAddrs      the EdgePort's {@code externalAddrs}
   * @param listeningPorts     the port of the listening point per transport (UDP, TCP, ...)
   * @param lookup             the resolver
   * @param clock              milliseconds, for the cache's ages
   */
  public SelfRoutes(final Set<String> interfaceAddresses, final List<String> externalAddrs,
      final Map<String, Integer> listeningPorts, final Lookup lookup, final LongSupplier clock) {
    var own = new HashSet<String>();
    interfaceAddresses.forEach(a -> own.add(normalize(a)));
    externalAddrs.forEach(a -> own.add(normalize(a)));
    this.ownAddresses = Collections.unmodifiableSet(own);
    this.listeningPorts = Map.copyOf(listeningPorts);
    this.lookup = lookup;
    this.clock = clock;
    this.executor = new ThreadPoolExecutor(MAX_LOOKUPS, MAX_LOOKUPS, 30, TimeUnit.SECONDS,
        new SynchronousQueue<>(), r -> {
          var t = new Thread(r, "self-route-lookup");
          t.setDaemon(true);
          return t;
        });
    this.executor.allowCoreThreadTimeOut(true);
  }

  /** Every address of every network interface, IPv4 and IPv6, loopback included. */
  public static Set<String> interfaceAddresses() {
    var out = new LinkedHashSet<String>();
    try {
      for (var netint : Collections.list(NetworkInterface.getNetworkInterfaces())) {
        for (var address : Collections.list(netint.getInetAddresses())) {
          out.add(normalize(address));
        }
      }
    } catch (SocketException e) {
      LOG.error("error getting network interfaces", e);
    }
    return out;
  }

  /**
   * Removes from {@code outgoing} the Route entries that {@code incoming} also carried and
   * that name this EdgePort.
   */
  public void removeOwnRoutes(final Request incoming, final Request outgoing) {
    var carried = new HashSet<String>();
    ListIterator<?> in = incoming.getHeaders(RouteHeader.NAME);
    while (in.hasNext()) {
      var uri = ((RouteHeader) in.next()).getAddress().getURI();
      if (uri instanceof SipURI) {
        carried.add(key((SipURI) uri));
      }
    }
    if (carried.isEmpty()) {
      return;
    }

    var to = (ToHeader) outgoing.getHeader(ToHeader.NAME);
    boolean mayLookup = Request.INVITE.equals(outgoing.getMethod()) && to != null && to.getTag() == null;

    var kept = new ArrayList<RouteHeader>();
    var removed = new ArrayList<String>();
    ListIterator<?> out = outgoing.getHeaders(RouteHeader.NAME);
    while (out.hasNext()) {
      var route = (RouteHeader) out.next();
      var uri = route.getAddress().getURI();
      if (!(uri instanceof SipURI) || !carried.contains(key((SipURI) uri))
          || !onListeningPort((SipURI) uri)) {
        kept.add(route);
        continue;
      }
      var host = ((SipURI) uri).getHost();
      boolean own;
      if (isIpLiteral(host)) {
        own = ownAddresses.contains(normalize(host));
      } else {
        own = isOwnName(host.toLowerCase(Locale.ROOT), mayLookup);
        // Only the first candidate name may start a lookup
        mayLookup = false;
      }
      if (own) {
        removed.add(uri.toString());
      } else {
        kept.add(route);
      }
    }

    if (removed.isEmpty()) {
      return;
    }
    outgoing.removeHeader(RouteHeader.NAME);
    try {
      for (var route : kept) {
        outgoing.addLast(route);
      }
    } catch (SipException e) {
      LOG.error("an exception occurred while restoring the Route set", e);
    }
    LOG.debug("removed own routes {}", removed);
  }

  private boolean isOwnName(final String name, final boolean mayLookup) {
    long now = clock.getAsLong();
    Entry entry;
    synchronized (cache) {
      entry = cache.get(name);
      if (entry != null && now - entry.resolvedAt >= (entry.addresses == null ? NEGATIVE_MS : EXPIRE_MS)) {
        cache.remove(name);
        entry = null;
      }
    }

    if (entry != null) {
      if (mayLookup && entry.addresses != null && now - entry.resolvedAt >= FRESH_MS) {
        startLookup(name);
      }
      return isOwn(entry);
    }

    if (!mayLookup) {
      return false;
    }

    var answer = startLookup(name);
    if (answer == null) {
      return false;
    }
    try {
      return isOwn(answer.get(WAIT_MS, TimeUnit.MILLISECONDS));
    } catch (TimeoutException | ExecutionException e) {
      return false;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    }
  }

  private boolean isOwn(final Entry entry) {
    return entry.addresses != null && entry.addresses.stream().anyMatch(ownAddresses::contains);
  }

  /** Starts a lookup, or joins the one in flight; null when the executor is full. */
  Future<Entry> startLookup(final String name) {
    synchronized (inflight) {
      var running = inflight.get(name);
      if (running != null) {
        return running;
      }
      var task = new FutureTask<>(() -> resolve(name));
      inflight.put(name, task);
      try {
        executor.execute(task);
      } catch (RejectedExecutionException e) {
        inflight.remove(name);
        return null;
      }
      return task;
    }
  }

  private Entry resolve(final String name) {
    try {
      var addresses = new HashSet<String>();
      for (var address : lookup.lookup(name)) {
        addresses.add(normalize(address));
      }
      var entry = new Entry(addresses, clock.getAsLong());
      synchronized (cache) {
        cache.put(name, entry);
      }
      return entry;
    } catch (Exception e) {
      var entry = new Entry(null, clock.getAsLong());
      synchronized (cache) {
        // A failed refresh leaves a positive answer in place until it expires
        var current = cache.get(name);
        if (current == null || current.addresses == null) {
          cache.put(name, entry);
        }
      }
      return entry;
    } finally {
      synchronized (inflight) {
        inflight.remove(name);
      }
    }
  }

  private boolean onListeningPort(final SipURI uri) {
    var port = listeningPorts.get(transport(uri));
    return port != null && port == uri.getPort();
  }

  private static String key(final SipURI uri) {
    return uri.getHost().toLowerCase(Locale.ROOT) + "|" + uri.getPort() + "|" + transport(uri);
  }

  private static String transport(final SipURI uri) {
    var transport = uri.getTransportParam();
    return transport == null ? "UDP" : transport.toUpperCase(Locale.ROOT);
  }

  private static boolean isIpLiteral(final String host) {
    return host.contains(":") || IPV4.matcher(host).matches();
  }

  private static String normalize(final InetAddress address) {
    var host = address.getHostAddress();
    int scope = host.indexOf('%');
    return scope < 0 ? host : host.substring(0, scope);
  }

  /** An IP literal in its canonical form (IPv6 without brackets or zone); names lowercased. */
  private static String normalize(final String host) {
    var h = host.startsWith("[") && host.endsWith("]") ? host.substring(1, host.length() - 1) : host;
    if (h.contains(":")) {
      try {
        // A literal is parsed, never resolved
        return normalize(InetAddress.getByName(h));
      } catch (UnknownHostException e) {
        return h.toLowerCase(Locale.ROOT);
      }
    }
    return h.toLowerCase(Locale.ROOT);
  }

  /** Waits for the lookups in flight to finish (tests). */
  void awaitLookups() throws Exception {
    List<Future<Entry>> running;
    synchronized (inflight) {
      running = new ArrayList<>(inflight.values());
    }
    for (var f : running) {
      f.get(5, TimeUnit.SECONDS);
    }
  }

  /** The number of cached names (tests). */
  int size() {
    synchronized (cache) {
      return cache.size();
    }
  }
}
