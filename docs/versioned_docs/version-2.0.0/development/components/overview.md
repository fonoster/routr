# Overview

```text
┌────────────┐┌────────────┐                           
│EdgePort 001││EdgePort 002│                           
└┬───────────┘└┬───────────┘                           
┌▽─────────────▽───────────────────────┐               
│Message Dispatcher                    │               
└┬────────────────┬───────────────────┬┘               
┌▽──────────────┐┌▽─────────────────┐┌▽───────────────┐
│IM Processor   ││Connect Processor ││Twilio Processor│
└┬──────────────┘└──────────────────┘└────────────────┘
┌▽────────────────────────────┐                        
│Data APIs & External Services│                        
└─────────────────────────────┘                        
```

This is the components sub-section of the development section. Here you will find information about the different components that make up the platform. Each component will have its own page with information about how to run it, how to configure it, and how to use it.

Also, within a component page, you will find information about available ports, protobuf contracts, environmenent variables, volumes, docker images, and more.
