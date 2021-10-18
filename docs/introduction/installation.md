## Instant Server Installation with Snaps

Install Routr in seconds on Linux (Ubuntu and others) with:

```bash
sudo snap install routr-server
```

[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/routr-server)

Routr Snap is recommended for Linux deployments

Installing snaps is very quick. By running that command you have your full Routr server up and running. Snaps are secure. They are isolated with all of their dependencies. Snaps also auto-update when we release new versions.

## DigitalOcean droplet

Build and Deploy to a DigitalOcean droplet

[![do-btn-blue](https://user-images.githubusercontent.com/51996/58146107-50512580-7c1a-11e9-8ec9-e032ba387c2a.png)](https://github.com/fonoster/routr/tree/master/.digitalocean/README.md)

## Docker
[Deploy with docker compose](https://routr.io/docs/guides/running-with-docker-or-compose/)

[![Docker logo](https://d207aa93qlcgug.cloudfront.net/1.95.5.qa/img/nav/docker-logo-loggedout.png)](https://hub.docker.com/r/fonoster/routr/)

OR Use the automated build image of our [most recent release](https://hub.docker.com/r/fonoster/routr/)

```
docker pull fonoster/routr:latest
```

OR select a specific release ([details of releases available](https://github.com/fonoster/routr/releases)):
```
docker pull fonoster/routr:vX.X.X
```

## Kubernetes

Deploy to Kubernetes in [few easy steps](https://github.com/fonoster/routr/tree/master/.k8s/README.md)

## Google Cloud Shell

Routr one-click interactive tutorial will get you familiar with Routr server and the command-line interface.

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/fonoster/routr-walkthrough-tutorial&tutorial=tutorial.md)

## Custom

There are no special requirements to install and run the server. Just follow this easy steps:

&#10122; Download the server for your platform

| Platform | Download |
| -- | -- |
| Linux | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc6/routr-1.0.0-rc6_linux-x64_bin.tar.gz) |  
| macOS | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc6/routr-1.0.0-rc6_osx-x64_bin.tar.gz) |  
| Windows | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc6/routr-1.0.0-rc6_windows-x64_bin.tar.gz), [zip](https://github.com/fonoster/routr/releases/download/1.0.0-rc6/routr-1.0.0-rc6_windows-x64_bin.zip) |  

&#10123; Then extract it:

```bash
tar xvfz routr-*.tar.gz
cd routr-*
```

&#10124; Run the server using the `routr` command

```bash
./routr
```
