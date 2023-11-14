# Deploy with Docker

Deploying Routr with Docker is the easiest way to get started. This guide will walk you through the process of deploying Routr with Docker.

You will need Docker and Docker Compose installed on your machine as a prerequisite. If you don't have them installed, you can follow the instructions [here.](https://docs.docker.com/get-docker/)

> Connect Mode is the most common way to deploy Routr. It is our implementation of the SIPConnect standard. The Connect Mode describes SIP routing regarding Agents, Peers, Trunks, Numbers, and ACL. More on this later.

## Deploying Routr

First, create a directory named "routr". Navigate into the new folder, and then copy the content below:

Filename: docker-compose.yml

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
      - shared:/var/lib/postgresql/data

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

You should see something like this:

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

Here is an example of creating an SIP Domain:

```bash
rctl domains create --insecure
```

> The --insecure flag is required as we did not set up the TLS settings.

For additional examples, refer to the command-line [documentation](https://www.npmjs.com/package/@routr/ctl).
