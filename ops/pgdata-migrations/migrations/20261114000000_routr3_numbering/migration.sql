-- Routr 3 numbering: Trunks may ask for numbers in international form, and
-- Connect reads a Trunk's Numbers to match the inbound called number.
ALTER TYPE "number_format" ADD VALUE 'INTERNATIONAL';

CREATE INDEX "numbers_trunk_ref_idx" ON "numbers"("trunk_ref");
