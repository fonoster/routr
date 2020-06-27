This document is a short guide about running the dockerized version of Routr Server.

## Run Environment

Run environment variables are used in the entry point script to render configuration templates. You can specify the values of these variables during `docker run`, `docker-compose up`, or in Kubernetes manifests in the env array.

| Variable | Description | Required |
| --- | --- | --- |
| EXTERN_ADDR | IP address to advertise  | Yes |
| LOCALNETS | Local networks. Use in combination with EXTERN_ADDR | No |
| REGISTRAR_INTF | `Internal` causes the server to use the IP and port it "sees"(received & rport) from a device attempting to register. Defaults to `External` | No |
| DATA_SOURCE_PROVIDER | Defines data provider. Defaults to `files_data_provider` | No |
| DATA_SOURCE_PARAMETERS | Provider specific parameters. For examples, see the [general config](https://routr.io/docs/configuration/general/)  | No |
| CONFIG_FILE | Path to the configuration file. Defaults to `config/config.yml` | No |
| SALT | Use defined JWT salt. By default Routr will generated its own  | No |
| JAVA_OPTS | Use this env variable to pass parameters to the JVM | No |

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
    -e EXTERN_ADDR=${your host address} \
    fonoster/routr
```

### Running with docker-compose

**Pull the images**

`docker-compose pull`

**To run:**

`docker-compose up --abort-on-container-exit`

**Destroying the container**

`docker-compose down`
