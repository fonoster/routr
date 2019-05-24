This document is a short guide about running the dockerized version of Routr Server on Kubernetes

## Run in Kubernetes

To run Routr in Kubernetes you must set your ROUTR_EXTERN_ADDR in `k8s/routr.yml`.

> This variable must be set to the public address(if running locally use your host address)

Additionally you must create the following Kubernetes resources:

```bash
kubectl create -f k8s/configmaps.yml
kubectl create -f k8s/redis.yml
kubectl create -f k8s/routr.yml
```
