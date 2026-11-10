-- AlterTable
ALTER TABLE "trunks" ADD COLUMN     "enforce_e164" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rewrite_from_with_number" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "from_domain" VARCHAR(255);
