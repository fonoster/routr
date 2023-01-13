-- CreateEnum
CREATE TYPE "Privacy" AS ENUM ('NONE', 'ID');

-- CreateEnum
CREATE TYPE "api_version" AS ENUM ('v2draft1', 'v2');

-- CreateEnum
CREATE TYPE "Transport" AS ENUM ('UDP', 'TCP', 'SCTP', 'TLS', 'WS', 'WSS');

-- CreateEnum
CREATE TYPE "LoadBalancingAlgorithm" AS ENUM ('ROUND-ROBIN', 'LEAST-SESSIONS');

-- CreateTable
CREATE TABLE "agents" (
    "api_version" "api_version" NOT NULL,
    "ref" TEXT NOT NULL,
    "domain_ref" TEXT,
    "credentials_ref" TEXT,
    "name" VARCHAR(60) NOT NULL,
    "username" VARCHAR(60) NOT NULL,
    "privacy" "Privacy" NOT NULL DEFAULT 'NONE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "extended" JSONB,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "peers" (
    "api_version" "api_version" NOT NULL,
    "ref" TEXT NOT NULL,
    "credentials_ref" TEXT,
    "acl_ref" TEXT,
    "name" VARCHAR(60) NOT NULL,
    "username" VARCHAR(60) NOT NULL,
    "aor" VARCHAR(255) NOT NULL,
    "contact_addr" VARCHAR(255),
    "balancing_algorithm" "LoadBalancingAlgorithm",
    "with_session_affinity" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "extended" JSONB,

    CONSTRAINT "peers_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "domains" (
    "api_version" "api_version" NOT NULL,
    "ref" TEXT NOT NULL,
    "acl_ref" TEXT,
    "name" TEXT NOT NULL,
    "domain_uri" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "extended" JSONB,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "trunks" (
    "api_version" "api_version" NOT NULL,
    "ref" TEXT NOT NULL,
    "acl_ref" TEXT,
    "inbound_credentials_ref" TEXT,
    "outbound_credentials_ref" TEXT,
    "name" VARCHAR(60) NOT NULL,
    "send_register" BOOLEAN NOT NULL DEFAULT false,
    "inbound_uri" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "extended" JSONB,

    CONSTRAINT "trunks_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "numbers" (
    "api_version" "api_version" NOT NULL,
    "ref" TEXT NOT NULL,
    "trunk_ref" TEXT,
    "tel_url" VARCHAR(60) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "aor_link" TEXT,
    "city" VARCHAR(60) NOT NULL DEFAULT 'Unknown',
    "country" VARCHAR(60) NOT NULL,
    "country_iso_code" VARCHAR(2) NOT NULL,
    "session_affinity_header" VARCHAR(60),
    "extra_headers" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "extended" JSONB,

    CONSTRAINT "numbers_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "access_control_lists" (
    "api_version" "api_version" NOT NULL,
    "ref" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "allow" VARCHAR(60)[],
    "deny" VARCHAR(60)[],
    "extended" JSONB,

    CONSTRAINT "access_control_lists_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "credentials" (
    "api_version" "api_version" NOT NULL,
    "ref" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "username" VARCHAR(60) NOT NULL,
    "password" VARCHAR(60) NOT NULL,
    "extended" JSONB,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "egress_policies" (
    "ref" TEXT NOT NULL,
    "domain_ref" TEXT NOT NULL,
    "number_ref" TEXT NOT NULL,
    "rule" TEXT NOT NULL,

    CONSTRAINT "egress_policies_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "trunk_uris" (
    "ref" TEXT NOT NULL,
    "trunk_ref" TEXT NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "port" INTEGER NOT NULL,
    "transport" "Transport" NOT NULL,
    "user" TEXT,
    "weight" INTEGER,
    "priority" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "trunk_uris_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_username_key" ON "agents"("username");

-- CreateIndex
CREATE INDEX "agents_username_idx" ON "agents" USING HASH ("username");

-- CreateIndex
CREATE UNIQUE INDEX "peers_username_key" ON "peers"("username");

-- CreateIndex
CREATE INDEX "peers_username_idx" ON "peers" USING HASH ("username");

-- CreateIndex
CREATE UNIQUE INDEX "domains_domain_uri_key" ON "domains"("domain_uri");

-- CreateIndex
CREATE INDEX "domains_domain_uri_idx" ON "domains" USING HASH ("domain_uri");

-- CreateIndex
CREATE UNIQUE INDEX "trunks_inbound_uri_key" ON "trunks"("inbound_uri");

-- CreateIndex
CREATE INDEX "trunks_inbound_uri_idx" ON "trunks" USING HASH ("inbound_uri");

-- CreateIndex
CREATE UNIQUE INDEX "numbers_tel_url_key" ON "numbers"("tel_url");

-- CreateIndex
CREATE INDEX "numbers_tel_url_idx" ON "numbers" USING HASH ("tel_url");

-- CreateIndex
CREATE INDEX "credentials_username_idx" ON "credentials" USING HASH ("username");

-- CreateIndex
CREATE INDEX "trunk_uris_host_idx" ON "trunk_uris" USING HASH ("host");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_credentials_ref_fkey" FOREIGN KEY ("credentials_ref") REFERENCES "credentials"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_domain_ref_fkey" FOREIGN KEY ("domain_ref") REFERENCES "domains"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peers" ADD CONSTRAINT "peers_acl_ref_fkey" FOREIGN KEY ("acl_ref") REFERENCES "access_control_lists"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peers" ADD CONSTRAINT "peers_credentials_ref_fkey" FOREIGN KEY ("credentials_ref") REFERENCES "credentials"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_acl_ref_fkey" FOREIGN KEY ("acl_ref") REFERENCES "access_control_lists"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trunks" ADD CONSTRAINT "trunks_acl_ref_fkey" FOREIGN KEY ("acl_ref") REFERENCES "access_control_lists"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trunks" ADD CONSTRAINT "trunks_inbound_credentials_ref_fkey" FOREIGN KEY ("inbound_credentials_ref") REFERENCES "credentials"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trunks" ADD CONSTRAINT "trunks_outbound_credentials_ref_fkey" FOREIGN KEY ("outbound_credentials_ref") REFERENCES "credentials"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbers" ADD CONSTRAINT "numbers_trunk_ref_fkey" FOREIGN KEY ("trunk_ref") REFERENCES "trunks"("ref") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egress_policies" ADD CONSTRAINT "egress_policies_domain_ref_fkey" FOREIGN KEY ("domain_ref") REFERENCES "domains"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egress_policies" ADD CONSTRAINT "egress_policies_number_ref_fkey" FOREIGN KEY ("number_ref") REFERENCES "numbers"("ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trunk_uris" ADD CONSTRAINT "trunk_uris_trunk_ref_fkey" FOREIGN KEY ("trunk_ref") REFERENCES "trunks"("ref") ON DELETE CASCADE ON UPDATE CASCADE;
