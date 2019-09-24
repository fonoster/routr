This document is a short guide about running the dockerized version of Routr Server.

## Run Environment

Run environment variables are used in the entry point script to render configuration templates. You can specify the values of these variables during `docker run`, `docker-compose up`, or in Kubernetes manifests in the env array.

| Variable | Description | Required |
| --- | --- | --- |
| ROUTR_EXTERN_ADDR | IP address to advertise  | Yes |
| ROUTR_LOCALNETS | Local networks. Use in combination with ROUTR_EXTERN_ADDR | No |
| ROUTR_REGISTRAR_INTF | `Internal` causes the server to use the IP and port it "sees"(received & rport) from a device attempting to register. Defaults to `External` | No |
| ROUTR_DS_PROVIDER | Defines data provider. Defaults to `files_data_provider` | No |
| ROUTR_DS_PARAMETERS | Provider specific parameters. For examples, see the [general config](https://routr.io/docs/configuration/general/)  | No |
| ROUTR_CONFIG_FILE | Path to the configuration file. Defaults to `config/config.yml` | No |
| ROUTR_SALT | Use defined JWT salt. By default Routr will generated its own  | No |
| ROUTR_JS_ENGINE | Setup the Javascript engine. Available options are `nashorn` and `graal.js`. Defaults to `graal.js` | No |
| ROUTR_JAVA_OPTS | Use this env variable to pass parameters to the JVM | No |

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
