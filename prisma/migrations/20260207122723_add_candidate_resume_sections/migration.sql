-- CreateTable
CREATE TABLE "CandidateExperience" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "startMonth" TIMESTAMP(3) NOT NULL,
    "endMonth" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "bullets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProject" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dates" TEXT,
    "techStack" TEXT,
    "link" TEXT,
    "bullets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateTechnology" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "items" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateTechnology_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateExperience_candidateId_idx" ON "CandidateExperience"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateProject_candidateId_idx" ON "CandidateProject"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateTechnology_candidateId_idx" ON "CandidateTechnology"("candidateId");

-- AddForeignKey
ALTER TABLE "CandidateExperience" ADD CONSTRAINT "CandidateExperience_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProject" ADD CONSTRAINT "CandidateProject_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateTechnology" ADD CONSTRAINT "CandidateTechnology_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
