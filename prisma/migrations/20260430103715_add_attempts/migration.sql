/*
  Warnings:

  - Added the required column `submittedAnswer` to the `attempts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `attempts` ADD COLUMN `submittedAnswer` VARCHAR(255) NOT NULL;
