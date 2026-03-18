# CSV Import Guide

## Overview
Import candidates in bulk using CSV files. The platform supports two templates: Basic and Full.

## Templates

### Basic Template (Quick Import)
**File**: `templates/candidate-import-basic.csv`

**Columns** (6):
```csv
fullName,email,phone,dateOfBirth,externalId,skills
```

**Example**:
```csv
fullName,email,phone,dateOfBirth,externalId,skills
John Doe,john@example.com,555-1234,1990-01-15T00:00:00.000Z,EMP-001,"React,Node.js,Python"
Jane Smith,jane@example.com,555-5678,1992-03-20T00:00:00.000Z,EMP-002,"Java,Spring,AWS"
```

### Full Template (Complete Profile)
**File**: `templates/candidate-import-full.csv`

**Columns** (41):
```csv
fullName,email,phone,dateOfBirth,location,currentTitle,yearsOfExperience,externalId,
linkedinUrl,githubUrl,portfolioUrl,status,source,notes,skills,
educationSchool,educationDegree,educationYear,
experience1Company,experience1Role,experience1StartMonth,experience1EndMonth,experience1Location,experience1Bullets,
experience2Company,experience2Role,experience2StartMonth,experience2EndMonth,experience2Location,experience2Bullets,
project1Title,project1Dates,project1TechStack,project1Link,project1Bullets,
project2Title,project2Dates,project2TechStack,project2Link,project2Bullets,
resumeText
```

**Example**:
```csv
John Doe,john@example.com,555-1234,1990-01-15T00:00:00.000Z,San Francisco,Senior Developer,8,EMP-001,
https://linkedin.com/in/johndoe,https://github.com/johndoe,https://johndoe.com,ACTIVE,REFERRAL,
Great candidate,"React,Node.js,Python",
Stanford University,BS Computer Science,2012,
Google,Senior Software Engineer,2018-01-01,2024-01-01,Mountain View,"Led team | Built microservices",
Facebook,Software Engineer,2015-06-01,2017-12-01,Menlo Park,"Developed React components",
E-Commerce Platform,2023,"React,Node.js",https://github.com/johndoe/ecommerce,"Built full-stack platform",
AI Chatbot,2022,"Python,TensorFlow",https://github.com/johndoe/chatbot,"Trained NLP model",
```

## Field Descriptions

### Required Fields
- **fullName**: Candidate's full name (min 1, max 200 characters)
- **email OR phone**: At least one contact method required

### Basic Profile Fields
- **externalId**: Your system's ID (ATS, HR system, etc.)
- **dateOfBirth**: ISO 8601 format (`1990-01-15T00:00:00.000Z`)
- **location**: City, State, or Country
- **currentTitle**: Current job title
- **yearsOfExperience**: Number (0-100)
- **linkedinUrl**: Full LinkedIn profile URL
- **githubUrl**: Full GitHub profile URL
- **portfolioUrl**: Personal website URL
- **status**: `ACTIVE`, `ARCHIVED`, `BLACKLISTED`, `HIRED`, `WITHDRAWN`
- **source**: `MANUAL`, `IMPORT`, `REFERRAL`, `LINKEDIN`, `AGENCY`, `CAREER_SITE`, `JOB_BOARD`
- **notes**: Additional notes (max 5000 characters)
- **skills**: Comma-separated list in quotes (`"React,Node.js,Python"`)

### Education Fields (Legacy - Single Entry)
- **educationSchool**: University/College name
- **educationDegree**: Degree type (BS, MS, PhD, etc.)
- **educationYear**: Graduation year (YYYY)

### Experience Fields (Up to 2 entries)
- **experience1Company**: Company name
- **experience1Role**: Job title
- **experience1StartMonth**: Start date (YYYY-MM-DD)
- **experience1EndMonth**: End date (YYYY-MM-DD) or empty if current
- **experience1Location**: City, State
- **experience1Bullets**: Pipe-separated achievements (`"Led team | Built microservices | Improved performance"`)
- **experience2Company**, **experience2Role**, etc. (same format)

### Project Fields (Up to 2 entries)
- **project1Title**: Project name
- **project1Dates**: Date range (e.g., "2023" or "Jan 2023 - Mar 2023")
- **project1TechStack**: Comma-separated technologies (`"React,Node.js,PostgreSQL"`)
- **project1Link**: GitHub/demo URL
- **project1Bullets**: Pipe-separated descriptions (`"Built platform | Integrated payments | Deployed on AWS"`)
- **project2Title**, **project2Dates**, etc. (same format)

### Resume Text
- **resumeText**: Full resume text (max 50000 characters)

## Import Behavior

### Create vs Update
The system automatically detects duplicates using 3-layer matching:

1. **externalId match** → Updates existing candidate
2. **email match** → Updates existing candidate
3. **fingerprint match** (name+contact+DOB) → Updates existing candidate
4. **No match** → Creates new candidate

### Example: Update Existing Candidate
```csv
externalId,fullName,email,phone,currentTitle
EMP-001,John Doe,john@example.com,555-1234,Senior Engineer
```
If `EMP-001` exists → Updates title to "Senior Engineer"

### Example: Create New Candidate
```csv
fullName,email,phone
Alice Johnson,alice@example.com,555-9999
```
No match found → Creates new candidate

## Format Guidelines

### Skills Format
**Correct**:
```csv
"React,Node.js,Python,AWS"
```

**Incorrect**:
```csv
React,Node.js,Python,AWS  ❌ (breaks CSV parsing)
```

### Experience Bullets Format
**Correct**:
```csv
"Led team of 5 engineers | Built scalable microservices | Improved performance by 40%"
```

**Incorrect**:
```csv
Led team, Built microservices  ❌ (use pipe separator)
```

### Project Bullets Format
**Correct**:
```csv
"Built full-stack platform | Integrated Stripe payments | Deployed on AWS"
```

### Date Format
**Correct**:
```csv
1990-01-15T00:00:00.000Z
2018-01-01
```

**Also Accepted**:
```csv
1990-01-15
```

### URL Format
**Correct**:
```csv
https://linkedin.com/in/johndoe
https://github.com/johndoe
https://johndoe.com
```

**Incorrect**:
```csv
linkedin.com/in/johndoe  ❌ (missing https://)
```

## Status Values

- `ACTIVE` - Currently being considered (default)
- `ARCHIVED` - Not currently active
- `BLACKLISTED` - Do not contact
- `HIRED` - Successfully hired
- `WITHDRAWN` - Candidate withdrew

## Source Values

- `MANUAL` - Added via UI
- `IMPORT` - CSV/bulk import (default for imports)
- `REFERRAL` - Employee referral
- `LINKEDIN` - LinkedIn sourcing
- `AGENCY` - Recruiting agency
- `CAREER_SITE` - Applied via website
- `JOB_BOARD` - Indeed, Monster, etc.

## Import Limits

- **Max candidates per import**: 100
- **Max skills per candidate**: 50
- **Max experience entries**: 2 per import (use resumeText for more)
- **Max project entries**: 2 per import (use resumeText for more)
- **Max resume text**: 50,000 characters
- **Max notes**: 5,000 characters
- **Max bullets per experience/project**: Unlimited (pipe-separated)

## Resume Parsing

If you include `resumeText`, the system will:
1. Parse resume using AI (GPT-4o-mini)
2. Extract skills, experience, education, projects
3. Auto-populate candidate profile
4. Override any manually provided fields
5. Support unlimited experience/education/project entries

**Cost**: ~$0.001-0.003 per resume

## Import Process

1. Upload CSV file
2. System validates format
3. Job queued for processing
4. Background worker processes each candidate
5. Creates experience, education, project entries
6. Auto-matches to open jobs
7. Results available in UI

## Troubleshooting

### "Validation failed"
- Check date format (ISO 8601 or YYYY-MM-DD)
- Check URL format (must include https://)
- Check skills format (quoted, comma-separated)
- Check bullets format (pipe-separated)
- Check email format (valid email)

### "Duplicate candidates created"
- Ensure externalId is consistent across imports
- Include dateOfBirth for better fingerprint matching
- Use same email format (lowercase recommended)

### "Import stuck at 0%"
- Check server logs
- Ensure Redis/memory queue is running
- Check OpenAI API key if using resume parsing

### "Experience/Projects not showing"
- Check date format (YYYY-MM-DD)
- Check bullets format (pipe-separated, quoted)
- Ensure company/role/title fields are not empty

## Best Practices

✅ **Use externalId** for ATS integration  
✅ **Include dateOfBirth** for better duplicate detection  
✅ **Normalize emails** (lowercase)  
✅ **Test with 2-3 candidates** before bulk import  
✅ **Keep CSV under 100 candidates** per file  
✅ **Use resumeText** for automatic profile population with unlimited entries  
✅ **Use pipe separator** for bullets (`|`)  
✅ **Quote multi-value fields** (skills, bullets, tech stack)  

## Examples

### Minimal Import (Basic Template)
```csv
fullName,email,skills
John Doe,john@example.com,"React,Node.js"
```

### Complete Profile (Full Template)
```csv
fullName,email,phone,location,currentTitle,yearsOfExperience,skills,educationSchool,educationDegree,educationYear,experience1Company,experience1Role,experience1StartMonth,experience1EndMonth,experience1Bullets
John Doe,john@example.com,555-1234,San Francisco,Senior Developer,8,"React,Node.js,Python",Stanford,BS CS,2012,Google,Senior Engineer,2018-01-01,2024-01-01,"Led team | Built microservices"
```

### With Resume Text (Recommended)
```csv
fullName,email,resumeText
John Doe,john@example.com,"JOHN DOE\nSenior Software Engineer\n\nEXPERIENCE\nGoogle (2018-2024)\n- Led team of 5\n- Built microservices\n\nEDUCATION\nStanford University, BS CS, 2012"
```

## Future Features

🔜 **Unlimited experience/education/project entries** via numbered columns  
🔜 **Custom field mapping** (map your CSV columns to our fields)  
🔜 **Technology categories import** (Languages, Frameworks, Tools)  
🔜 **Bulk update mode** (update specific fields without overwriting)  
