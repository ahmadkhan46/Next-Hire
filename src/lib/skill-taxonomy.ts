// Skill synonyms and normalization
export const SKILL_SYNONYMS: Record<string, string[]> = {
  // Frontend
  'React': ['React.js', 'ReactJS', 'React JS'],
  'Vue': ['Vue.js', 'VueJS', 'Vue JS'],
  'Angular': ['AngularJS', 'Angular.js'],
  'Next.js': ['NextJS', 'Next'],
  'TypeScript': ['TS'],
  'JavaScript': ['JS', 'ECMAScript', 'ES6', 'ES2015'],
  
  // Backend
  'Node.js': ['NodeJS', 'Node'],
  'Express': ['Express.js', 'ExpressJS'],
  'Django': ['Django Framework'],
  'Flask': ['Flask Framework'],
  'Spring': ['Spring Boot', 'Spring Framework'],
  'ASP.NET': ['ASP.NET Core', '.NET', 'DotNet'],
  
  // Databases
  'PostgreSQL': ['Postgres', 'psql'],
  'MySQL': ['My SQL'],
  'MongoDB': ['Mongo'],
  'Redis': ['Redis Cache'],
  'Elasticsearch': ['Elastic Search', 'ES'],
  
  // Cloud
  'AWS': ['Amazon Web Services'],
  'Azure': ['Microsoft Azure'],
  'GCP': ['Google Cloud Platform', 'Google Cloud'],
  'Docker': ['Docker Container'],
  'Kubernetes': ['K8s', 'K8'],
  
  // Languages
  'Python': ['Py'],
  'Java': ['JDK', 'JVM'],
  'C#': ['CSharp', 'C Sharp'],
  'C++': ['CPP', 'C Plus Plus'],
  'Go': ['Golang'],
  'Rust': ['Rust Lang'],
  
  // Tools
  'Git': ['GitHub', 'GitLab', 'Version Control'],
  'Jira': ['Atlassian Jira'],
  'Figma': ['Figma Design'],
};

// Reverse mapping for normalization
const NORMALIZED_SKILLS = new Map<string, string>();
Object.entries(SKILL_SYNONYMS).forEach(([canonical, synonyms]) => {
  NORMALIZED_SKILLS.set(canonical.toLowerCase(), canonical);
  synonyms.forEach(syn => {
    NORMALIZED_SKILLS.set(syn.toLowerCase(), canonical);
  });
});

// Normalize skill name
export function normalizeSkill(skill: string): string {
  const normalized = NORMALIZED_SKILLS.get(skill.toLowerCase());
  return normalized || skill;
}

// Check if two skills are equivalent
export function areSkillsEquivalent(skill1: string, skill2: string): boolean {
  return normalizeSkill(skill1) === normalizeSkill(skill2);
}

// Get all synonyms for a skill
export function getSkillSynonyms(skill: string): string[] {
  const normalized = normalizeSkill(skill);
  return SKILL_SYNONYMS[normalized] || [];
}

// Skill categories
export const SKILL_CATEGORIES = {
  'Frontend': ['React', 'Vue', 'Angular', 'Next.js', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Tailwind', 'Bootstrap'],
  'Backend': ['Node.js', 'Express', 'Django', 'Flask', 'Spring', 'ASP.NET', 'Laravel', 'Rails'],
  'Languages': ['JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Ruby'],
  'Databases': ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DynamoDB', 'Elasticsearch'],
  'Cloud & DevOps': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'GitHub Actions'],
  'Mobile': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS', 'Android'],
  'AI/ML': ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Keras', 'OpenAI', 'LangChain', 'Hugging Face'],
  'Tools': ['Git', 'Figma', 'Jira', 'Slack', 'Notion', 'Linear', 'Postman', 'VS Code'],
};

// Get category for a skill
export function getSkillCategory(skill: string): string | null {
  const normalized = normalizeSkill(skill);
  
  for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
    if (skills.some(s => normalizeSkill(s) === normalized)) {
      return category;
    }
  }
  
  return null;
}

// Fuzzy match skills (Levenshtein distance)
export function fuzzyMatchSkill(input: string, threshold: number = 0.8): string | null {
  const inputLower = input.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    const allVariants = [canonical, ...synonyms];
    
    for (const variant of allVariants) {
      const score = similarity(inputLower, variant.toLowerCase());
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = canonical;
      }
    }
  }

  return bestMatch;
}

// String similarity (Dice coefficient)
function similarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }

  const bigrams2 = new Set<string>();
  for (let i = 0; i < s2.length - 1; i++) {
    bigrams2.add(s2.substring(i, i + 2));
  }

  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  return (2 * intersection.size) / (bigrams1.size + bigrams2.size);
}
