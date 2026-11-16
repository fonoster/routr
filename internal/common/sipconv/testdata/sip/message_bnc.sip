MESSAGE sips:echo@10.0.0.1:5061 SIP/2.0
Via: SIP/2.0/TLS 10.0.0.2:5061;branch=z9hG4bKmsg;rport=50000;received=10.0.0.2;ttl=5;maddr=10.0.0.2
Max-Forwards: 70
From: <sips:perfkit@10.0.0.2:5061>;tag=7
To: <sips:echo@10.0.0.1:5061>
Contact: "Trunk" <sip:pbx@10.0.0.2;bnc;transport=tls>
Call-ID: msg-1
CSeq: 1 MESSAGE
Refer-To: <sip:1002@sip.local>
Referred-By: <sip:17853178070@sip.provider.net>
Event: refer
Subject: hello, world
X-Multi: a, b
X-Multi: c
Content-Type: text/plain;charset=utf-8
Content-Length: 9

perfkit 7