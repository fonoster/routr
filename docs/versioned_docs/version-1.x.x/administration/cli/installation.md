---
title: Installation
---
To get the Routr Command-Line Tool run the following command:

```bash
npm install -g routr-ctl
```

The command-line tool is now globally accessible.

Alternatively, you can install the tool in seconds on Linux (Ubuntu and others) with:

```bash
sudo snap install rctl
```

## Login to a Routr server

To log in to a Routr server and being issuing commands run the following commands.

```bash
rctl login https://127.0.0.1:4567/api/{apiVersion} -u admin -p changeit
```

> The current API version is v1beta1
