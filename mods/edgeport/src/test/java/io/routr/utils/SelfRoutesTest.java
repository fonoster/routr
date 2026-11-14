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

import org.junit.jupiter.api.Test;

import javax.sip.SipFactory;
import javax.sip.header.RouteHeader;
import javax.sip.message.MessageFactory;
import javax.sip.message.Request;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class SelfRoutesTest {
  private static final Set<String> OWN = Set.of("10.216.30.43", "10.216.30.44", "127.0.0.1");
  private static final Map<String, Integer> PORTS = Map.of("UDP", 5060, "TCP", 5060, "TLS", 5061);

  private final MessageFactory messageFactory;
  private final AtomicLong now = new AtomicLong(1_000_000);
  private final Map<String, String[]> dns = new ConcurrentHashMap<>();
  private final AtomicInteger lookups = new AtomicInteger();

  public SelfRoutesTest() throws Exception {
    messageFactory = SipFactory.getInstance().createMessageFactory();
  }

  private InetAddress[] resolve(final String host) throws UnknownHostException {
    lookups.incrementAndGet();
    var answer = dns.get(host);
    if (answer == null) {
      throw new UnknownHostException(host);
    }
    var out = new InetAddress[answer.length];
    for (int i = 0; i < answer.length; i++) {
      out[i] = InetAddress.getByName(answer[i]);
    }
    return out;
  }

  private SelfRoutes selfRoutes() {
    return new SelfRoutes(OWN, List.of("203.0.113.7"), PORTS, this::resolve, now::get);
  }

  private Request request(final String method, final String toTag, final String... routes) throws Exception {
    var sb = new StringBuilder()
        .append(method).append(" sip:+15551230000@trunk.example.net SIP/2.0\r\n")
        .append("Via: SIP/2.0/UDP 10.0.0.9:5060;branch=z9hG4bK-1\r\n")
        .append("From: <sip:+15550001111@sip.local>;tag=a\r\n")
        .append("To: <sip:+15551230000@trunk.example.net>")
        .append(toTag == null ? "" : ";tag=" + toTag).append("\r\n")
        .append("Call-ID: abc\r\n")
        .append("CSeq: 1 ").append(method).append("\r\n")
        .append("Max-Forwards: 70\r\n");
    for (var route : routes) {
      sb.append("Route: ").append(route).append("\r\n");
    }
    sb.append("Content-Length: 0\r\n\r\n");
    return messageFactory.createRequest(sb.toString());
  }

  private Request invite(final String... routes) throws Exception {
    return request(Request.INVITE, null, routes);
  }

  private List<String> routes(final Request request) {
    var out = new ArrayList<String>();
    ListIterator<?> it = request.getHeaders(RouteHeader.NAME);
    while (it.hasNext()) {
      out.add(((RouteHeader) it.next()).getAddress().getURI().toString());
    }
    return out;
  }

  /** The processor forwards what it received; the outgoing request is a copy. */
  private List<String> forward(final SelfRoutes selfRoutes, final Request incoming) {
    var outgoing = (Request) incoming.clone();
    selfRoutes.removeOwnRoutes(incoming, outgoing);
    return routes(outgoing);
  }

  @Test
  public void removesARouteNamingThisEdgePortByAnyResolvingName() throws Exception {
    dns.put("routr", new String[] { "10.216.30.43" });

    assertEquals(List.of(), forward(selfRoutes(), invite("<sip:routr:5060;lr>")));
  }

  @Test
  public void matchesEveryInterfaceAddressNotOnlyTheLocalnetsNetworkAddress() throws Exception {
    dns.put("first", new String[] { "10.216.30.43" });
    dns.put("second", new String[] { "10.216.30.44" });
    dns.put("external", new String[] { "203.0.113.7" });
    dns.put("foreign", new String[] { "192.0.2.9" });
    var selfRoutes = selfRoutes();

    assertEquals(List.of(), forward(selfRoutes, invite("<sip:first:5060;lr>")));
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:second:5060;lr>")));
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:external:5060;lr>")));
    assertEquals(List.of("sip:foreign:5060;lr"), forward(selfRoutes, invite("<sip:foreign:5060;lr>")));
  }

  @Test
  public void keepsARouteOnAnotherPortAndComparesNamesCaseInsensitively() throws Exception {
    dns.put("routr", new String[] { "10.216.30.43" });
    var selfRoutes = selfRoutes();

    assertEquals(List.of("sip:routr:5070;lr"), forward(selfRoutes, invite("<sip:routr:5070;lr>")));
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:ROUTR:5060;lr>")));
    assertEquals(List.of("sip:routr:5060;transport=tls;lr"),
        forward(selfRoutes, invite("<sip:routr:5060;transport=tls;lr>")));
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:routr:5061;transport=TLS;lr>")));
  }

  @Test
  public void keepsARouteTheProcessorAdded() throws Exception {
    var incoming = invite();
    var outgoing = invite("<sip:10.216.30.43:5060;lr>");

    selfRoutes().removeOwnRoutes(incoming, outgoing);

    assertEquals(List.of("sip:10.216.30.43:5060;lr"), routes(outgoing));
  }

  @Test
  public void keepsTheRoutesItDoesNotOwnInTheirOrder() throws Exception {
    dns.put("routr", new String[] { "10.216.30.43" });
    var incoming = invite("<sip:routr:5060;lr>", "<sip:proxy.example.net:5060;lr>");
    var outgoing = invite("<sip:peer.example.net:5060;lr>", "<sip:routr:5060;lr>",
        "<sip:proxy.example.net:5060;lr>");

    selfRoutes().removeOwnRoutes(incoming, outgoing);

    assertEquals(List.of("sip:peer.example.net:5060;lr", "sip:proxy.example.net:5060;lr"), routes(outgoing));
  }

  @Test
  public void looksUpOnlyForANewInvite() throws Exception {
    dns.put("routr", new String[] { "10.216.30.43" });
    var selfRoutes = selfRoutes();

    assertEquals(List.of("sip:routr:5060;lr"),
        forward(selfRoutes, request(Request.BYE, "b", "<sip:routr:5060;lr>")));
    assertEquals(List.of("sip:routr:5060;lr"),
        forward(selfRoutes, request(Request.MESSAGE, null, "<sip:routr:5060;lr>")));
    assertEquals(List.of("sip:routr:5060;lr"),
        forward(selfRoutes, request(Request.INVITE, "b", "<sip:routr:5060;lr>")));
    assertEquals(0, lookups.get());

    // Once a new INVITE has cached the name, every request uses it
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:routr:5060;lr>")));
    assertEquals(List.of(), forward(selfRoutes, request(Request.BYE, "b", "<sip:routr:5060;lr>")));
    assertEquals(1, lookups.get());
  }

  @Test
  public void looksUpOnlyTheFirstCandidateName() throws Exception {
    dns.put("first", new String[] { "192.0.2.9" });
    dns.put("routr", new String[] { "10.216.30.43" });

    var out = forward(selfRoutes(), invite("<sip:first:5060;lr>", "<sip:routr:5060;lr>"));

    assertEquals(List.of("sip:first:5060;lr", "sip:routr:5060;lr"), out);
    assertEquals(1, lookups.get());
  }

  @Test
  public void neverResolvesAnIpLiteral() throws Exception {
    var selfRoutes = selfRoutes();

    assertEquals(List.of(), forward(selfRoutes, invite("<sip:10.216.30.44:5060;lr>")));
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:203.0.113.7:5060;lr>")));
    assertEquals(List.of("sip:192.0.2.9:5060;lr"), forward(selfRoutes, invite("<sip:192.0.2.9:5060;lr>")));
    assertEquals(List.of("sip:[2001:db8::1]:5060;lr"), forward(selfRoutes, invite("<sip:[2001:db8::1]:5060;lr>")));
    assertEquals(0, lookups.get());
  }

  @Test
  public void cachesAnAnswerFor30SecondsThenRefreshesItInTheBackground() throws Exception {
    dns.put("routr", new String[] { "10.216.30.43" });
    var selfRoutes = selfRoutes();

    assertEquals(List.of(), forward(selfRoutes, invite("<sip:routr:5060;lr>")));
    now.addAndGet(29_000);
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:routr:5060;lr>")));
    assertEquals(1, lookups.get());

    // Stale: used at once, and one refresh starts behind it
    now.addAndGet(2_000);
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:routr:5060;lr>")));
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:routr:5060;lr>")));
    selfRoutes.awaitLookups();
    assertEquals(2, lookups.get());

    // The refresh made the entry fresh again
    now.addAndGet(20_000);
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:routr:5060;lr>")));
    selfRoutes.awaitLookups();
    assertEquals(2, lookups.get());
  }

  @Test
  public void dropsAnEntryWithNoSuccessfulRefreshAt60Seconds() throws Exception {
    dns.put("routr", new String[] { "10.216.30.43" });
    var selfRoutes = selfRoutes();
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:routr:5060;lr>")));

    dns.remove("routr");
    now.addAndGet(31_000);
    assertEquals(List.of(), forward(selfRoutes, invite("<sip:routr:5060;lr>")));
    selfRoutes.awaitLookups();
    assertEquals(2, lookups.get());

    now.addAndGet(30_000);
    assertEquals(List.of("sip:routr:5060;lr"),
        forward(selfRoutes, request(Request.BYE, "b", "<sip:routr:5060;lr>")));
  }

  @Test
  public void keepsARouteThatDoesNotResolveAndCachesTheFailureFor10Seconds() throws Exception {
    var selfRoutes = selfRoutes();

    assertEquals(List.of("sip:nowhere:5060;lr"), forward(selfRoutes, invite("<sip:nowhere:5060;lr>")));
    now.addAndGet(9_000);
    assertEquals(List.of("sip:nowhere:5060;lr"), forward(selfRoutes, invite("<sip:nowhere:5060;lr>")));
    assertEquals(1, lookups.get());

    now.addAndGet(2_000);
    forward(selfRoutes, invite("<sip:nowhere:5060;lr>"));
    assertEquals(2, lookups.get());
  }

  @Test
  public void waitsAtMost200MsForALookupAndCachesItsLateAnswer() throws Exception {
    var release = new CountDownLatch(1);
    var selfRoutes = new SelfRoutes(OWN, List.of(), PORTS, host -> {
      lookups.incrementAndGet();
      try {
        release.await();
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
      return new InetAddress[] { InetAddress.getByName("10.216.30.43") };
    }, now::get);

    long start = System.nanoTime();
    var out = forward(selfRoutes, invite("<sip:slow:5060;lr>"));
    long waitedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);

    assertEquals(List.of("sip:slow:5060;lr"), out);
    assertTrue(waitedMs >= 150 && waitedMs < 400, "waited " + waitedMs + " ms");

    release.countDown();
    selfRoutes.awaitLookups();
    assertEquals(List.of(), forward(selfRoutes, request(Request.BYE, "b", "<sip:slow:5060;lr>")));
    assertEquals(1, lookups.get());
  }

  @Test
  public void doesNotWaitOrStartALookupWhenTheExecutorIsFull() throws Exception {
    var release = new CountDownLatch(1);
    var started = new CountDownLatch(SelfRoutes.MAX_LOOKUPS);
    var selfRoutes = new SelfRoutes(OWN, List.of(), PORTS, host -> {
      lookups.incrementAndGet();
      started.countDown();
      try {
        release.await();
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
      return new InetAddress[] { InetAddress.getByName("10.216.30.43") };
    }, now::get);

    IntStream.range(0, SelfRoutes.MAX_LOOKUPS)
        .forEach(i -> selfRoutes.startLookup("busy" + i));
    assertTrue(started.await(2, TimeUnit.SECONDS));

    long start = System.nanoTime();
    var out = forward(selfRoutes, invite("<sip:another:5060;lr>"));
    long waitedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);

    assertEquals(List.of("sip:another:5060;lr"), out);
    assertTrue(waitedMs < 50, "waited " + waitedMs + " ms");
    assertEquals(SelfRoutes.MAX_LOOKUPS, lookups.get());

    release.countDown();
    selfRoutes.awaitLookups();
    assertEquals(SelfRoutes.MAX_LOOKUPS, lookups.get());
  }

  @Test
  public void runsOneLookupForConcurrentInvitesNamingTheSameHost() throws Exception {
    var release = new CountDownLatch(1);
    var selfRoutes = new SelfRoutes(OWN, List.of(), PORTS, host -> {
      lookups.incrementAndGet();
      try {
        release.await();
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
      return new InetAddress[] { InetAddress.getByName("10.216.30.43") };
    }, now::get);

    int n = 8;
    ExecutorService callers = Executors.newFixedThreadPool(n);
    var ready = new CountDownLatch(n);
    var futures = IntStream.range(0, n).mapToObj(i -> callers.submit(() -> {
      ready.countDown();
      return forward(selfRoutes, invite("<sip:shared:5060;lr>"));
    })).toList();
    ready.await();
    Thread.sleep(50);
    release.countDown();
    for (var f : futures) {
      f.get(2, TimeUnit.SECONDS);
    }
    callers.shutdown();

    assertEquals(1, lookups.get());
  }

  @Test
  public void holdsAtMost1024Names() throws Exception {
    var selfRoutes = selfRoutes();

    IntStream.range(0, 1025).forEach(i -> {
      try {
        forward(selfRoutes, invite("<sip:host" + i + ":5060;lr>"));
      } catch (Exception e) {
        throw new RuntimeException(e);
      }
    });

    assertEquals(1025, lookups.get());
    assertEquals(1024, selfRoutes.size());
  }
}
