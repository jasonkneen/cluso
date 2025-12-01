# Files to Create for Resend Integration

## Summary of Changes

Here are all the files and changes needed to set up Resend email with Netlify Functions:

## 1. Create Directory: `netlify/functions/`

This directory holds your serverless functions.

## 2. Create File: `netlify/functions/send-email.ts`

**Location:** Project root → `netlify/functions/send-email.ts`

This is the backend function that handles email sending via Resend. See RESEND_SETUP.md for full content.

## 3. Update File: `netlify.toml` 

**Location:** Project root → `netlify.toml`

Configuration file for Netlify deployment. Tells Netlify where functions are and how to build.

## 4. Create File: `.env.local` (LOCAL ONLY - not committed)

**Location:** Project root → `.env.local`

Add your Resend API key (never commit this file):
```
RESEND_API_KEY=re_your_key_here
```

Add `.env.local` to your `.gitignore` if not already there.

## 5. Create File: `.env.example`

**Location:** Project root → `.env.example`

Template for environment variables (safe to commit):
```
RESEND_API_KEY=your_resend_api_key_here
```

## 6. Updated File: `package.json`

**Changes needed:**
- Add `"resend": "^3.0.0"` to `dependencies`
- Add `"@netlify/functions": "^2.4.0"` to `devDependencies`
- Add `"@types/node": "^20.0.0"` to `devDependencies`

## 7. Updated File: `src/LandingPage.tsx`

**Already updated** - includes:
- Frontend function to call Netlify endpoint
- Success/error notifications
- Loading states for button feedback
- Email form submission handling

## Setup Checklist

- [ ] Create `netlify/functions/` directory
- [ ] Create `netlify/functions/send-email.ts` file
- [ ] Create `netlify.toml` in project root
- [ ] Create `.env.local` with Resend API key
- [ ] Create `.env.example` template
- [ ] Update `package.json` with new dependencies
- [ ] Run `npm install`
- [ ] Verify `.gitignore` excludes `.env.local`
- [ ] Test locally with `netlify dev`
- [ ] Set environment variables in Netlify dashboard
- [ ] Deploy to Netlify

## File Structure After Setup

```
project-root/
├── netlify/
│   └── functions/
│       └── send-email.ts          ← NEW
├── src/
│   ├── LandingPage.tsx            ← UPDATED
│   └── main.tsx
├── public/
├── dist/
├── .env.local                      ← NEW (gitignored)
├── .env.example                    ← NEW
├── .gitignore                      ← VERIFY INCLUDES .env.local
├── netlify.toml                    ← NEW
├── package.json                    ← UPDATED
├── vite.config.ts
└── README.md
```

## Next Steps

1. Follow the RESEND_SETUP.md guide for detailed setup
2. Install dependencies with `npm install`
3. Get API key from https://resend.com
4. Test with `netlify dev`
5. Deploy!
