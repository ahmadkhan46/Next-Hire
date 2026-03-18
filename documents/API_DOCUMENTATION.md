# API Documentation

## Authentication

All API routes (except `/api/bootstrap` and `/api/debug`) require authentication via Clerk.

**Headers**:
```
Authorization: Bearer <clerk_session_token>
```

## Base URL

```
http://localhost:3000/api
```

## Endpoints

### Organizations

#### Get User's Organizations
```http
GET /api/orgs/my
```

**Response**:
```json
{
  "organizations": [
    {
      "id": "org_123",
      "name": "Acme Corp",
      "role": "OWNER"
    }
  ]
}
```

---

### Candidates

#### List Candidates
```http
GET /api/orgs/{orgId}/candidates?page=1&limit=20
```

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "candidates": [
    {
      "id": "cand_123",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234",
      "currentTitle": "Senior Developer",
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

#### Create Candidate
```http
POST /api/orgs/{orgId}/candidates
```

**Body**:
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "555-1234",
  "dateOfBirth": "1990-01-15T00:00:00.000Z",
  "location": "San Francisco",
  "currentTitle": "Senior Developer",
  "yearsOfExperience": 8,
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "githubUrl": "https://github.com/johndoe",
  "portfolioUrl": "https://johndoe.com",
  "status": "ACTIVE",
  "source": "MANUAL",
  "notes": "Great candidate",
  "experiences": [
    {
      "company": "Tech Corp",
      "role": "Senior Developer",
      "startMonth": 1,
      "startYear": 2020,
      "endMonth": 12,
      "endYear": 2023,
      "description": "Led team of 5 developers"
    }
  ],
  "educations": [
    {
      "school": "MIT",
      "degree": "BS Computer Science",
      "startYear": 2012,
      "endYear": 2016
    }
  ],
  "projects": [
    {
      "title": "E-commerce Platform",
      "description": "Built scalable platform",
      "technologies": "React, Node.js, AWS",
      "url": "https://github.com/johndoe/ecommerce"
    }
  ],
  "technologies": [
    {
      "category": "Frontend",
      "items": ["React", "Vue", "TypeScript"]
    }
  ]
}
```

**Response**:
```json
{
  "id": "cand_123",
  "fullName": "John Doe",
  "email": "john@example.com",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

#### Update Candidate
```http
PATCH /api/orgs/{orgId}/candidates/{candidateId}
```

**Body**: Same as create, all fields optional

#### Delete Candidate
```http
DELETE /api/orgs/{orgId}/candidates/{candidateId}
```

**Response**:
```json
{
  "message": "Candidate deleted successfully"
}
```

#### Get Candidate
```http
GET /api/orgs/{orgId}/candidates/{candidateId}
```

**Response**:
```json
{
  "id": "cand_123",
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "555-1234",
  "dateOfBirth": "1990-01-15T00:00:00.000Z",
  "location": "San Francisco",
  "currentTitle": "Senior Developer",
  "yearsOfExperience": 8,
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "githubUrl": "https://github.com/johndoe",
  "portfolioUrl": "https://johndoe.com",
  "status": "ACTIVE",
  "source": "MANUAL",
  "skills": [
    { "name": "React", "level": 5 },
    { "name": "Node.js", "level": 4 }
  ],
  "experiences": [...],
  "educations": [...],
  "projects": [...],
  "createdAt": "2024-01-15T10:00:00Z"
}
```

#### Bulk Import Candidates
```http
POST /api/orgs/{orgId}/candidates/import
```

**Body**:
```json
{
  "candidates": [
    {
      "fullName": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234",
      "dateOfBirth": "1990-01-15T00:00:00.000Z",
      "externalId": "EMP-001",
      "skills": ["React", "Node.js", "Python"],
      "resumeText": "Full resume text..."
    }
  ]
}
```

**Response**:
```json
{
  "jobId": "job_123",
  "status": "queued",
  "message": "Import job queued with 1 candidates"
}
```

---

### Candidate Sub-Resources

#### Add Experience
```http
POST /api/orgs/{orgId}/candidates/{candidateId}/experience
```

**Body**:
```json
{
  "company": "Tech Corp",
  "role": "Senior Developer",
  "startMonth": 1,
  "startYear": 2020,
  "endMonth": 12,
  "endYear": 2023,
  "description": "Led team of 5 developers"
}
```

#### Add Education
```http
POST /api/orgs/{orgId}/candidates/{candidateId}/education
```

**Body**:
```json
{
  "school": "MIT",
  "degree": "BS Computer Science",
  "fieldOfStudy": "Computer Science",
  "startYear": 2012,
  "endYear": 2016
}
```

#### Add Project
```http
POST /api/orgs/{orgId}/candidates/{candidateId}/projects
```

**Body**:
```json
{
  "title": "E-commerce Platform",
  "description": "Built scalable platform",
  "technologies": "React, Node.js, AWS",
  "url": "https://github.com/johndoe/ecommerce"
}
```

#### Add Technology Category
```http
POST /api/orgs/{orgId}/candidates/{candidateId}/technologies
```

**Body**:
```json
{
  "category": "Frontend",
  "items": ["React", "Vue", "TypeScript"]
}
```

#### Upload Resume
```http
POST /api/orgs/{orgId}/candidates/{candidateId}/resumes
```

**Body**: multipart/form-data with `file` field

**Response**:
```json
{
  "id": "resume_123",
  "filename": "john_doe_resume.pdf",
  "uploadedAt": "2024-01-15T10:00:00Z"
}
```

#### Parse Resume
```http
POST /api/orgs/{orgId}/candidates/{candidateId}/resumes/{resumeId}/parse
```

**Response**:
```json
{
  "message": "Resume parsed successfully",
  "extracted": {
    "experiences": 3,
    "educations": 2,
    "projects": 5,
    "skills": 15
  }
}
```

---

### Jobs

#### List Jobs
```http
GET /api/orgs/{orgId}/jobs?page=1&limit=20
```

**Response**:
```json
{
  "jobs": [
    {
      "id": "job_123",
      "title": "Senior React Developer",
      "location": "San Francisco",
      "status": "OPEN",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20
}
```

#### Create Job
```http
POST /api/orgs/{orgId}/jobs
```

**Body**:
```json
{
  "title": "Senior React Developer",
  "description": "We are looking for...",
  "location": "San Francisco",
  "status": "OPEN"
}
```

**Response**:
```json
{
  "id": "job_123",
  "title": "Senior React Developer",
  "status": "OPEN",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

---

### Matching

#### Get Matches for Job
```http
GET /api/jobs/{jobId}/matches?status=SHORTLISTED&page=1&limit=20
```

**Query Parameters**:
- `status` (optional): Filter by match status (NONE, SHORTLISTED, REJECTED)
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response**:
```json
{
  "matches": [
    {
      "id": "match_123",
      "candidateId": "cand_123",
      "candidateName": "John Doe",
      "score": 85.5,
      "status": "SHORTLISTED",
      "matched": ["React", "Node.js"],
      "missing": ["AWS"],
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

#### Update Match Status
```http
PATCH /api/jobs/{jobId}/matches/{candidateId}
```

**Body**:
```json
{
  "status": "SHORTLISTED",
  "note": "Great technical skills"
}
```

**Response**:
```json
{
  "id": "match_123",
  "status": "SHORTLISTED",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

#### Bulk Update Match Status
```http
POST /api/jobs/{jobId}/matches/bulk-status
```

**Body**:
```json
{
  "candidateIds": ["cand_123", "cand_456"],
  "status": "SHORTLISTED",
  "note": "Moving to next round"
}
```

**Response**:
```json
{
  "updated": 2,
  "failed": 0
}
```

#### Refresh Auto-Matches
```http
POST /api/orgs/{orgId}/auto-match?candidateId=cand_123
```

**Query Parameters**:
- `candidateId` (optional): Refresh matches for specific candidate
- `jobId` (optional): Refresh matches for specific job

**Response**:
```json
{
  "message": "Auto-matching completed",
  "matched": 15
}
```

---

### Analytics

#### Get Analytics
```http
GET /api/orgs/{orgId}/analytics?startDate=2024-01-01&endDate=2024-12-31
```

**Response**:
```json
{
  "funnel": {
    "total": 150,
    "shortlisted": 45,
    "rejected": 30,
    "hired": 10
  },
  "timeToHire": {
    "average": 21,
    "median": 18
  },
  "sourceBreakdown": {
    "REFERRAL": 50,
    "LINKEDIN": 40,
    "IMPORT": 30
  },
  "topSkills": [
    { "name": "React", "count": 80 },
    { "name": "Node.js", "count": 65 }
  ]
}
```

---

### Audit Logs

#### Get Audit Logs
```http
GET /api/orgs/{orgId}/audit?page=1&limit=50
```

**Response**:
```json
{
  "logs": [
    {
      "id": "log_123",
      "action": "MATCH_STATUS_UPDATED",
      "userId": "user_123",
      "userName": "John Admin",
      "details": {
        "candidateId": "cand_123",
        "jobId": "job_123",
        "fromStatus": "NONE",
        "toStatus": "SHORTLISTED"
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 500,
  "page": 1,
  "limit": 50
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "error": "Permission denied: candidates:write required"
}
```

### 404 Not Found
```json
{
  "error": "Candidate not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

---

## Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| API | 100 requests | 1 minute |
| LLM | 50 requests | 1 hour |
| Bulk Import | 5 requests | 1 hour |
| Auth | 10 requests | 15 minutes |

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## Permissions

| Permission | Description |
|-----------|-------------|
| `candidates:read` | View candidates |
| `candidates:write` | Create/edit candidates |
| `candidates:delete` | Delete candidates |
| `jobs:read` | View jobs |
| `jobs:write` | Create/edit jobs |
| `jobs:delete` | Delete jobs |
| `matches:read` | View matches |
| `matches:write` | Update match status |
| `analytics:read` | View analytics |
| `settings:read` | View settings |
| `settings:write` | Update settings |
| `members:read` | View members |
| `members:write` | Manage members |

---

## Webhooks (Future)

Coming soon: Webhook support for real-time notifications.

Events:
- `candidate.created`
- `candidate.updated`
- `match.status_changed`
- `job.created`
- `import.completed`
