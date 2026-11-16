-- Other identifiers a Trunk sends for a Number, such as a carrier label.
-- Existing Numbers end with no aliases and route as before.
ALTER TABLE "numbers" ADD COLUMN "aliases" VARCHAR(60)[] NOT NULL DEFAULT '{}';
