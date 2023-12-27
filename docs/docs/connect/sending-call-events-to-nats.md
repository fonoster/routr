# Sending Call Events to NATS

Routr ships with a NATS publisher that can be used to send call events to a NATS server. Call events are a function of the EdgePort. To enable the NATS publisher, you will need to update your EdgePort service to set the environment variable `NATS_PUBLISHER_ENABLED` to `true` as well as the environment variable `NATS_PUBLISHER_URL` to the URL of your NATS server. For example:

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

Once you have enabled the NATS publisher, you can subscribe to the routr.call.started or routr.call.ended subjects to receive call events.
As of the writing of this book, only the routr.call.started and routr.call.ended subjects are supported. However, we plan to add more subjects in the future. Be sure to check in later to see if any more have been added.

To begin receiving call events, you can use the nats sub command line tool. To do this, first connect to your NATS server by running the following command:

```bash
nats context add nats \
  --server demo.nats.io:4222 \
  --description "nats events" \
  --select
```

You should then see something like this:
  
![NATS context add](/img/nats-context-add-nats.png)

In the previous command, we connected to the `demo.nats.io` server, which is a public NATS server. You can use your own NATS server if you have one.

Then, you can subscribe to the `routr.call.started` subject by running the following command:

```bash
nats sub routr.call.started
```

The `routr.call.started` event contains the following fields:

- `callId`: The unique identifier of the call
- `from`: The caller's phone number
- `to`: The callee's phone number
- `startTime`: The time the call started formatted as an ISO 8601 string
- `extraHeaders`: Any extra headers that were sent with the call 

Every header startarting with `X-` is considered an extra header. For example, if you send a call with the following headers:

```bash
X-My-Header: my-value
X-Another-Header: another-value
```

Then, the `extraHeaders` field will contain the following:

```json
{
  "X-My-Header": "my-value",
  "X-Another-Header": "another-value"
}
```

After subscribing to the subject and making a call, you should see something like this:

![NATS call started](/img/nats-sub-routr-call-started.png)

Similarly, you can subscribe to the routr.call.ended subject to receive call-ended events. 

```bash
nats sub routr.call.ended
```

The `routr.call.ended` event contains the following fields:

- `callId`: The unique identifier of the call
- `endTime`: The time the call ended formatted as an ISO 8601 string
- `hangupCause`: The reason the call ended
- `extraHeaders`: Any extra headers that were sent with the call

> Please see the [HangupCause.java](https://github.com/fonoster/routr/blob/main/mods/edgeport/src/main/java/io/routr/HangupCauses.java) class for a list of possible hangup causes.

Lastly, you can subscribe to the `routr.endpoint.registered` subject to receive endpoint registered events. 

```bash
nats sub routr.endpoint.registered
```

The `routr.endpoint.registered` event contains the following fields:

- `aor`: The address of record of the endpoint
- `registeredAt`: The time the endpoint registered formatted as an ISO 8601 string
- `expires`: The time in seconds the endpoint will remain registered
- `extraHeaders`: Any extra headers that were sent with the call

You can use the `NATS_PUBLISHER_SUBJECT` environment variable to change the based subject name. For example, you can set it to `myserver` to receive call events in the `myserver.calls.started` subject.
