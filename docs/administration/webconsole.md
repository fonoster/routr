The Web Console — WC for short — is an additional tool for remote control of Routr server that ships with the Command-Line tool.  The Web Console accesses your Routr server remotely using a Restful API.

<img src="/docs/assets/images/routr_animation.gif"/>

## How to install the Web Console?

The WC ships with the Command-Line tool. You do not need to install it separately.

## Launching the Web Console

To launch the WC, first, make sure you have a Routr server running. You are also going to have to install the Command-Line tool.   To launch the server run the following command:

```bash
rctl proxy
```

> The WC re-uses the credentials of your Command-Line Tool

## Does the WC affect the server's performance?

No. The WC is launched on the client side. It is not part of the Routr server and does not affect its performance.
