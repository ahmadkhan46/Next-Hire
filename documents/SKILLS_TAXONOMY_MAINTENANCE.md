# Skills Taxonomy Maintenance Guide

## Overview

The skills taxonomy is maintained in `src/lib/skills-taxonomy.ts` and contains 400+ predefined skills across 16 categories.

## How It Works

1. **Known skills** → Automatically categorized based on taxonomy
2. **Unknown skills** → Automatically placed in "Other" category
3. **Partial matches** → "React.js" matches "React", "Node" matches "Node.js"

## Adding New Skills

### Option 1: Edit the taxonomy file directly

Open `src/lib/skills-taxonomy.ts` and add skills to the appropriate category:

```typescript
export const SKILLS_TAXONOMY = {
  'Programming Languages': [
    'JavaScript', 'TypeScript', 'Python',
    'Zig', // ← Add new skill here
  ],
  // ...
}
```

### Option 2: Create a new category

```typescript
export const SKILLS_TAXONOMY = {
  // ... existing categories
  
  'Blockchain': [ // ← New category
    'Solidity', 'Web3', 'Ethereum', 'Smart Contracts',
    'Cryptocurrency', 'NFT', 'DeFi', 'Bitcoin'
  ],
}
```

## Monitoring Unknown Skills

To find skills that need categorization:

1. Go to candidate detail page
2. Check "Other" category
3. If you see skills that should be categorized, add them to taxonomy

## Common Additions

### New Programming Languages
Add to `Programming Languages` category

### New Frameworks
- Frontend framework → `Frontend`
- Backend framework → `Backend`
- Mobile framework → `Mobile`

### New Cloud Services
Add to `Cloud & DevOps` category

### New AI/ML Tools
Add to `Data & AI` category

## Best Practices

1. **Use official names**: "React" not "ReactJS"
2. **Include variations**: Add both "Node.js" and "Node"
3. **Keep alphabetical**: Makes it easier to find duplicates
4. **Be specific**: "Spring Boot" and "Spring" are different
5. **Update regularly**: Review "Other" category monthly

## Bulk Import

If you have a list of skills to add, you can:

1. Get skills from "Other" category
2. Categorize them manually
3. Add to taxonomy in bulk
4. Refresh all matches to recategorize

## No Database Changes Needed

The taxonomy is code-based, so:
- ✅ No database migrations required
- ✅ No data migration needed
- ✅ Changes take effect immediately
- ✅ Easy to version control
- ✅ Can be updated without downtime

## Future Enhancement Ideas

1. **Admin UI**: Build interface to manage taxonomy
2. **AI Categorization**: Use LLM to suggest categories for unknown skills
3. **Skill Synonyms**: Map "JS" → "JavaScript", "K8s" → "Kubernetes"
4. **Skill Levels**: Add proficiency levels (Beginner, Intermediate, Expert)
5. **Industry-Specific**: Create different taxonomies for different industries
