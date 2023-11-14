# Glossary

This following table features some essential concepts, including the different routing types implemented by the server.

### User  

Users perform administrative actions on the server.             

### Agent  

Agents represent SIP endpoints such as softphones and IP phones, or paging speakers.

### Domain  

Enables the creation of isolated groups of Agents

### Peer

Similar to Agents but without Domain boundaries

### Gateway

IP entity that allows call termination

### Number

Routes and translate calls between the PSTN and Routr

### Intra-Domain Routing (IDR)

Routing strategy for signaling within the same Domain

### Domain Ingress Routing (DIR)

Routing strategy used when an Agent or Peer must go outside the Domain using
a Gateway

### Domain Egress Routing (DER)

Calling from an Agent to the PSTN thru a Gateway

### Peer Egress Routing (PER)

Similar to *DER* but applies only to Peers.
