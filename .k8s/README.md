This document is a short guide about running the dockerized version of Routr Server on Kubernetes.

## Run in Kubernetes

To run Routr in Kubernetes, you must set your ROUTR_EXTERN_ADDR in `routr.yml`.

> This variable must be set to the public address(if running Routr locally, use your host address)

Additionally, you must create the following Kubernetes resources:

```bash
kubectl create -f configmaps.yml
kubectl create -f redis.yml
kubectl create -f routr.yml
```
