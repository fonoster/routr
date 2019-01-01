This is a short guide about running the dockerized version of Routr Server.

## Run Environment

Run environment variables are used in the entry point script to render configuration templates. The values of these variables can be specified during docker run, or in Kubernetes manifests in the env array.

- ROUTR_JAVA_OPTS
- ROUTR_EXTERN_ADDR
- ROUTR_LOCALNETS
- ROUTR_REGISTRAR_INTF
- ROUTR_DS_PROVIDER
- ROUTR_DS_PARAMETERS
- ROUTR_CONFIG_FILE
- ROUTR_SALT

## Usage

### Running with docker (pre-built)

**Pull the images**

`docker pull fonoster/routr`

**To run:**

```bash
docker run -it \
    -p 4567:4567 \
    -p 5060:5060 \
    -p 5060:5060/udp \
    -p 5061-5063:5061-5063 \
    -e ROUTR_EXTERN_ADDR=${your host address} \
    fonoster/routr
```

### Running with docker-compose

**Pull the images**

`docker-compose pull`

**To run:**

`docker-compose up --abort-on-container-exit`

**Destroying the container**

`docker-compose down`
