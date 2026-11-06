REGISTER sip:sip.local SIP/2.0
Via: SIP/2.0/TCP 10.111.221.22:7060;branch=z9hG4bK-3-1;received=10.111.221.22;rport=40122
Max-Forwards: 70
From: <sip:1001@sip.local>;tag=3
To: <sip:1001@sip.local>
Contact: <sip:1001@10.111.221.22:7060;transport=tcp;ob>;expires=600;q=0.5;+sip.instance="<urn:uuid:00000000-0000-1000-8000-AABBCCDDEEFF>"
Call-ID: 3-1@10.111.221.22
CSeq: 2 REGISTER
Expires: 3600
Authorization: Digest username="1001",realm="sip.local",nonce="abc",uri="sip:sip.local",response="d41d8cd98f00b204e9800998ecf8427e",algorithm=MD5,cnonce="0a4f113b",qop=auth,nc=00000001
User-Agent: SIPp
Content-Length: 0

