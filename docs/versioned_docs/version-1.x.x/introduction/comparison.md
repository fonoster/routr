# Comparison

A  question we always get is how Routr compares to other software such as Asterisk, FreeSWITCH, or Kamailio. For a fair comparison, we separate this into two basic categories: SIP Servers and PBX.

## Routr vs Asterisk/FreeSWITCH?

Asterisk and FreeSWITCH fall into the PBX category. Their role is to provide media capabilities such as IVR, Voicemail,  Conferencing, Recording, and even video. Both Asterisk and FreeSWITCH are very good at what they do, each with their strengths and weaknesses.

Routr is not a PBX and does not pretend to solve the same issue. Routr focuses on the SIP Server role.

## Routr vs Kamailio/OpenSER?

Typically, large VoIP networks and Unified Communication platforms include SIP servers of some sort. The perform the following functions:

* Proxy, Registrar, Location, Forking, Redirect
* Load Balancing
* Session Border Controller
* Gateway to the PSTN

Routr attempts to solve the same core problems as Kamailio/OpenSER but with a different approach.

## So what is the problem with Kamailio/OpenSER?

Kamailio is an impressive piece of software but is not ready-to-use like Asterisk or FreeSWITCH. To get it to work, you have to understand SIP and write some code.

## What can we do to make it better?

Our vision for a Next-generation SIP Server can be summarized as follows:

* Make Routr Cloud-Native (After all it is 2019)
* It does not require any coding / Most use-cases are configurable
* Offer the tooling and APIs for easy extensibility
* Great documentation

If you want to support the initiative, please [join the discussion](https://routr.io/docs/community).
