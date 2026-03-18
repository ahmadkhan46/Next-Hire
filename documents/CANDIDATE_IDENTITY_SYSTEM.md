# Candidate Identity & Duplicate Detection System

## Overview
The platform uses a 3-layer identity system to prevent duplicates and enable seamless integration with external ATS systems.

## Identity Layers

### 1. Database ID (Primary Key)
- **Type**: Auto-generated CUID
- **Example**: `cmlbmr04w0000ecb8f1s36p81`
- **Purpose**: Internal system identifier
- **Always exists**: Yes
- **Used for**: Database relationships, URLs, internal references

### 2. External ID (User-Provided)
- **Type**: User-defined string
- **Example**: `EMP-12345`, `GREENHOUSE-789`, `WORKDAY-456`
- **Purpose**: Integration with external systems (ATS, HR, etc.)
- **Always exists**: No (optional)
- **Used for**: Syncing with external systems, preventing duplicates on re-import

### 3. Fingerprint (Auto-Generated Hash)
- **Type**: SHA-256 hash (16 characters)
- **Formula**: `firstName + lastName + (email OR phone) + dateOfBirth`
- **Example**: `a3f5e8d9c2b1a4f6`
- **Purpose**: Stable identity for duplicate detection
- **Always exists**: Only if sufficient data provided
- **Used for**: Matching candidates when externalId not available

## Matching Priority

When importing or creating candidates, the system checks in this order:

```
1. externalId (if provided) → Match existing candidate
2. email (exact match) → Match existing candidate
3. fingerprint (hash match) → Match existing candidate
4. Create new candidate
```

## Use Cases

### Scenario 1: ATS Integration
**Company uses Greenhouse ATS**
```csv
externalId,fullName,email
GREENHOUSE-12345,John Doe,john@example.com
```
- First import: Creates candidate with externalId
- Re-import: Matches by externalId, updates data
- No duplicates created

### Scenario 2: Manual Entry (No External System)
**User adds candidate via UI**
```
Name: John Doe
Email: john@example.com
DOB: 1990-01-15
```
- System generates fingerprint: `a3f5e8d9c2b1a4f6`
- Later CSV import with same data → Matches by email or fingerprint
- No duplicates created

### Scenario 3: Email Change
**Candidate changes email**
```
Original: john@oldcompany.com
New: john@newcompany.com
```
- Email match fails
- Fingerprint (name+phone+DOB) still matches
- Updates existing candidate, no duplicate

### Scenario 4: Same Name, Different Person
```
Person A: John Doe, DOB: 1990-01-15, Phone: 555-1234
Person B: John Doe, DOB: 1985-06-20, Phone: 555-5678
```
- Different fingerprints generated
- Creates two separate candidates
- No false positive match

## Benefits

✅ **Flexible**: Works with or without external systems  
✅ **Reliable**: 3-layer matching prevents duplicates  
✅ **Stable**: Handles data changes (email, phone)  
✅ **Accurate**: Distinguishes between people with same names  
✅ **Future-proof**: Can add more identity layers

## Technical Implementation

**Database Schema:**
```prisma
model Candidate {
  id          String   @id @default(cuid())  // Layer 1
  externalId  String?                         // Layer 2
  fingerprint String?                         // Layer 3
  
  @@unique([orgId, externalId])
  @@unique([orgId, fingerprint])
}
```

**Fingerprint Generation:**
```typescript
import { createHash } from 'crypto';

function generateFingerprint(data) {
  const firstName = extractFirstName(data.fullName);
  const lastName = extractLastName(data.fullName);
  const contact = data.email || data.phone;
  const dob = data.dateOfBirth;
  
  const combined = [firstName, lastName, contact, dob].join('|');
  return createHash('sha256').update(combined).digest('hex').slice(0, 16);
}
```
