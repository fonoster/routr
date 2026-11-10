/*
  Warnings:

  - Added the required column `expires` to the `agents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires` to the `peers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "expires" INTEGER NOT NULL,
ADD COLUMN     "max_contacts" INTEGER NOT NULL DEFAULT -1;

-- AlterTable
ALTER TABLE "peers" ADD COLUMN     "expires" INTEGER NOT NULL,
ADD COLUMN     "max_contacts" INTEGER NOT NULL DEFAULT -1;
