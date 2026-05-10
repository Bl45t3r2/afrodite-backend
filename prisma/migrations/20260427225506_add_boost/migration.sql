-- CreateEnum
CREATE TYPE "BoostPlan" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateTable
CREATE TABLE "Boost" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "plan" "BoostPlan" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boost_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Boost" ADD CONSTRAINT "Boost_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
