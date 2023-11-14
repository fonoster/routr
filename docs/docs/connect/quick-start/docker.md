---
sidebar_position: 1
---

# Docker installation

First, create a directory named "routr". Navigate into the new folder, and then copy the content below:

Filename: _docker-compose.yml_

```yaml
version: "3"

services:

  routr:
    image: fonoster/routr-one:latest
    environment:
      EXTERNAL_ADDRS: ${DOCKER_HOST_ADDRESS}
    ports:
      - 51908:51908
      - 5060:5060/udp

volumes:
  shared:
```

Then, start the server with:

```bash
# Be sure to replace with your IP address
DOCKER_HOST_ADDRESS=192.168.1.3 docker-compose up
```

Wait a few seconds for the container to initialize. Afterward, you can verify the status of the container using:

```bash
docker ps -a --format 'table {{.ID}}\t{{.Image}}\t{{.Status}}'
```

You should see a containers with its status. Your output should look like the one below:

```bash
CONTAINER ID  IMAGE                                     STATUS
6c63fd573768  fonoster/routr-one:latest                 Up About a minute
```

If the status of your service is "Up," you are ready to go.

Finally, install the command-line tool and start building your SIP Network.

You can install the tool with npm as follows:

```bash
npm install --location=global @routr/ctl
```

And here is an example of creating a SIP Domain:

```bash
rctl domains create --insecure
```

> The --insecure flag is required as we did not set up the TLS settings.

For additional examples, refer to the command line [documentation.](https://www.npmjs.com/package/@routr/ctl)
