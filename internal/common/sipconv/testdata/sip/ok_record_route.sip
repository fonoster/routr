SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.111.220.2:5060;branch=z9hG4bK1a2b3c;rport=5060
Via: SIP/2.0/UDP 10.111.221.22:7060;branch=z9hG4bK-1-0;rport=7060;received=10.111.221.22
Record-Route: <sip:10.111.220.2:5060;transport=udp;lr>;r2=on
Record-Route: <sip:10.111.221.2:5060;transport=udp;lr>;r2=on
From: "John Doe" <sip:1001@sip.local>;tag=1
To: <sip:17853178070@sip.provider.net;user=phone>;tag=99
Call-ID: 1-1@10.111.221.22
CSeq: 1 INVITE
Contact: <sip:sipp@10.111.220.22:7060;transport=UDP>
Allow: INVITE, ACK, BYE
X-Carrier: one
Server: SIP Gateway
Content-Type: application/sdp
Content-Length: 129

v=0
o=user1 53655765 2353687637 IN IP4 10.111.220.22
s=-
c=IN IP4 10.111.220.22
t=0 0
m=audio 6000 RTP/AVP 0
a=rtpmap:0 PCMU/8000
