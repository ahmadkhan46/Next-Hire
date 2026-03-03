import { prisma } from './prisma';

// Levenshtein distance for string similarity
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

// Calculate similarity score (0-1)
function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
}

export interface DuplicateCandidate {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  matchScore: number;
  matchReasons: string[];
}

export async function findDuplicateCandidates(
  candidate: {
    fullName: string;
    email?: string;
    phone?: string;
  },
  orgId: string,
  threshold: number = 0.85
): Promise<DuplicateCandidate[]> {
  const duplicates: DuplicateCandidate[] = [];

  // Exact email match
  if (candidate.email) {
    const emailMatches = await prisma.candidate.findMany({
      where: {
        orgId,
        email: candidate.email,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
    });

    duplicates.push(
      ...emailMatches.map(c => ({
        ...c,
        matchScore: 1.0,
        matchReasons: ['Exact email match'],
      }))
    );
  }

  // Exact phone match
  if (candidate.phone) {
    const normalizedPhone = normalizePhone(candidate.phone);
    const phoneMatches = await prisma.candidate.findMany({
      where: {
        orgId,
        phone: {
          not: null,
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
    });

    for (const match of phoneMatches) {
      if (match.phone && normalizePhone(match.phone) === normalizedPhone) {
        if (!duplicates.find(d => d.id === match.id)) {
          duplicates.push({
            ...match,
            matchScore: 1.0,
            matchReasons: ['Exact phone match'],
          });
        }
      }
    }
  }

  // Fuzzy name match
  const allCandidates = await prisma.candidate.findMany({
    where: { orgId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
    take: 1000, // Limit for performance
  });

  for (const existing of allCandidates) {
    if (duplicates.find(d => d.id === existing.id)) continue;

    const nameScore = similarityScore(candidate.fullName, existing.fullName);

    if (nameScore >= threshold) {
      const reasons: string[] = [`Name similarity: ${(nameScore * 100).toFixed(0)}%`];

      // Boost score if email domain matches
      if (candidate.email && existing.email) {
        const candidateDomain = candidate.email.split('@')[1];
        const existingDomain = existing.email.split('@')[1];
        if (candidateDomain === existingDomain) {
          reasons.push('Same email domain');
        }
      }

      duplicates.push({
        ...existing,
        matchScore: nameScore,
        matchReasons: reasons,
      });
    }
  }

  return duplicates.sort((a, b) => b.matchScore - a.matchScore);
}

// Normalize phone number for comparison
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10); // Last 10 digits
}

// Check if candidate is duplicate before import
export async function isDuplicate(
  candidate: {
    fullName: string;
    email?: string;
    phone?: string;
  },
  orgId: string
): Promise<{ isDuplicate: boolean; matches: DuplicateCandidate[] }> {
  const matches = await findDuplicateCandidates(candidate, orgId, 0.9);

  return {
    isDuplicate: matches.length > 0,
    matches,
  };
}
