# NAT Issues

1. I encounter several issues while testing Sip I/O in my home network. This issues are very common, and can all be solve by properly configure the sip device indicating a STUN, ICE, or TURN.

2. If running Sip I/O inside docker in a local network don't use STUN in the client.

3. Sip I/O is unable to properly setup a call when running behind a NAT 
and registered to a Gateway/ with a public IP. By enabling 'SIP ALG' I was 
able to partially setup the call, but the originating device cant reach the local
device because this does not have a public address. Further research needed.