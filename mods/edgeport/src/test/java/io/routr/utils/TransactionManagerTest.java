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

import javax.sip.ClientTransaction;
import javax.sip.ServerTransaction;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Covers the per-dialog CSeq offset added to track proxy-initiated authentication
 * retries (see GRPCSipListener#sendRequest). Deliberately no SIP-stack mocking: this
 * state is plain call-id -> counter bookkeeping, independent of the transaction
 * objects the rest of TransactionManager stores.
 */
public class TransactionManagerTest {

  @Test
  public void testCseqOffsetDefaultsToZeroForAnUnknownCall() {
    var manager = new TransactionManager();

    assertEquals(0, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testRecordAuthenticatedSetsOffsetToOne() {
    var manager = new TransactionManager();

    manager.recordAuthenticated("call-1");

    assertEquals(1, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testASecondChallengeOnTheSameDialogAccruesTheOffset() {
    // A dialog can in principle be challenged more than once (e.g. a re-INVITE);
    // each retry increments CSeq once more on the downstream leg, so the tracked
    // offset must accrue rather than saturate at 1.
    var manager = new TransactionManager();

    manager.recordAuthenticated("call-1");
    manager.recordAuthenticated("call-1");

    assertEquals(2, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testOffsetsAreTrackedIndependentlyPerCall() {
    var manager = new TransactionManager();

    manager.recordAuthenticated("call-1");

    assertEquals(1, manager.getCseqOffset("call-1"));
    assertEquals(0, manager.getCseqOffset("call-2"));
  }

  @Test
  public void testRemoveTransactionsClearsTheOffsetSoItCannotLeak() {
    // TransactionManager is long-lived for the process, so a call-id whose offset is
    // never cleared on dialog end would accumulate forever. removeTransactions is
    // already the hook GRPCSipListener calls on timeout/transaction-terminated; the
    // offset must be cleared there rather than needing a separate cleanup call site.
    var manager = new TransactionManager();
    manager.putTransactions("call-1", null, null);
    manager.recordAuthenticated("call-1");

    manager.removeTransactions("call-1");

    assertEquals(0, manager.getCseqOffset("call-1"));
    assertNull(manager.getClientTransaction("call-1"));
  }

  @Test
  public void testRemoveTransactionsOnAnUnrelatedCallDoesNotClearThisOne() {
    var manager = new TransactionManager();
    manager.recordAuthenticated("call-1");

    manager.removeTransactions("call-2");

    assertEquals(1, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testTerminatingOneTransactionLeavesTheOtherLegInFlight() {
    // Reproduces the response-leg regression: a dialog's INVITE and its later BYE share
    // one call ID, so tearing down every slot when the INVITE terminated also discarded
    // the BYE's server transaction. GRPCSipListener needs that server transaction to put
    // the caller's original CSeq back on the 200 OK (RFC 3261 §8.2.6.2); without it the
    // caller sent "1 BYE" and got "2 BYE" back.
    var manager = new TransactionManager();
    var inviteClientTx = mock(ClientTransaction.class);
    var byeServerTx = mock(ServerTransaction.class);
    manager.putTransactions("call-1", inviteClientTx, byeServerTx);

    manager.removeTransaction("call-1", inviteClientTx);

    assertNull(manager.getClientTransaction("call-1"));
    assertSame(byeServerTx, manager.getServerTransaction("call-1"));
  }

  @Test
  public void testOffsetSurvivesWhileAnotherTransactionOnTheDialogIsStillInFlight() {
    var manager = new TransactionManager();
    var inviteClientTx = mock(ClientTransaction.class);
    var byeServerTx = mock(ServerTransaction.class);
    manager.putTransactions("call-1", inviteClientTx, byeServerTx);
    manager.recordAuthenticated("call-1");

    manager.removeTransaction("call-1", inviteClientTx);

    assertEquals(1, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testOffsetIsReleasedOnceTheDialogHasNoTransactionsLeft() {
    var manager = new TransactionManager();
    var clientTx = mock(ClientTransaction.class);
    var serverTx = mock(ServerTransaction.class);
    manager.putTransactions("call-1", clientTx, serverTx);
    manager.recordAuthenticated("call-1");

    manager.removeTransaction("call-1", clientTx);
    manager.removeTransaction("call-1", serverTx);

    assertEquals(0, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testRemoveTransactionIgnoresATransactionItDoesNotHold() {
    var manager = new TransactionManager();
    var heldTx = mock(ClientTransaction.class);
    var strayTx = mock(ClientTransaction.class);
    manager.putTransactions("call-1", heldTx, null);
    manager.recordAuthenticated("call-1");

    manager.removeTransaction("call-1", strayTx);

    assertSame(heldTx, manager.getClientTransaction("call-1"));
    assertEquals(1, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testRemoveTransactionToleratesANullTransaction() {
    var manager = new TransactionManager();
    var clientTx = mock(ClientTransaction.class);
    manager.putTransactions("call-1", clientTx, null);

    manager.removeTransaction("call-1", null);

    assertSame(clientTx, manager.getClientTransaction("call-1"));
  }
}
