# Architecture

![Routr's architecture diagram](/img/architecture_v2.png)

# Summary

Routr takes a radically different approach to SIP servers. Instead of using a monolithic architecture, Routr comprises a set of loosely coupled services that communicate with each other using gRPC. This approach allows Routr to be easily extended, customized, and scaled.

# Specification

With Routr v2, we introduced a set of specifications describing each service's behavior. The specifications are the following:

- [Core Specification](https://github.com/fonoster/routr/blob/master/docs/specs/CORE.md)
- [Connect Specification](https://github.com/fonoster/routr/blob/master/docs/specs/CONNECT.md)

The Core specification describes the core components and their behavior. It explains how to transform SIP messages into protocol buffers and how to handle SIP routing.

The Connect specification describes how Routr implements the SIP Connect specification. It explains how to handle SIP routing for Agents, Peers, Trunks, Numbers, ACL, and more.

Most users will not need to read the specifications. However, if you want to extend Routr's functionality, we recommend you read them.
