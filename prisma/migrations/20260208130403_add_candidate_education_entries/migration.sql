-- CreateTable
CREATE TABLE "CandidateEducation" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "degree" TEXT,
    "location" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateEducation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateEducation_candidateId_idx" ON "CandidateEducation"("candidateId");

-- AddForeignKey
ALTER TABLE "CandidateEducation" ADD CONSTRAINT "CandidateEducation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
