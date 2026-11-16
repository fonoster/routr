NOTIFY sip:1001@10.111.221.22:7060;transport=udp SIP/2.0
Via: SIP/2.0/UDP 10.111.221.2:5060;branch=z9hG4bK1;rport, SIP/2.0/UDP 10.111.220.22:7060;branch=z9hG4bK2;received=10.111.220.22;rport=7060
Record-Route: <sip:10.111.221.2:5060;lr>, <sip:10.111.220.2:5060;lr>
Max-Forwards: 69
From: <sip:+17853178070@sip.provider.net>;tag=n1;flag
To: <sip:1001@sip.local>;tag=n2
Contact: <sip:a@10.111.220.22:7060>;expires=10, <sip:b@10.111.220.22:7061>
Call-ID: notify-1
CSeq: 3 NOTIFY
Event: refer;id=2
Subscription-State: active;expires=60
x-lower: v
X-Lower: w
Require: 100rel
Proxy-Require: gin
Accept: application/sdp, application/isup
Content-Type: message/sipfrag;version=2.0
Content-Length: 15

SIP/2.0 200 OK
