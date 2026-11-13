-- How a Trunk's carrier wants numbers written on calls leaving through it.
-- NULL keeps today's behavior, so existing Trunks route as before.
CREATE TYPE "number_format" AS ENUM ('E164', 'E164_WITHOUT_PLUS', 'NATIONAL');

ALTER TABLE "trunks" ADD COLUMN "called_number_format" "number_format",
ADD COLUMN "called_number_prefix" VARCHAR(20),
ADD COLUMN "caller_number_format" "number_format",
ADD COLUMN "caller_number_prefix" VARCHAR(20);
