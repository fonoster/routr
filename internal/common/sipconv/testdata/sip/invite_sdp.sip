INVITE sip:17853178070@sip.provider.net;user=phone SIP/2.0
Via: SIP/2.0/UDP 10.111.221.22:7060;branch=z9hG4bK-1-0;rport=7060;received=10.111.221.22
Max-Forwards: 70
From: "John Doe" <sip:1001@sip.local>;tag=1
To: <sip:17853178070@sip.provider.net;user=phone>
Contact: <sip:sipp@10.111.221.22:7060;transport=UDP>
Call-ID: 1-1@10.111.221.22
CSeq: 1 INVITE
Allow: INVITE, ACK, BYE, CANCEL, OPTIONS
Supported: timer, replaces, path
P-Asserted-Identity: <sip:+18295863314@sip.provider.net;user=phone>
Privacy: id;header
X-Correlation-Id: abc-123
User-Agent: SIPp
Content-Type: application/sdp
Content-Length: 129

v=0
o=user1 53655765 2353687637 IN IP4 10.111.221.22
s=-
c=IN IP4 10.111.221.22
t=0 0
m=audio 6000 RTP/AVP 0
a=rtpmap:0 PCMU/8000
