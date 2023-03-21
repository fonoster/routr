# Build Routr V2 from Source

This document is a quick guide on how to build Routr V2 from its source.

## Requirements

- Node v16.14+
- JDK 12+

## Setup environment variable `JAVA_HOME`

Before building a running this project, you must set the environment variable `JAVA_HOME', and the variable must be
pointing to a JDK 12+.
## Building project with make
The NodeJS workflow (scripts) includes a command to build the entire project. Typically this is only needed the first
time you clone the project.
To build the project, run the following command:
```bash
git clone --branch v2 https://github.com/fonoster/routr
npm run make
```

## Full or partial start

You have the option to start individual or ALL the services. You start an individual service by running the
subcommand `start:${service}`. For example:

```bash
npm run start:edgeport
```

And to start ALL services, you run `npm start`