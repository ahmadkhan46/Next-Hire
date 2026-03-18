# Candidate Management Guide

## Overview

The platform provides comprehensive candidate management with multi-step creation, bulk import, resume parsing, and duplicate detection.

## Creating Candidates

### Multi-Step Form

The platform uses a 5-step creation flow:

1. **Personal Info** - Name, email, phone, DOB, location, title, experience
2. **Experience** - Work history with company, role, dates, description
3. **Education** - Schools, degrees, years
4. **Skills** - Technology categories with items
5. **Projects** - Portfolio projects with descriptions

**Key Features**:
- Progress bar shows completion
- Skip or Next buttons for each step
- Add multiple items per step
- Delete items before finishing
- All data saved in single transaction at finish
- Auto-generates fingerprint for duplicate detection

### Single API Call

Create candidate with all data at once:

```typescript
POST /api/orgs/{orgId}/candidates
{
  fullName: "John Doe",
  email: "john@example.com",
  experiences: [...],
  educations: [...],
  projects: [...],
  technologies: [...]
}
```

## Editing Candidates

### Tabbed Interface

Edit mode provides 5 tabs:
- **Personal** - Basic info, social links, status
- **Experience** - Add/edit work history
- **Education** - Add/edit education
- **Projects** - Add/edit projects
- **Tech** - Add/edit technology categories

Each tab has forms to add new items and displays existing items with edit/delete actions.

## Deleting Candidates

Delete button with confirmation dialog. Requires `candidates:delete` permission. Cascades to all related data (experiences, educations, projects, technologies, resumes, matches).

## Bulk Import

### CSV Templates

**Basic Template** (6 columns):
- fullName, email, phone, dateOfBirth, externalId, skills

**Full Template** (16 columns):
- All personal fields + linkedinUrl, githubUrl, portfolioUrl, status, source, notes, skills, resumeText

### Import Process

1. Upload CSV file
2. System validates each row
3. Duplicate detection (3-layer matching)
4. Optional resume parsing with LLM
5. Auto-matching to open jobs
6. Progress tracking in real-time

### Duplicate Detection

3-layer identity system:

1. **externalId** - User-provided ID (e.g., ATS ID)
2. **email** - Email address
3. **fingerprint** - SHA-256 hash of firstName + lastName + (email OR phone) + DOB

**Matching Logic**:
```
IF externalId exists → Update existing
ELSE IF email exists → Update existing
ELSE IF fingerprint exists → Update existing
ELSE → Create new
```

## Resume Parsing

### Upload & Parse

1. Upload PDF/DOCX resume
2. Click "Parse Resume" button
3. LLM extracts:
   - Personal info
   - Work experience
   - Education
   - Projects
   - Skills

### Name Validation

Parser compares extracted name with candidate name:
- Calculates similarity score
- If < 50% match → Blocks parsing
- Sets status to NEEDS_REVIEW
- Shows error message

**Example**:
```
Candidate: "John Doe"
Resume: "Jane Smith"
Similarity: 20%
Result: ❌ Blocked
```

## Candidate Status

Available statuses:
- **ACTIVE** - Available for matching
- **INACTIVE** - Not available
- **HIRED** - Successfully hired
- **REJECTED** - Not suitable
- **NEEDS_REVIEW** - Requires attention

## Candidate Source

Track where candidates come from:
- **MANUAL** - Created via UI
- **IMPORT** - CSV bulk import
- **REFERRAL** - Employee referral
- **LINKEDIN** - LinkedIn sourcing
- **INDEED** - Indeed sourcing
- **OTHER** - Other sources

## Search & Filters

Coming soon:
- Full-text search by name, email, skills
- Filter by status, source, location
- Filter by years of experience
- Filter by skills
- Saved search queries

## Best Practices

### Data Quality

- Always provide email or phone for duplicate detection
- Include dateOfBirth for accurate fingerprinting
- Use externalId for ATS integration
- Keep status updated

### Resume Parsing

- Upload clean, well-formatted resumes
- Verify extracted data after parsing
- Cost: ~$0.001-0.003 per resume
- Review NEEDS_REVIEW candidates

### Bulk Import

- Use full template for complete profiles
- Include resumeText for auto-parsing
- Max 100 candidates per import
- Monitor progress in UI

### Organization

- Use consistent naming conventions
- Tag candidates with source
- Add notes for context
- Update status regularly

## Permissions

| Action | Permission Required |
|--------|-------------------|
| View candidates | `candidates:read` |
| Create/edit candidates | `candidates:write` |
| Delete candidates | `candidates:delete` |
| Bulk import | `candidates:write` |
| Parse resumes | `candidates:write` |

## API Endpoints

```
GET    /api/orgs/{orgId}/candidates
POST   /api/orgs/{orgId}/candidates
GET    /api/orgs/{orgId}/candidates/{id}
PATCH  /api/orgs/{orgId}/candidates/{id}
DELETE /api/orgs/{orgId}/candidates/{id}

POST   /api/orgs/{orgId}/candidates/import
POST   /api/orgs/{orgId}/candidates/{id}/experience
POST   /api/orgs/{orgId}/candidates/{id}/education
POST   /api/orgs/{orgId}/candidates/{id}/projects
POST   /api/orgs/{orgId}/candidates/{id}/technologies
POST   /api/orgs/{orgId}/candidates/{id}/resumes
POST   /api/orgs/{orgId}/candidates/{id}/resumes/{resumeId}/parse
```

## Troubleshooting

### Duplicate Not Detected

- Check if email matches exactly
- Verify dateOfBirth format (ISO 8601)
- Ensure name spelling is consistent

### Resume Parsing Failed

- Check file format (PDF/DOCX only)
- Verify file size < 10MB
- Ensure resume has clear structure
- Check OpenAI API key is valid

### Name Mismatch Error

- Verify candidate name is correct
- Check resume has correct name
- Similarity threshold is 50%
- Update candidate name if needed

### Import Stuck

- Check worker is running
- Verify database connection
- Check OpenAI rate limits
- Review error logs
