# Routr 1.0RC3 - User Location Lookup Performance Tests

Author:
  Pedro Sanders

<ol type="1">
    <li>Overview</li>
    <li>User Location Performance Tests</li>
    <ol type="1">
        <li>New registrations</li>
        <li>Update registrations</li>
        <li>User location lookup</li>      
    </ol>
    <li>Conclusions</li>
    <li>Notes</li>
    <li>References</li>            
</ol>

## Overview
### Scope

These tests were intended to show the performances of the User Location implementation in Routr 1.0RC3.
These can be useful to help you better dimension your Routr installation. For these test the login module
was deactivated. The network configuration used during the test is depicted in the following image:

### Software

As load generator (UAC side) it was used [SIPp docker](URL) image.

All used SIP-related software was configured to use TCP as the transport protocol for SIP.

### Platform

Description of the elements used:

Equipment #1 - [Processor], [Memory] with [Operating system] testing.
Equipment #2 - [Processor], [Memory] with [Operating system] testing.
Equipment #x - [Processor], [Memory] with [Operating system] testing.

## Performance Tests

Routr running without any special

SIPp was used to generate [# of interaction] MESSAGE requests via Routr.
The results reflect the capacity [General or sub topic] and speed (average response time).

Flow
SIP entities definition:

UAC - [UAC]:5070
UAS - [UAS]:5070
Proxy - [PROXY_IP]:5060

SIP messages flow for one complete transaction:

```
UAC ---> MESSAGE ---> Routr ---> MESSAGE ---> UAS
UAC <--- 200 OK <---  Routr <--- 200 OK <---  UAS
```

Configuration
SIPP command:

```bash
[Used SIPp command config ]
```

**Results**

Results reported by SIPp on the UAC servers:

| Factor | Value | Note  |
|---|---|---|
| Iterations | 200000 |   |
| Max concurrent requests | 70  |  |
| Max allowed Rate  | 10000 | requests per second  |
| Average Request Rate  | 8047.966   | requests per second  |
| Failures  | 0 |   |
| Retransmissions | 0 |   |
| Timeout  | 0 |   |
| Elapsed Time  | 00:00:24:851  | 00:00:24:851   |

<br/>
<img src="/docs/assets/images/[DUT Performance Summary]" >
<br/>
<br/>

Routr config file:

```yaml
[Whatever config applies]
```

[Graphical results]

3. Conclusions
4. Notes
5. References
