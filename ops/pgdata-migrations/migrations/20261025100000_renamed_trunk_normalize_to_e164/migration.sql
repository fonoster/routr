-- The Trunk setting was renamed from enforceE164: it normalizes numbers, it
-- does not block calls
ALTER TABLE "trunks" RENAME COLUMN "enforce_e164" TO "normalize_to_e164";
