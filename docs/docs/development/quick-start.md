# Quick Start

Before starting the development, you need to install the following tools:

- NodeJS (>=16.14)
- JDK (>=11)

For NodeJS, we recommend using [nvm](https://github.com/nvm-sh/nvm) to manage your NodeJS versions.

## Clone and Build the Project

To get started, first, clone the repository:

```bash
git clone https://github.com/fonoster/routr
```

The previous command will create a directory called `routr` with the project's source code. 

Next, set the JAVA_HOME environment variable to the location of your JDK installation:

```bash
export JAVA_HOME=/path/to/jdk
```

Finally, build the project:

```bash
cd routr
npm run make
```

The previous command will install all the dependencies and build the project. If everything goes well, you should see no errors.

## Run the Project

To run all the components, you can use the following command:

```bash
npm run start
```

<!--Show an example of the output -->

The previous command will start the EdgePort, Location Service, MessageDispatcher, Connect Processor, Requester, APIServer (simpledata), and Registry. 

As you change the source code, Nodemon will automatically restart the components except for the EdgePort and Requester, which are written in Java and require a manual build and restart.

You also have the option to run each component individually. For example, if your use case only requires the EdgePort and the Location Service, you can run the following command:

In one terminal:

```bash
npm run start:edgeport
```

Example output:

```bash
> start:edgeport
> cross-env NODE_ENV=dev LOGS_LEVEL=verbose ./mods/edgeport/edgeport.sh

2023-09-22 12:40:48.454 [info]: (edgeport) GRPCSipListener.java starting edgeport ref = edgeport-01 at 0.0.0.0
2023-09-22 12:40:48.455 [info]: (edgeport) GRPCSipListener.java localnets list [127.0.0.1/8,10.111.221.2/24]
2023-09-22 12:40:48.456 [info]: (edgeport) GRPCSipListener.java external hosts list [10.111.220.2,sip01.edgeport.net]
2023-09-22 12:40:48.578 [info]: (edgeport) HealthCheck.java starting health check on port 8080 and endpoint /healthz
```

In a separate terminal:

```bash
npm run start:location
```

Example output:

```bash
> start:location
> cross-env NODE_ENV=dev LOGS_LEVEL=verbose CONFIG_PATH=$(pwd)/config/location.yaml nodemon mods/location/src/runner

[nodemon] 2.0.20
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): mods/**/*
[nodemon] watching extensions: ts
[nodemon] starting `ts-node mods/location/src/runner.ts`
2023-09-05 12:41:38.735 [info]: (location) using memory as cache provider {}
2023-09-05 12:41:38.739 [info]: (common) starting routr service {"name":"location","bindAddr":"0.0.0.0:51902"}
```

Please see the `scripts` section of [package.json](https://github.com/fonoster/routr/blob/main/package.json) for a complete list of available commands.