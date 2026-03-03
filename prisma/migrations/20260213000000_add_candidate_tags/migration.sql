-- CreateTable
CREATE TABLE "CandidateTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CandidateTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CandidateTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "CandidateTag_orgId_idx" ON "CandidateTag"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateTag_orgId_name_key" ON "CandidateTag"("orgId", "name");

-- CreateIndex
CREATE INDEX "_CandidateTags_B_index" ON "_CandidateTags"("B");

-- AddForeignKey
ALTER TABLE "CandidateTag" ADD CONSTRAINT "CandidateTag_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CandidateTags" ADD CONSTRAINT "_CandidateTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CandidateTags" ADD CONSTRAINT "_CandidateTags_B_fkey" FOREIGN KEY ("B") REFERENCES "CandidateTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
