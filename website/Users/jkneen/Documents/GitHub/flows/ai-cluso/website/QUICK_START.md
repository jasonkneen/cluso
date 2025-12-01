# Quick Start: Resend + Netlify Integration

## ⚡ 3-Step Setup

### Step 1: Install Dependencies
```bash
npm install resend
npm install --save-dev @netlify/functions @types/node
```

### Step 2: Create Netlify Function

Create file: `netlify/functions/send-email.ts`

```typescript
import { Handler } from "@netlify/functions";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { email } = JSON.parse(event.body || "{}");

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid email address" }),
      };
    }

    const response = await resend.emails.send({
      from: "noreply@cluso.dev",
      to: email,
      subject: "Welcome to the Cluso Waitlist! 🚀",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0a0a0a;">Welcome to Cluso! 🎉</h2>
          <p style="color: #525252;">Thanks for joining the waitlist!</p>
          <p style="color: #525252;">We're building the AI-powered browser for frontend development, and we can't wait to show you what we've been working on.</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
          <p style="color: #a1a1a1; font-size: 12px;">© 2024 Cluso. All rights reserved.</p>
        </div>
      `,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Email sent successfully",
        id: response.data?.id,
      }),
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to send email",
      }),
    };
  }
};

export { handler };
```

### Step 3: Set Environment Variable

1. Get API key from [https://resend.com/api-keys](https://resend.com/api-keys)
2. Create `.env.local` in project root:
```
RESEND_API_KEY=re_your_api_key_here
```
3. Add to `.gitignore` (it's already there)

## ✅ Verify It Works

Run locally:
```bash
npm install -g netlify-cli
netlify dev
```

Then open http://localhost:3000 and test the email form!

## 🚀 Deploy to Netlify

1. Commit and push your code
2. In Netlify dashboard:
   - Go to **Site settings** → **Build & Deploy** → **Environment**
   - Add new variable: `RESEND_API_KEY=re_xxxxx`
3. Trigger a new deploy

Done! 🎉

## 📝 Files Modified

- ✅ `src/LandingPage.tsx` - Updated to call the function
- ✅ Updated this guide and others with full instructions

## 📚 Full Documentation

See `RESEND_SETUP.md` for detailed explanations and troubleshooting.
