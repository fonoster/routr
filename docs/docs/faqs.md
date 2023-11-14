# FAQs

## What is Routr?

Routr is a lightweight SIP proxy, location server, registrar, and foundational element for your SIP infrastructure. Due to its modular design, you can enhance Routr's capabilities by integrating custom modules, which we call Processors and Middlewares. Our primary objective is to help you incorporate real-time communication into your application or service.

## What dependencies does Routr have?

The Core of Routr has no external dependencies, although you might need Redis in certain situations. For example, if you need to scale the Location service horizontally, use Redis as a shared cache.

In Connect Mode, Routr relies on PostgreSQL and Redis. However, you can orchestrate both dependencies using Docker Compose or Kubernetes.

## How does Routr compare with other SIP servers

Routr is similar to Kamalio and OpenSIPS because it is a programmable SIP server. However, Routr architecture is different. In Routr, we use a microservice architecture, meaning each component is a separate service. This design allows you to scale each service independently. 

For example, adding more service instances can scale the Location service horizontally. This design also allows you to replace any component with your implementation. For example, you can implement your security Middleware and replace the default one.

## Is Routr a Media Server?

Routr is not a media server. By itself, Routr does not handle media. However, you can use Routr as a frontend for FreeSWITCH or Asterisk. 

> This is useful when you need load balancing

## Which language is the team using to build Routr?

The EdgePort, which processes SIP messages, is written in Java. We implement the rest of the services using NodeJS.

## What license does Routr use?

We release Routr under the [MIT license](https://github.com/fonoster/routr/blob/main/LICENSE).