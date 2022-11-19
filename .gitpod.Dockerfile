# You can find the new timestamped tags here: https://hub.docker.com/r/gitpod/workspace-full/tags
FROM gitpod/workspace-full:2022-11-15-17-00-18

# Copy etc/host.txt to /tmp/host.txt
COPY etc/hosts.txt /tmp/host.txt

# Install custom tools, runtime, etc.
RUN sudo install-packages dnsmasq

# /etc/hosts values
RUN sudo echo 'address="/simpledata/127.0.0.1"' >> /etc/dnsmasq.d/0hosts
RUN sudo echo 'address="/requester/127.0.0.1"' >> /etc/dnsmasq.d/0hosts
RUN sudo echo 'address="/echo/127.0.0.1"' >> /etc/dnsmasq.d/0hosts

# dnsmasq configuration
RUN sudo echo 'listen-address=127.0.0.1' >> /etc/dnsmasq.conf
RUN sudo echo 'resolv-file=/etc/resolv.dnsmasq.conf' >> /etc/dnsmasq.conf
RUN sudo echo 'conf-dir=/etc/dnsmasq.d' >> /etc/dnsmasq.conf