# Introduction

Developers and implementors looking to customize Routr for their specific use cases should refer to this section. Here, you'll learn about the core components, their interactions, and the steps to create custom Processors and Middleware.

Additionally, we'll cover how to use tools such as Docker, Docker Compose, Helm, and Kubernetes for orchestrating the components. You'll also discover how to extend the APIServer for your needs and build plugins for the Command-line Tool.

## How to read this section

The concepts in this section build on top of each other. Therefore, we recommend reading the information sequence. However, if you are already familiar with the concepts, you can jump to the page that interests you the most.

## Tooling and dependencies

The only requirements to build and run Routr are Java and NodeJS. However, we recommend considering the following tools to make the development process easier:

- [Docker](https://www.docker.com/): We use Docker to build and run individual components
- [Docker Compose](https://docs.docker.com/compose/): We use Docker Compose to orchestrate the components
- [Helm](https://helm.sh/): Helm helps us to deploy Routr in Kubernetes
- [Kubernetes](https://kubernetes.io/): Kubernetes is the platform where we deploy Routr for large scale deployments
- [Kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/): Kubectl is the command-line tool for Kubernetes
- [sngrep](https://github.com/irontec/sngrep): A tool for monitoring SIP traffic (You could use Wireshark as well)
- [grpcurl](https://github.com/fullstorydev/grpcurl): A command-line tool for interacting with gRPC servers

If you don't have a Kubernetes cluster, you can use [Minikube](https://kubernetes.io/docs/tasks/tools/install-minikube/) or Docker Desktop with Kubernetes enabled.