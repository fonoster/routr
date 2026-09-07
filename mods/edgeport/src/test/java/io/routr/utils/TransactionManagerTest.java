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
 * Covers the per-dialog CSeq offset and per-call+method original CSeq recordings used
 * to track proxy-initiated authentication retries (see GRPCSipListener#sendRequest and
 * #restoreCallerCSeq). Deliberately no SIP-stack mocking where avoidable: this state is
 * plain call-id -> value bookkeeping, independent of the transaction objects the rest
 * of TransactionManager stores.
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
  public void testRemoveDialogOnAnUnrelatedCallDoesNotClearThisOne() {
    var manager = new TransactionManager();
    manager.recordAuthenticated("call-1");

    manager.removeDialog("call-2");

    assertEquals(1, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testTerminatingOneTransactionLeavesTheOtherLegInFlight() {
    // Reproduces the response-leg regression: the INVITE terminating used to discard the
    // BYE's still-in-flight server transaction, which the response path needs.
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
  public void testOffsetOutlivesEveryTransactionOnTheDialog() {
    // The INVITE transactions terminate seconds after answer, but the BYE that still
    // needs the offset can arrive minutes later — and its response needs the offset
    // subtracted back off again. Releasing on an empty slot count drops it mid-call.
    var manager = new TransactionManager();
    var clientTx = mock(ClientTransaction.class);
    var serverTx = mock(ServerTransaction.class);
    manager.putTransactions("call-1", clientTx, serverTx);
    manager.recordAuthenticated("call-1");

    manager.removeTransaction("call-1", clientTx);
    manager.removeTransaction("call-1", serverTx);

    assertEquals(1, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testRemoveDialogReleasesTheOffset() {
    var manager = new TransactionManager();
    manager.recordAuthenticated("call-1");

    manager.removeDialog("call-1");

    assertEquals(0, manager.getCseqOffset("call-1"));
  }

  @Test
  public void testAReleasedDialogDoesNotAccrueOntoItsOldOffset() {
    // A leaked offset is not just wasted memory: the next dialog on that call ID
    // accrues on top of it and every request gets shifted by too much.
    var manager = new TransactionManager();
    manager.recordAuthenticated("call-1");
    manager.removeDialog("call-1");

    manager.recordAuthenticated("call-1");

    assertEquals(1, manager.getCseqOffset("call-1"));
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

  @Test
  public void testOriginalCseqDefaultsToMinusOneForAnUnknownCall() {
    var manager = new TransactionManager();

    assertEquals(-1, manager.getOriginalCSeq("call-1", "BYE"));
  }

  @Test
  public void testRecordedOriginalCseqIsRetrievedByCallAndMethod() {
    var manager = new TransactionManager();

    manager.recordOriginalCSeq("call-1", "BYE", 1);

    assertEquals(1, manager.getOriginalCSeq("call-1", "BYE"));
  }

  @Test
  public void testOriginalCseqIsTrackedIndependentlyPerMethod() {
    // A dialog has separate CSeq spaces per in-flight request, e.g. an INVITE and a
    // BYE racing each other, so one method's recording must not shadow another's.
    var manager = new TransactionManager();

    manager.recordOriginalCSeq("call-1", "INVITE", 4);
    manager.recordOriginalCSeq("call-1", "BYE", 1);

    assertEquals(4, manager.getOriginalCSeq("call-1", "INVITE"));
    assertEquals(1, manager.getOriginalCSeq("call-1", "BYE"));
  }

  @Test
  public void testRemoveOriginalCseqClearsIt() {
    var manager = new TransactionManager();
    manager.recordOriginalCSeq("call-1", "BYE", 1);

    manager.removeOriginalCSeq("call-1", "BYE");

    assertEquals(-1, manager.getOriginalCSeq("call-1", "BYE"));
  }

  @Test
  public void testRemoveDialogClearsTheOriginalCseqForEveryMethodOnThatCall() {
    var manager = new TransactionManager();
    manager.recordOriginalCSeq("call-1", "INVITE", 4);
    manager.recordOriginalCSeq("call-1", "BYE", 1);

    manager.removeDialog("call-1");

    assertEquals(-1, manager.getOriginalCSeq("call-1", "INVITE"));
    assertEquals(-1, manager.getOriginalCSeq("call-1", "BYE"));
  }

  @Test
  public void testRemoveDialogOnAnUnrelatedCallDoesNotClearTheOriginalCseq() {
    var manager = new TransactionManager();
    manager.recordOriginalCSeq("call-1", "BYE", 1);

    manager.removeDialog("call-2");

    assertEquals(1, manager.getOriginalCSeq("call-1", "BYE"));
  }
}
