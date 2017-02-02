mkfifo /root/sip
while true; do ngrep SIP -i host 10.1.1.2 > /root/sipfifo; done;
socat stdio tcp4-listen:55061,crnl < /root/sipfifo
