## Running Routr in Kubernetes

To quickly deploy a Routr instance in K8s, simply create the following resources:

```bash
kubectl create -f configmaps.yml \
kubectl create -f clusterrole.yml \
kubectl create -f redis.yml \
kubectl create -f routr.yml \
kubectl create clusterrolebinding service-reader-pod \
  --clusterrole=service-reader  \
  --serviceaccount=default:default
```
