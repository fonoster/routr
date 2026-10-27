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

import gov.nist.javax.sip.SipStackExt;
import gov.nist.javax.sip.clientauthutils.AccountManager;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import javax.sip.ClientTransaction;
import javax.sip.SipException;
import javax.sip.SipProvider;
import javax.sip.header.ExtensionHeader;
import javax.sip.header.Header;
import javax.sip.header.ProxyAuthenticateHeader;
import javax.sip.header.WWWAuthenticateHeader;
import javax.sip.message.Response;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.ListIterator;

/**
 * Handles SIP authentication challenges.
 */
public class AuthenticationHandler {
  private static final Logger LOG = LogManager.getLogger(AuthenticationHandler.class);
  private final SipStackExt sipStack;
  private final javax.sip.header.HeaderFactory headerFactory;

  public AuthenticationHandler(SipStackExt sipStack, javax.sip.header.HeaderFactory headerFactory) {
    this.sipStack = sipStack;
    this.headerFactory = headerFactory;
  }

  /**
   * Creates an AccountManager from headers if x-gateway-auth header is present.
   * 
   * @param headers The list of headers
   * @param host The host for authentication
   * @return AccountManager if auth header found, null otherwise
   */
  public static AccountManager createAccountManager(final List<Header> headers, final String host) {
    for (Header header : headers) {
      if (header.getName().equalsIgnoreCase("x-gateway-auth")) {
        var authStr = ((ExtensionHeader) header).getValue();
        var auth = new String(Base64.getDecoder().decode(authStr));

        if (auth.split(":").length != 2) {
          throw new IllegalArgumentException(
              "invalid 'x-gateway-auth' header value; should be base64('username:password')");
        }

        var username = auth.split(":")[0];
        var password = auth.split(":")[1];
        return new AccountManagerImpl(username, password, host);
      }
    }
    return null;
  }

  /**
   * Handles an authentication challenge by creating a new authenticated request.
   * 
   * @param event The response event containing the challenge
   * @param accountManager The account manager for credentials
   * @return The new client transaction with authenticated request, or null on failure
   */
  public ClientTransaction handleAuthChallenge(javax.sip.ResponseEvent event, AccountManager accountManager) {
    var authHelper = sipStack.getAuthenticationHelper(accountManager, this.headerFactory);
    // Setting looseRouting to false will cause the issue described in
    //  https://github.com/fonoster/routr/issues/18
    try {
      var newClientTransaction = authHelper.handleChallenge(
          withSupportedChallenges(event.getResponse()),
          event.getClientTransaction(),
          (SipProvider) event.getSource(), 
          5, 
          true);
      
      // Set ApplicationData on the new transaction so ACK increment logic can detect authentication
      newClientTransaction.setApplicationData(accountManager);
      
      // Check if this is a WebSocket/WSS connection to prevent recursive loop
      var originalRequest = event.getClientTransaction().getRequest();
      boolean isWebSocket = TransportDetector.isWebSocketTransport(originalRequest);
      SipMessageSender.sendRequest(newClientTransaction, isWebSocket);
      
      return newClientTransaction;
    } catch (NullPointerException | SipException e) {
      var request = event.getClientTransaction().getRequest();
      var callId = (javax.sip.header.CallIdHeader) request.getHeader(javax.sip.header.CallIdHeader.NAME);
      LOG.debug("an exception occurred while handling authentication challenge for callId: {}", 
          callId != null ? callId.getCallId() : "unknown", e);
      return null;
    }
  }

  /**
   * Returns the challenge without the digest challenges JAIN-SIP cannot answer.
   *
   * <p>JAIN-SIP 1.3.0 computes digests with MD5 only: it answers a SHA-256
   * challenge with an MD5 hash labelled SHA-256, and it answers every challenge
   * in the response. A server that offers SHA-256 and MD5 (RFC 8760), such as
   * Meta's WhatsApp SIP gateway, checks the SHA-256 answer first and rejects the
   * request ("403 Invalid digest auth response"). Answering only the challenges
   * JAIN-SIP computes correctly is what RFC 8760 asks of a client anyway: answer
   * the strongest algorithm it supports.
   *
   * <p>The response is returned unchanged when every challenge is supported or
   * none is (so the server's own error stays visible).
   *
   * @param response a 401 or 407 response
   * @return the response, or a copy that keeps only the supported challenges
   */
  public static Response withSupportedChallenges(final Response response) {
    var name = response.getStatusCode() == Response.UNAUTHORIZED
        ? WWWAuthenticateHeader.NAME
        : ProxyAuthenticateHeader.NAME;

    var supported = new ArrayList<Header>();
    var total = 0;
    ListIterator<?> challenges = response.getHeaders(name);
    while (challenges != null && challenges.hasNext()) {
      var challenge = (WWWAuthenticateHeader) challenges.next();
      total++;
      if (isSupportedAlgorithm(challenge.getAlgorithm())) {
        supported.add(challenge);
      }
    }

    if (supported.isEmpty() || supported.size() == total) {
      return response;
    }

    var filtered = (Response) response.clone();
    filtered.removeHeader(name);
    supported.forEach(filtered::addHeader);
    LOG.debug("answering {} of {} digest challenges; dropped the algorithms JAIN-SIP cannot compute",
        supported.size(), total);
    return filtered;
  }

  // RFC 2617 defaults to MD5 when the algorithm is absent
  private static boolean isSupportedAlgorithm(final String algorithm) {
    return algorithm == null
        || algorithm.isBlank()
        || algorithm.equalsIgnoreCase("MD5")
        || algorithm.equalsIgnoreCase("MD5-sess");
  }

  /**
   * Checks if a response requires authentication.
   * 
   * @param response The response to check
   * @return true if authentication is required
   */
  public static boolean authenticationRequired(final Response response) {
    int statusCode = response.getStatusCode();
    return statusCode == Response.PROXY_AUTHENTICATION_REQUIRED || statusCode == Response.UNAUTHORIZED;
  }
}

