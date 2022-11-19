# You can find the new timestamped tags here: https://hub.docker.com/r/gitpod/workspace-full/tags
FROM gitpod/workspace-full:2022-11-15-17-00-18

# Copy etc/host.txt to /tmp/host.txt
COPY etc/hosts.txt /tmp/host.txt

# Install custom tools, runtime, etc.
RUN sudo npm install -g hostile && \
    sudo hostile load /tmp/host.txt