# 🔐 Authentication Setup Guide

## ✅ What We've Implemented

1. **Clerk Authentication** - Enterprise-grade auth solution
2. **Protected Routes** - Middleware guards all pages
3. **Sign In/Up Pages** - Premium styled auth pages
4. **Navigation Header** - User profile with dropdown
5. **User Context** - Access user data throughout app

---

## 🚀 Setup Instructions

### Step 1: Create Clerk Account
1. Go to https://clerk.com
2. Sign up for free account
3. Create new application
4. Choose "Next.js" as framework

### Step 2: Get API Keys
1. In Clerk Dashboard, go to "API Keys"
2. Copy your keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

### Step 3: Configure Environment
1. Create `.env.local` file in project root:

```env
# Clerk Keys (from dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Database
DATABASE_URL="your_database_url"

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 4: Update Prisma Schema
Add user tracking to existing models:

```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique  // Add this
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships Membership[]
  candidates  Candidate[]  @relation("UserCreatedCandidates")
}
```

Run migration:
```bash
npx prisma migrate dev --name add-clerk-id
```

### Step 5: Restart Dev Server
```bash
npm run dev
```

---

## 🎯 How It Works

### Protected Routes
All routes except `/sign-in` and `/sign-up` require authentication.

### User Access
```typescript
import { currentUser } from '@clerk/nextjs/server';

// In Server Components
const user = await currentUser();

// In Client Components
import { useUser } from '@clerk/nextjs';
const { user } = useUser();
```

### API Protection
```typescript
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... your logic
}
```

---

## 🎨 Customization

### Clerk Appearance
Customize in `src/app/sign-in/[[...sign-in]]/page.tsx`:

```typescript
<SignIn 
  appearance={{
    elements: {
      rootBox: 'mx-auto',
      card: 'shadow-none bg-white',
      headerTitle: 'text-slate-900',
      // ... more customization
    }
  }}
/>
```

### Navigation
Edit `src/components/navigation.tsx` to add/remove links.

---

## 📝 Next Steps After Setup

1. **Add Navigation to Layout**
   - Import `<Navigation />` in main layout
   - Place above page content

2. **Update APIs**
   - Add user context to decision logs
   - Track who created candidates/jobs
   - Implement org membership checks

3. **Add User Onboarding**
   - Create organization on first sign-in
   - Set up user profile
   - Guide through first job creation

4. **Implement Permissions**
   - Check org membership in APIs
   - Enforce role-based access (OWNER/ADMIN/MEMBER)
   - Add permission checks in UI

---

## 🔒 Security Best Practices

✅ **Implemented:**
- Middleware protection on all routes
- API authentication checks
- Secure session management

🚧 **TODO:**
- [ ] Add CSRF protection
- [ ] Implement rate limiting
- [ ] Add audit logging for auth events
- [ ] Set up webhook for user events
- [ ] Configure session timeout

---

## 🐛 Troubleshooting

**Issue: "Clerk keys not found"**
- Ensure `.env.local` exists in project root
- Restart dev server after adding keys

**Issue: "Redirect loop"**
- Check middleware matcher config
- Verify sign-in/up URLs in env

**Issue: "User not found in database"**
- Implement webhook to sync Clerk → Prisma
- Or create user on first API call

---

**Authentication is now ready! 🎉**
Users can sign up, sign in, and access the platform securely.
