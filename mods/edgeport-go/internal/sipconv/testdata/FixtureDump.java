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
// Writes testdata/java from testdata/sip with the Java EdgePort's own converter, so the
// Go tests compare against what Java does. Needs JDK 17 and the EdgePort's jars in
// mods/edgeport/libs (npm run make):
//
//   javac -cp 'mods/edgeport/libs/*' -d /tmp/fixturedump \
//     mods/edgeport-go/internal/sipconv/testdata/FixtureDump.java
//   java -cp 'mods/edgeport/libs/*:/tmp/fixturedump' FixtureDump \
//     mods/edgeport-go/internal/sipconv/testdata/sip mods/edgeport-go/internal/sipconv/testdata/java
import com.google.protobuf.util.JsonFormat;
import io.routr.headers.MessageConverter;
import io.routr.message.SIPMessage;
import io.routr.utils.RequestUpdater;
import io.routr.utils.ResponseHelper;
import io.routr.headers.ResponseCode;

import javax.sip.SipFactory;
import javax.sip.header.Header;
import javax.sip.message.Message;
import javax.sip.message.Request;
import javax.sip.message.Response;
import java.nio.file.*;
import java.util.*;

// Dumps, for each raw SIP message, what the Java EdgePort's converter makes of it:
// the SIPMessage the processor gets, the headers it rebuilds from that SIPMessage
// (an identity processor), and the message the EdgePort would send with them.
public class FixtureDump {
  static String normalize(String text) {
    text = text.replace("\r\n", "\n");
    int split = text.indexOf("\n\n");
    String head = split >= 0 ? text.substring(0, split) : text;
    String body = split >= 0 ? text.substring(split + 2) : "";
    body = body.replace("\n", "\r\n");
    StringBuilder sb = new StringBuilder();
    for (String line : head.split("\n")) {
      String lower = line.toLowerCase();
      if (lower.startsWith("content-length:") || lower.startsWith("l:")) {
        line = line.substring(0, line.indexOf(':') + 1) + " " + body.getBytes().length;
      }
      sb.append(line).append("\r\n");
    }
    sb.append("\r\n").append(body);
    return sb.toString();
  }

  public static void main(String[] args) throws Exception {
    var mf = (gov.nist.javax.sip.message.MessageFactoryImpl) SipFactory.getInstance().createMessageFactory();
    var af = SipFactory.getInstance().createAddressFactory();
    Path in = Paths.get(args[0]);
    Path out = Paths.get(args[1]);
    Files.createDirectories(out);
    try (var files = Files.list(in)) {
      for (Path p : (Iterable<Path>) files.sorted()::iterator) {
        if (!p.toString().endsWith(".sip")) continue;
        String text = normalize(Files.readString(p));
        Message msg = text.startsWith("SIP/2.0") ? mf.createResponse(text) : mf.createRequest(text);
        SIPMessage dto = MessageConverter.convertToMessageDTO(msg);
        List<Header> headers = MessageConverter.createHeadersFromMessage(dto);
        StringBuilder json = new StringBuilder();
        json.append("{\n\"dto\": ").append(JsonFormat.printer().print(dto));
        json.append(",\n\"headers\": [");
        for (int i = 0; i < headers.size(); i++) {
          if (i > 0) json.append(",");
          json.append("\n  ").append(quote(headers.get(i).toString().trim()));
        }
        json.append("]");
        String sent;
        if (msg instanceof Request) {
          Request req = (Request) msg;
          var uri = dto.getRequestUri();
          var sipURI = af.createSipURI(uri.getUser().isEmpty() ? null : uri.getUser(), uri.getHost());
          sipURI.setPort(uri.getPort());
          req.setRequestURI(sipURI);
          sent = RequestUpdater.updateRequest(req, headers).toString();
        } else {
          Response res = (Response) msg.clone();
          ResponseHelper.removeHeadersToReplace(res);
          for (Header h : headers) res.addHeader(h);
          sent = res.toString();
        }
        json.append(",\n\"sent\": ").append(quote(sent));
        if (msg instanceof Request) {
          // A processor's 200 OK with the request's Contact and an extension
          Response ok = mf.createResponse(200, (Request) msg);
          ok.setReasonPhrase("");
          var reply = SIPMessage.newBuilder()
            .setResponseType(io.routr.message.ResponseType.OK)
            .addExtensions(io.routr.message.Extension.newBuilder().setName("X-Reply").setValue("1"))
            .addExtensions(io.routr.message.Extension.newBuilder().setName("Allow").setValue("INVITE"));
          if (dto.hasContact()) reply.setContact(dto.getContact());
          for (Header h : MessageConverter.createHeadersFromMessage(reply.build())) ok.addHeader(h);
          json.append(",\n\"answered\": ").append(quote(ok.toString()));
        }
        json.append("\n}\n");
        String name = p.getFileName().toString().replace(".sip", ".json");
        Files.writeString(out.resolve(name), json.toString());
        System.out.println("wrote " + name);
      }
    }
  }

  static String quote(String s) {
    StringBuilder sb = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      switch (c) {
        case '"': sb.append("\\\""); break;
        case '\\': sb.append("\\\\"); break;
        case '\r': sb.append("\\r"); break;
        case '\n': sb.append("\\n"); break;
        default: sb.append(c);
      }
    }
    return sb.append("\"").toString();
  }
}
