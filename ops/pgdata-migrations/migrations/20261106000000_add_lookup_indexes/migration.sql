-- Connect reads the egress policies of a Domain and finds Peers by aor on
-- every call it routes; both lookups scanned their tables
CREATE INDEX "egress_policies_domain_ref_idx" ON "egress_policies"("domain_ref");
CREATE INDEX "peers_aor_idx" ON "peers"("aor");
