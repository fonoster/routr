SIP/2.0 407 Proxy Authentication Required
Via: SIP/2.0/UDP 10.111.220.2:5060;branch=z9hG4bKccc;rport=5060
From: <sip:1001@sip.local>;tag=p1
To: <sip:+12225553000@sip.provider.net>;tag=gw
Call-ID: pa-1
CSeq: 2 INVITE
Proxy-Authenticate: Digest realm="provider", nonce="n1", algorithm=SHA-256
Proxy-Authenticate: Digest realm="provider", nonce="n2", algorithm=MD5
Content-Length: 0

