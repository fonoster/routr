-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "trace_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "peers" ADD COLUMN     "trace_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "domains" ADD COLUMN     "trace_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "trunks" ADD COLUMN     "trace_enabled" BOOLEAN NOT NULL DEFAULT false;
