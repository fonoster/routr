# WebRTC Support

The Connect Processor supports interoperability with WebRTC clients. This means that you can use any SIP client that also supports WebRTC to make and receive calls, such as with the JavaScript libraries SIP.js and JsSIP for example. However, because WebRTC mandates the use of specific codecs, transport protocols, and a certain version of RTP that might differ from those used by legacy SIP clients, you will need to make additional configuration changes to your server.

Let’s say you want to use SIP.js to make and receive calls. In that case, you will need to add a RTPRelay component to your setup. The RTPRelay component is a Routr middleware that takes control of an RTPengine instance for media relay between WebRTC and legacy SIP clients.

Note that this is only needed if you are using a mix of WebRTC and legacy SIP clients. If you are exclusively using WebRTC clients, then you can skip this step.

To enable WebRTC interoperability, you will need to update your docker-compose.yml file to include the `RTPENGINE_HOST` environment variable. Here is an example:

```yaml
version: "3"

services:

  routr:
    image: fonoster/routr-one:latest
    environment:
      EXTERNAL_ADDRS: ${DOCKER_HOST_ADDRESS}
      RTPENGINE_HOST: ${RTPE_HOST} 
    ports:
      - 51908:51908
      - 5060:5060/udp

-- snip --
```

If using Helm, you will need to add the following configuration to your `values.yaml` file:

```yaml
rtprelay:
  enabled: true
  rtpeHost: /* rtpengine */ 
  rtpPort: 22222
```

Keep in mind that this configuration will only work if you have an instance of RTPengine running somewhere.