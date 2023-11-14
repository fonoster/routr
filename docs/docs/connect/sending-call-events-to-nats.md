# Sending Call Events to NATs

Routr ships with a NATs publisher that can be used to send call events to a NATs server. Call events are a function of the EdgePort. To enable the NATs publisher, you will need to update your EdgePort service to set the environment variable `NATS_PUBLISHER_ENABLED` to `true` as well as the environment variable `NATS_PUBLISHER_URL` to the URL of your NATs server. For example:

```yaml
version: "3"
services:
  routr:
    image: fonoster/routr-one:latest
    ports:
      - 51908:51908
      - 5060:5060/udp
    environment:
      - NATS_PUBLISHER_ENABLED=true
      - NATS_PUBLISHER_URL=nats:4222
```

Once you have enabled the NATs publisher, you can subscribe to the routr.call.started or routr.call.ended subjects to receive call events.
As of the writing of this book, only the routr.call.started and routr.call.ended subjects are supported. However, we plan to add more subjects in the future. Be sure to check in later to see if any more have been added.

To begin receiving call events, you can use the nats sub command line tool. To do this, first connect to your NATs server by running the following command:

```bash
nats context add nats \
  --server demo.nats.io:4222 \
  --description "nats events" \
  --select
```

You should then see something like this:
  
![NATs context add](/img/nats-context-add-nats.png)

In the previous command, we connected to the demo.nats.io server, which is a public NATs server. You can use your own NATs server if you have one.

Then, you can subscribe to the routr.call.started subject by running the following command:

```bash
nats sub routr.call.started
```

After subscribing to the subject and making a call, you should see something like this:

![NATs call started](/img/nats-sub-routr-call-started.png)

Similarly, you can subscribe to the routr.call.ended subject to receive call-ended events. This should produce an output like shown in the image below:

![NATs call ended](/img/nats-sub-routr-call-ended.png)

You can use the `NATS_PUBLISHER_SUBJECT` environment variable to change the based subject name. For example, you can set it to `myserver` to receive call events in the `myserver.calls.started` subject.