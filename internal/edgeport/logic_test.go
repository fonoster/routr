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
package edgeport

import (
	"encoding/base64"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/sipconv"
)

func mustParse(t *testing.T, text string) sip.Message {
	t.Helper()
	text = strings.ReplaceAll(strings.TrimLeft(text, "\n"), "\n", "\r\n")
	msg, err := sipconv.NewParser().ParseSIP([]byte(text))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	return msg
}

const invite = `
INVITE sip:1002@sip.local SIP/2.0
Via: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-1;rport
Record-Route: <sip:10.0.0.1;lr>
Route: <sip:10.0.0.9:5080;transport=tcp;lr>
Max-Forwards: 70
From: <sip:1001@sip.local>;tag=f1
To: <sip:1002@sip.local>
Call-ID: c1
CSeq: 4 INVITE
Contact: <sip:1001@10.0.0.2:5070>;expires=60
Expires: 30
Timestamp: 54
Content-Length: 0

`

func TestRequiresKnownDialog(t *testing.T) {
	req := mustParse(t, invite).(*sip.Request)
	if RequiresKnownDialog(req) {
		t.Error("an INVITE without a To tag starts a dialog")
	}
	for _, method := range []sip.RequestMethod{sip.MESSAGE, sip.NOTIFY, sip.REFER, sip.OPTIONS} {
		req.Method = method
		if RequiresKnownDialog(req) {
			t.Errorf("a %s without a To tag is not in a dialog", method)
		}
	}
	for _, method := range []sip.RequestMethod{sip.BYE, sip.ACK} {
		req.Method = method
		if !RequiresKnownDialog(req) {
			t.Errorf("a %s is forwarded by its Route set, To tag or not", method)
		}
	}
	req.To().Params.Add("tag", "t1")
	for _, method := range []sip.RequestMethod{sip.INVITE, sip.REFER, sip.BYE, sip.ACK, sip.MESSAGE, sip.NOTIFY, sip.UPDATE, sip.INFO, sip.PRACK, sip.OPTIONS} {
		req.Method = method
		if !RequiresKnownDialog(req) {
			t.Errorf("an in-dialog %s requires a known dialog", method)
		}
	}
	for _, method := range []sip.RequestMethod{sip.REGISTER, sip.CANCEL} {
		req.Method = method
		if RequiresKnownDialog(req) {
			t.Errorf("a %s keeps its own path", method)
		}
	}
}

func TestCanSendResponse(t *testing.T) {
	req := mustParse(t, invite).(*sip.Request)
	tx := &sip.ServerTx{}
	if !CanSendResponse(req, tx) {
		t.Error("a request with a transaction can be answered")
	}
	if CanSendResponse(req, nil) {
		t.Error("a request without a transaction (retransmission) cannot be answered")
	}
	req.Method = sip.ACK
	if CanSendResponse(req, tx) {
		t.Error("an ACK takes no response (#487)")
	}
}

func TestRegisterExpires(t *testing.T) {
	req := mustParse(t, invite).(*sip.Request)
	if got := RegisterExpires(req); got != 60 {
		t.Errorf("the Contact's expires wins: %d", got)
	}
	req.Contact().Params.Remove("expires")
	if got := RegisterExpires(req); got != 30 {
		t.Errorf("then the Expires header: %d", got)
	}
	req.RemoveHeader("Expires")
	if got := RegisterExpires(req); got != 0 {
		t.Errorf("then 0: %d", got)
	}
}

func TestNewResponseIsJAINSIPs(t *testing.T) {
	req := mustParse(t, invite).(*sip.Request)
	res := NewResponse(req, 180, "Ringing")
	if res.GetHeader("Record-Route") == nil {
		t.Error("a 1xx to a dialog-creating request copies Record-Route")
	}
	if _, ok := res.To().Params.Get("tag"); ok {
		t.Error("JAIN-SIP adds no To tag")
	}
	if res.GetHeader("Timestamp") == nil || res.GetHeader("Contact") != nil || res.GetHeader("Route") != nil {
		t.Errorf("copies From, To, Via, Call-ID, CSeq, Timestamp only:\n%s", res)
	}
	if NewResponse(req, 404, "Not found").GetHeader("Record-Route") != nil {
		t.Error("a failure copies no Record-Route")
	}
	req.To().Params.Add("tag", "x")
	if NewResponse(req, 200, "OK").GetHeader("Record-Route") != nil {
		t.Error("an in-dialog request's response copies no Record-Route")
	}
	trying := NewResponse(req, 100, "Trying")
	if _, ok := trying.To().Params.Get("tag"); ok {
		t.Error("100 Trying carries no To tag")
	}
}

func TestIsStackJob(t *testing.T) {
	for code, want := range map[int]bool{100: true, 487: true, 180: false, 200: false, 401: false} {
		res := sip.NewResponse(code, "")
		res.AppendHeader(&sip.CSeqHeader{SeqNo: 1, MethodName: sip.INVITE})
		if got := IsStackJob(res); got != want {
			t.Errorf("%d: %v", code, got)
		}
	}
	res := sip.NewResponse(200, "OK")
	res.AppendHeader(&sip.CSeqHeader{SeqNo: 1, MethodName: sip.CANCEL})
	if !IsStackJob(res) {
		t.Error("the 200 to a CANCEL is not relayed")
	}
}

func TestNextHop(t *testing.T) {
	req := mustParse(t, invite).(*sip.Request)
	if got := NextHop(req); got != (Hop{"10.0.0.9", 5080, "TCP"}) {
		t.Errorf("the first Route, with its transport: %+v", got)
	}
	req.RemoveHeader("Route")
	if got := NextHop(req); got != (Hop{"sip.local", 5060, "UDP"}) {
		t.Errorf("the Request-URI, the Via's transport, 5060: %+v", got)
	}
	req.Recipient.Scheme = "sips"
	if got := NextHop(req); got != (Hop{"sip.local", 5061, "TLS"}) {
		t.Errorf("sips is TLS on 5061: %+v", got)
	}
	req.Recipient.Scheme = "sip"
	req.Recipient.UriParams = sip.NewParams()
	req.Recipient.UriParams.Add("maddr", "10.0.0.7")
	if got := NextHop(req); got.Host != "10.0.0.7" {
		t.Errorf("maddr wins: %+v", got)
	}
}

func TestResponseHop(t *testing.T) {
	res := mustParse(t, `
SIP/2.0 200 OK
Via: SIP/2.0/UDP host.example:5070;branch=z9hG4bK-1;received=10.0.0.2;rport=40000
Call-ID: c1
CSeq: 1 INVITE
Content-Length: 0

`).(*sip.Response)
	if got, _ := ResponseHop(res); got != (Hop{"10.0.0.2", 40000, "UDP"}) {
		t.Errorf("received and rport: %+v", got)
	}
	res.Via().Params.Remove("rport")
	res.Via().Params.Remove("received")
	if got, _ := ResponseHop(res); got != (Hop{"host.example", 5070, "UDP"}) {
		t.Errorf("the sent-by: %+v", got)
	}
}

func TestMarkReceived(t *testing.T) {
	cases := []struct {
		transport, via, want string
	}{
		{"UDP", "SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-1;rport", "rport=40000;received=10.0.0.2"},
		{"UDP", "SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-1", ""},
		{"UDP", "SIP/2.0/UDP pbx.local:5070;branch=z9hG4bK-1", "received=10.0.0.2"},
		// over a connection JAIN-SIP sets rport even when not asked for
		{"TCP", "SIP/2.0/TCP 10.0.0.2:5070;branch=z9hG4bK-1", "rport=40000"},
		// what the sender wrote in received and rport is dropped: a forged
		// received naming a trusted peer would otherwise survive when the
		// sent-by host equals the source and no rport was asked for
		{"UDP", "SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-1;received=10.0.0.5", ""},
		{"UDP", "SIP/2.0/UDP pbx.local:5070;branch=z9hG4bK-1;received=10.0.0.5", "received=10.0.0.2"},
		{"UDP", "SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-1;received=10.0.0.5;rport=1", "rport=40000;received=10.0.0.2"},
		{"TCP", "SIP/2.0/TCP 10.0.0.2:5070;branch=z9hG4bK-1;rport=1;received=10.0.0.5", "rport=40000"},
	}
	for _, c := range cases {
		req := mustParse(t, "\nOPTIONS sip:a@b SIP/2.0\nVia: "+c.via+"\nCall-ID: x\nCSeq: 1 OPTIONS\nContent-Length: 0\n\n").(*sip.Request)
		req.SetSource("10.0.0.2:40000")
		req.SetTransport(c.transport)
		markReceived(req)
		got := req.Via().Value()
		for _, p := range strings.Split(c.want, ";") {
			if p != "" && !strings.Contains(got, p) {
				t.Errorf("%s: want %s in %s", c.via, p, got)
			}
		}
		if c.want == "" && strings.Contains(got, "received") {
			t.Errorf("%s: no received expected: %s", c.via, got)
		}
		if !strings.Contains(c.want, "rport") && strings.Contains(got, "rport") {
			t.Errorf("%s: no rport expected: %s", c.via, got)
		}
		if strings.Contains(got, "10.0.0.5") || req.Via().Params.GetOr("rport", "") == "1" {
			t.Errorf("%s: the sender's received or rport survived: %s", c.via, got)
		}
	}
}

func TestDigestAuthorization(t *testing.T) {
	// RFC 2617 section 3.5
	challenge := `Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"`
	creds := &Credentials{Username: "Mufasa", Password: "Circle Of Life"}
	got, err := DigestAuthorization(challenge, creds, "GET", "/dir/index.html", nil, "0a4f113b")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{`response="6629fae49393a05397450978507c4ef1"`, `qop=auth`, `nc=00000001`,
		`cnonce="0a4f113b"`, `opaque="5ccc069c403ebaf9f0171e9517f40e41"`, `username="Mufasa"`} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %s in %s", want, got)
		}
	}
	if _, err := DigestAuthorization(`Basic realm="x"`, creds, "GET", "/", nil, ""); err == nil {
		t.Error("only Digest is answered")
	}
	noQop, _ := DigestAuthorization(`Digest realm="provider", nonce="d6b6b6b6", algorithm=MD5`, creds, "INVITE", "sip:x", nil, "")
	if strings.Contains(noQop, "cnonce") || !strings.Contains(noQop, "algorithm=MD5") {
		t.Errorf("no qop, no cnonce; the algorithm echoed: %s", noQop)
	}
}

func TestSupportedChallenges(t *testing.T) {
	sha := `Digest realm="r", nonce="1", algorithm=SHA-256`
	md5 := `Digest realm="r", nonce="2", algorithm=MD5`
	if got := SupportedChallenges([]string{sha, md5}); len(got) != 1 || got[0] != md5 {
		t.Errorf("drops what can't be answered: %v", got)
	}
	if got := SupportedChallenges([]string{sha}); len(got) != 1 {
		t.Errorf("keeps everything when nothing can be answered: %v", got)
	}
}

func TestCredentialsFromHeaders(t *testing.T) {
	value := base64.StdEncoding.EncodeToString([]byte("user:secret"))
	creds, err := CredentialsFromHeaders([]sip.Header{sip.NewHeader("X-Gateway-Auth", value)}, "sip.provider.net")
	if err != nil || creds == nil || creds.Username != "user" || creds.Password != "secret" || creds.Host != "sip.provider.net" {
		t.Errorf("%+v %v", creds, err)
	}
	if creds, err := CredentialsFromHeaders(nil, "h"); creds != nil || err != nil {
		t.Error("no header, no credentials")
	}
	bad := base64.StdEncoding.EncodeToString([]byte("nocolon"))
	if _, err := CredentialsFromHeaders([]sip.Header{sip.NewHeader("x-gateway-auth", bad)}, "h"); err == nil {
		t.Error("a value that is not user:password fails")
	}
}

func TestNewCancelCopiesTheInvite(t *testing.T) {
	req := mustParse(t, invite).(*sip.Request)
	cancel := NewCancel(req)
	if cancel.Method != sip.CANCEL || cancel.CSeq().SeqNo != 4 || cancel.CSeq().MethodName != sip.CANCEL {
		t.Errorf("CSeq: %v", cancel.CSeq())
	}
	if cancel.Via().Value() != req.Via().Value() || cancel.GetHeader("Route") == nil {
		t.Errorf("same top Via and Route set:\n%s", cancel)
	}
	if cancel.GetHeader("Contact") != nil || cancel.GetHeader("Record-Route") != nil {
		t.Errorf("no Contact, no Record-Route:\n%s", cancel)
	}
}

func TestRestoreIdentity(t *testing.T) {
	req := mustParse(t, invite).(*sip.Request)
	res := mustParse(t, `
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.0.0.1;branch=z9hG4bK-2
From: <sip:+15551234@trunk>;tag=other
To: <sip:+15559999@trunk>;tag=callee
Call-ID: c1
CSeq: 5 INVITE
Content-Length: 0

`).(*sip.Response)
	headers := RestoreIdentity(res.Headers(), req)
	headers = ReplaceCSeq(headers, req.CSeq())
	out := rebuildResponse(res, res.Reason, headers, nil)
	if out.From().Value() != req.From().Value() {
		t.Errorf("From: %s", out.From().Value())
	}
	if tag, _ := out.To().Params.Get("tag"); tag != "callee" || out.To().Address.User != "1002" {
		t.Errorf("To: %s", out.To().Value())
	}
	if out.CSeq().SeqNo != 4 {
		t.Errorf("CSeq: %v", out.CSeq())
	}
}

func TestTransactionManagerDialogs(t *testing.T) {
	m := NewTransactionManager()
	m.RecordDialog("c1")
	m.RecordAuthenticated("c1")
	m.RecordAuthenticated("c1")
	m.RecordOriginalCSeq("c1", sip.BYE, 7)
	if !m.HasDialog("c1") || m.CSeqOffset("c1") != 2 {
		t.Fatal("dialog state recorded")
	}
	if seq, ok := m.OriginalCSeq("c1", sip.BYE); !ok || seq != 7 {
		t.Fatal("original CSeq recorded")
	}
	m.RemoveDialog("c1")
	if m.HasDialog("c1") || m.CSeqOffset("c1") != 0 {
		t.Error("dialog state released")
	}
	if _, ok := m.OriginalCSeq("c1", sip.BYE); ok {
		t.Error("original CSeq released")
	}
}

func TestTransactionManagerCancelMemory(t *testing.T) {
	m := NewTransactionManager()
	now := time.Unix(1000, 0)
	m.now = func() time.Time { return now }
	m.MarkCancelled("c1")
	if !m.IsCancelled("c1") {
		t.Error("cancel remembered")
	}
	now = now.Add(cancelMemory + time.Millisecond)
	if m.IsCancelled("c1") {
		t.Error("cancel forgotten after 64*T1")
	}
}

func TestTransactionManagerPairs(t *testing.T) {
	m := NewTransactionManager()
	client, retry, server := &sip.ClientTx{}, &sip.ClientTx{}, &sip.ServerTx{}
	m.PutTransactions("c1", client, server)
	if m.ServerTransactionFor(client) != server || m.ClientTransaction("c1") != client {
		t.Fatal("paired")
	}
	m.UpdateClientTransaction("c1", client, retry)
	if m.ServerTransactionFor(retry) != server || m.ServerTransactionFor(client) != nil {
		t.Error("an authentication retry takes over the pairing")
	}
	m.RemoveClientTransaction("c1", client)
	if m.ClientTransaction("c1") != retry {
		t.Error("a terminated transaction only releases the slots it still holds")
	}
	m.RemoveServerTransaction("c1", server)
	if m.ServerTransactionFor(retry) != nil || m.ServerTransaction("c1") != nil {
		t.Error("server released")
	}
}

func TestCallQueueOrdersEachCall(t *testing.T) {
	q := NewCallQueue(nil)
	var mu sync.Mutex
	got := map[string][]int{}
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		for _, call := range []string{"a", "b"} {
			wg.Add(1)
			i, call := i, call
			q.Run(call, func() {
				defer wg.Done()
				mu.Lock()
				got[call] = append(got[call], i)
				mu.Unlock()
			})
		}
	}
	wg.Wait()
	for _, call := range []string{"a", "b"} {
		for i, v := range got[call] {
			if v != i {
				t.Fatalf("call %s ran out of order: %v", call, got[call])
			}
		}
	}
	q.Run("a", func() { panic("boom") })
	done := make(chan struct{})
	q.Run("a", func() { close(done) })
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("a panic stops the call's queue")
	}
}

func TestAttachHeadersKeepsSingletons(t *testing.T) {
	existing := []sip.Header{sip.NewHeader("Server", "a"), sip.NewHeader("Allow", "INVITE")}
	add := []sip.Header{sip.NewHeader("Server", "b"), sip.NewHeader("Allow", "BYE"), sip.NewHeader("X-New", "1")}
	out := AttachHeaders(existing, add)
	var names []string
	for _, h := range out {
		names = append(names, h.Name()+":"+h.Value())
	}
	if strings.Join(names, ",") != "Server:a,Allow:INVITE,Allow:BYE,X-New:1" {
		t.Errorf("%v", names)
	}
}

func TestHangupCause(t *testing.T) {
	if HangupCause(487) != "NORMAL_CLEARING" || HangupCause(603) != "CALL_REJECTED" || HangupCause(999) != "UNKNOWN" {
		t.Error("io.routr.HangupCauses")
	}
}
