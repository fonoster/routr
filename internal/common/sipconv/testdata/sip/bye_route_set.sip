BYE sip:sipp@10.111.220.22:7060;transport=UDP SIP/2.0
Via: SIP/2.0/UDP 10.111.220.22:7060;branch=z9hG4bK-2-7;rport=7060
Via: SIP/2.0/UDP 10.0.0.9:5060;branch=z9hG4bKold;received=10.0.0.9
Route: <sip:10.111.220.2:5060;transport=udp;lr>;r2=on, <sip:10.111.221.2:5060;transport=udp;lr;ftag=x>;r2=on
Route: <sip:edge.example.com;lr>
Max-Forwards: 69
f: <sip:+17853178070@sip.provider.net>;tag=b1;foo=bar
t: "Agent One" <sip:1001@sip.local>;tag=a1
i: 2-1@10.111.220.22
CSeq: 2 BYE
k: path
Content-Length: 0

