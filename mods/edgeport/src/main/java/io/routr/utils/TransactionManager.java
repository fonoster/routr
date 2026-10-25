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


import javax.sip.ClientTransaction;
import javax.sip.ServerTransaction;
import javax.sip.Transaction;
import javax.sip.header.CallIdHeader;
import javax.sip.header.ViaHeader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages active SIP transactions.
 */
public class TransactionManager {
  private final Map<String, Transaction> activeTransactions = new HashMap<>();

  /**
   * The server transaction each client transaction answers for. activeTransactions is
   * keyed by call ID, so an in-dialog request (re-INVITE, BYE) overwrites the INVITE's
   * slot and a response can no longer find its own server transaction there. Keyed by
   * identity: JAIN-SIP transactions are compared by branch, which an authentication
   * retry reuses. A response must be sent on the server transaction of the request it
   * answers, so that transaction completes, JAIN-SIP releases it after timer J, and a
   * retransmitted request is answered again by the stack (RFC 3261 section 17.2.3)
   * instead of being absorbed by a transaction that never sent a response.
   */
  private final Map<ClientTransaction, ServerTransaction> serverByClient =
      Collections.synchronizedMap(new IdentityHashMap<>());

  /**
   * Per-dialog CSeq offset accrued from proxy-initiated authentication retries (see
   * AuthenticationHandler#handleAuthChallenge). Digest auth requires the UAC to
   * increment CSeq on a challenged retry (RFC 3261 §22.2); when routr authenticates on
   * the caller's behalf, it does that increment on the downstream leg alone, and the
   * caller's own request stream never learns about it. Recorded here so every request
   * forwarded afterward on this dialog — not just the ACK that immediately follows —
   * can be shifted to match what the downstream side now expects.
   *
   * ConcurrentHashMap: mutated from separate JAIN-SIP stack threads (the request
   * thread that shifts CSeq, the response thread that restores it, and the
   * transaction-terminated thread that cleans up).
   */
  private final Map<String, Integer> cseqOffsets = new ConcurrentHashMap<>();

  /**
   * Caller's original CSeq number per call ID and method, captured the instant
   * sendRequest shifts it. Restoring a response by subtracting cseqOffsets or by
   * copying from the server transaction both depend on state whose lifetime races
   * response handling on a call that runs long enough; recording the exact number the
   * caller sent removes that race. Keyed by call ID *and* method because a dialog has
   * separate CSeq spaces per in-flight request (e.g. an INVITE and a BYE at once).
   */
  private final Map<String, Long> originalCseqNumbers = new ConcurrentHashMap<>();

  /**
   * Call IDs of the dialogs this EdgePort proxied: recorded when the INVITE that
   * created the dialog is answered with a 2xx, released with the rest of the dialog's
   * state in {@link #removeDialog(String)}.
   *
   * In-dialog requests are forwarded by their Route set without routing or access
   * checks, which is right for BYE and ACK but would let an INVITE or REFER carrying a
   * forged To tag reach a trunk unauthenticated. Those two methods are therefore only
   * forwarded on dialogs recorded here; an unknown one is refused with 481. This is
   * local policy, which RFC 3261 section 16.6 lets a proxy apply; 481 is the code a UAS
   * gives an unknown dialog (section 12.2.2) and tells the sender what was wrong. The
   * state is per EdgePort by design: a dialog's requests return to the EdgePort that
   * Record-Routed it. It dies with the process, which is acceptable: after a restart
   * those two methods get 481 on calls from before it, every other method is still
   * forwarded, so those calls can still be torn down.
   */
  private final Set<String> proxiedDialogs = ConcurrentHashMap.newKeySet();

  /**
   * How long a cancel is remembered: 64 * T1 (RFC 3261 section 17.1.1.2), the
   * longest an INVITE client transaction can still be answered.
   */
  static final long CANCEL_MEMORY_MS = 64 * 500L;

  /**
   * Call IDs whose caller cancelled, with the time the CANCEL was processed. A
   * challenge (401/407) that arrives after the caller gave up must not be
   * answered: the authenticated retry would start a call nobody is waiting for.
   * This cannot be inferred from the caller's server transaction, which JAIN-SIP
   * removes as soon as the caller ACKs the 487 on a reliable transport.
   */
  private final Map<String, Long> cancelledAt = new ConcurrentHashMap<>();

  /**
   * Records that the caller of a call cancelled it.
   *
   * @param callId The call ID
   */
  public void markCancelled(String callId) {
    markCancelled(callId, System.currentTimeMillis());
  }

  void markCancelled(String callId, long nowMs) {
    // Drop what is past its memory, so calls that never form a dialog don't leak
    cancelledAt.values().removeIf(at -> nowMs - at > CANCEL_MEMORY_MS);
    cancelledAt.put(callId, nowMs);
  }

  /**
   * Whether the caller of a call cancelled it within the last 64 * T1.
   *
   * @param callId The call ID
   * @return true if the call was cancelled and that is still remembered
   */
  public boolean isCancelled(String callId) {
    return isCancelled(callId, System.currentTimeMillis());
  }

  boolean isCancelled(String callId, long nowMs) {
    var at = cancelledAt.get(callId);
    return at != null && nowMs - at <= CANCEL_MEMORY_MS;
  }

  /**
   * Records that this EdgePort proxied the dialog identified by the call ID.
   *
   * @param callId The call ID
   */
  public void recordDialog(String callId) {
    proxiedDialogs.add(callId);
  }

  /**
   * Whether this EdgePort proxied the dialog identified by the call ID.
   *
   * @param callId The call ID
   * @return true if the dialog was recorded and has not ended
   */
  public boolean hasDialog(String callId) {
    return proxiedDialogs.contains(callId);
  }

  /**
   * Records that a dialog was silently re-authenticated, so its CSeq offset from the
   * caller's numbering grows by one. Safe to call more than once for the same call:
   * a dialog challenged again later (e.g. a re-INVITE) accrues a further +1, matching
   * each additional increment JAIN-SIP applies on that leg.
   *
   * @param callId The call ID
   */
  public void recordAuthenticated(String callId) {
    cseqOffsets.merge(callId, 1, Integer::sum);
  }

  /**
   * Gets the accrued CSeq offset for a call, or 0 if it was never silently
   * re-authenticated.
   *
   * @param callId The call ID
   * @return The offset to add to that dialog's CSeq before forwarding a request
   */
  public int getCseqOffset(String callId) {
    return cseqOffsets.getOrDefault(callId, 0);
  }

  /**
   * Records the caller's CSeq number for a request just before sendRequest shifts it
   * by the dialog's offset.
   *
   * @param callId The call ID
   * @param method The request method
   * @param seqNumber The caller's original CSeq number
   */
  public void recordOriginalCSeq(String callId, String method, long seqNumber) {
    originalCseqNumbers.put(callId + "_" + method, seqNumber);
  }

  /**
   * Gets the caller's original CSeq number for a call and method.
   *
   * @param callId The call ID
   * @param method The request method
   * @return The caller's original CSeq number, or -1 if none was recorded
   */
  public long getOriginalCSeq(String callId, String method) {
    var value = originalCseqNumbers.get(callId + "_" + method);
    return value != null ? value : -1;
  }

  /**
   * Removes a recorded CSeq number once a final response has consumed it, so it
   * cannot leak past the request/response exchange it belongs to.
   *
   * @param callId The call ID
   * @param method The request method
   */
  public void removeOriginalCSeq(String callId, String method) {
    originalCseqNumbers.remove(callId + "_" + method);
  }

  /**
   * Stores a client and server transaction pair for a call.
   * 
   * @param callId The call ID
   * @param clientTransaction The client transaction
   * @param serverTransaction The server transaction
   */
  public void putTransactions(String callId, ClientTransaction clientTransaction, 
      ServerTransaction serverTransaction) {
    activeTransactions.put(callId + "_client", clientTransaction);
    activeTransactions.put(callId + "_server", serverTransaction);
    if (clientTransaction != null && serverTransaction != null) {
      serverByClient.put(clientTransaction, serverTransaction);
    }
  }

  /**
   * Gets the client transaction for a call.
   * 
   * @param callId The call ID
   * @return The client transaction, or null if not found
   */
  public ClientTransaction getClientTransaction(String callId) {
    return (ClientTransaction) activeTransactions.get(callId + "_client");
  }

  /**
   * Gets the server transaction for a call.
   * 
   * @param callId The call ID
   * @return The server transaction, or null if not found
   */
  public ServerTransaction getServerTransaction(String callId) {
    return (ServerTransaction) activeTransactions.get(callId + "_server");
  }

  /**
   * Removes only the slots still occupied by the transaction that just terminated.
   *
   * Slots are keyed by call ID, which a dialog reuses across transactions, so clearing
   * them wholesale discards a sibling that is still in flight. The CSeq offset outlives
   * every transaction on the dialog and is released by {@link #removeDialog(String)}.
   *
   * @param callId The call ID
   * @param terminated The transaction that reached the terminated state
   */
  public void removeTransaction(String callId, Transaction terminated) {
    if (terminated == null) {
      return;
    }

    if (activeTransactions.get(callId + "_client") == terminated) {
      activeTransactions.remove(callId + "_client");
    }

    if (activeTransactions.get(callId + "_server") == terminated) {
      activeTransactions.remove(callId + "_server");
    }

    serverByClient.remove(terminated);
    serverByClient.values().removeIf(serverTransaction -> serverTransaction == terminated);
  }

  /**
   * Releases dialog-scoped state once the dialog itself ends.
   *
   * The offset must survive every transaction on the dialog: a call's INVITE
   * transactions terminate seconds after answer, while the BYE that still needs the
   * offset — and the response that must have it subtracted back off — can arrive
   * minutes later.
   *
   * @param callId The call ID
   */
  public void removeDialog(String callId) {
    proxiedDialogs.remove(callId);
    cseqOffsets.remove(callId);
    cancelledAt.remove(callId);
    originalCseqNumbers.keySet().removeIf(key -> key.startsWith(callId + "_"));
  }

  /**
   * Updates the client transaction for a call (used during authentication).
   * 
   * @param callId The call ID
   * @param clientTransaction The new client transaction
   */
  public void updateClientTransaction(String callId, ClientTransaction clientTransaction) {
    var previous = activeTransactions.get(callId + "_client");
    if (previous != null) {
      var serverTransaction = serverByClient.remove(previous);
      if (serverTransaction != null) {
        serverByClient.put(clientTransaction, serverTransaction);
      }
    }
    activeTransactions.put(callId + "_client", clientTransaction);
  }

  /**
   * The server transaction whose request this client transaction was forwarding, or
   * null if the request was sent statelessly or the pair has been released.
   *
   * @param clientTransaction The client transaction a response arrived on
   * @return The matching server transaction, or null
   */
  public ServerTransaction getServerTransactionFor(ClientTransaction clientTransaction) {
    return clientTransaction == null ? null : serverByClient.get(clientTransaction);
  }

  /**
   * Removes all transactions matching a specific transport, host, and port.
   * Used when cleaning up after transport errors.
   * 
   * @param transport The transport protocol
   * @param host The host address
   * @param port The port number
   * @return List of removed transactions
   */
  public List<Transaction> removeTransactionsByTransport(String transport, String host, int port) {
    List<String> toRemove = new ArrayList<>();
    List<Transaction> removedTransactions = new ArrayList<>();
    
    for (Map.Entry<String, Transaction> entry : activeTransactions.entrySet()) {
      Transaction tx = entry.getValue();
      if (tx != null && tx.getRequest() != null) {
        ViaHeader via = (ViaHeader) tx.getRequest().getHeader(ViaHeader.NAME);
        if (via != null &&
            transport.equalsIgnoreCase(via.getTransport()) &&
            host.equals(via.getHost()) &&
            port == via.getPort()) {
          toRemove.add(entry.getKey());
          removedTransactions.add(tx);
        }
      }
    }

    for (String key : toRemove) {
      activeTransactions.remove(key);
      // These calls die here rather than through processDialogTerminated, so their
      // offsets would otherwise be retained for the life of the process.
      var callId = key.substring(0, key.lastIndexOf('_'));
      cseqOffsets.remove(callId);
      originalCseqNumbers.keySet().removeIf(k -> k.startsWith(callId + "_"));
    }

    return removedTransactions;
  }

  /**
   * Gets all active transaction keys.
   * 
   * @return Set of transaction keys
   */
  public java.util.Set<String> getActiveTransactionKeys() {
    return activeTransactions.keySet();
  }
}

