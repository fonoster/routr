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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages active SIP transactions.
 */
public class TransactionManager {
  private final Map<String, Transaction> activeTransactions = new HashMap<>();

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
    cseqOffsets.remove(callId);
    originalCseqNumbers.keySet().removeIf(key -> key.startsWith(callId + "_"));
  }

  /**
   * Updates the client transaction for a call (used during authentication).
   * 
   * @param callId The call ID
   * @param clientTransaction The new client transaction
   */
  public void updateClientTransaction(String callId, ClientTransaction clientTransaction) {
    activeTransactions.put(callId + "_client", clientTransaction);
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

