---
sidebar_position: 2
---

# Installing in Kubernetes

Routr can be installed in Kubernetes using Helm. The following instructions assume that you have a Kubernetes cluster up and running. 

> You can use Minikube or Docker Desktop to create a local Kubernetes cluster.

First, add the Helm repository:

```bash
helm repo add routr https://routr.io/charts
helm repo update
```

Then, create a namespace for Routr:

```bash
kubectl create namespace sipnet
```

Next, install Routr with the following command:

```bash
helm install sipnet routr/routr-connect --namespace sipnet
```

Finally, wait a few minutes for the pods to start. You can check the status of the pods with the following command:

```bash
kubectl get pods -n sipnet
```

You should see a list of pods and their status. If the status is Running, then you are ready to go.

For more details, please refer to the chart's [README](https://github.com/fonoster/routr/blob/main/ops/charts/connect/README.md).

Please see the [Command-Line Tools](../command-line/overview.md) section for detauls on how to interact with Routr Connect via the CLI.