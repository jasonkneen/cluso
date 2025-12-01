# Resend + Netlify Functions Setup Guide

This guide explains how to set up Resend email service with Netlify Functions to send welcome emails for your Cluso waitlist.

## Overview

We've set up a Netlify Function that:
1. Receives email submissions from your landing page
2. Validates the email address
3. Sends a welcome email using Resend
4. Returns success/error responses to the frontend

## Step 1: Create Resend Account & Get API Key

1. Visit [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Go to API Keys section
4. Create a new API key
5. Copy the API key for later use

## Step 2: Install Dependencies

Run the following command to install the required packages:

```bash
npm install resend
npm install --save-dev @netlify/functions @types/node
```

## Step 3: Set Up Environment Variables

1. Create a `.env.local` file in your project root (this is git-ignored)
2. Add your Resend API key:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Step 4: Update Your Configuration Files

### A. Update `netlify.toml` (create if it doesn't exist)

```toml
[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = "dist"

[env]
  [env.production]
    [env.production.context.deploy-preview]
      environment = { NODE_ENV = "production" }
```

### B. Update `package.json`

Add these to your dependencies:
```json
"dependencies": {
  "resend": "^3.0.0"
}
```

Add these to your devDependencies:
```json
"devDependencies": {
  "@netlify/functions": "^2.4.0",
  "@types/node": "^20.0.0"
}
```

## Step 5: Create Netlify Function

Create the file: `netlify/functions/send-email.ts`

```typescript
import { Handler } from "@netlify/functions";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { email } = JSON.parse(event.body || "{}");

    // Validate email
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid email address" }),
      };
    }

    // Send email using Resend
    const response = await resend.emails.send({
      from: "noreply@cluso.dev",
      to: email,
      subject: "Welcome to the Cluso Waitlist! 🚀",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0a0a0a; margin-bottom: 16px;">Welcome to Cluso! 🎉</h2>
          
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
            Thanks for joining the Cluso waitlist! We're thrilled to have you on board.
          </p>
          
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
            Cluso is the AI-powered browser for frontend development. With voice-powered UI editing and real-time previews, we're making it faster than ever to build beautiful interfaces.
          </p>
          
          <div style="background-color: #f5f5f5; border-left: 4px solid #f97316; padding: 16px; margin-bottom: 24px;">
            <p style="color: #0a0a0a; font-weight: 600; margin: 0 0 8px 0;">What's next?</p>
            <ul style="color: #525252; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Watch for updates in your inbox</li>
              <li style="margin-bottom: 8px;">Join our community on <a href="https://twitter.com/clusodev" style="color: #f97316; text-decoration: none;">Twitter</a></li>
              <li>Star us on <a href="https://github.com/jkneen/cluso" style="color: #f97316; text-decoration: none;">GitHub</a></li>
            </ul>
          </div>
          
          <p style="color: #a1a1a1; font-size: 14px; line-height: 1.6;">
            Have questions? Reply to this email or reach out at hello@cluso.dev
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
          
          <p style="color: #a1a1a1; font-size: 12px; text-align: center; margin: 0;">
            © 2024 Cluso. All rights reserved.<br>
            <a href="https://cluso.dev" style="color: #f97316; text-decoration: none;">cluso.dev</a>
          </p>
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
        details: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

export { handler };
```

## Step 6: Update Frontend Component

The `LandingPage.tsx` has been updated to:
1. Call the Netlify Function endpoint (`/.netlify/functions/send-email`)
2. Handle success/error states with visual notifications
3. Show user-friendly messages

Key changes in the form submission:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  setSubmitState('submitting');

  try {
    const response = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      setSubmitState('submitted');
      setEmail('');
      showNotification('success', 'Welcome! Check your email for confirmation.');
    } else {
      setSubmitState('idle');
      showNotification('error', data.error || 'Failed to join waitlist.');
    }
  } catch (error) {
    setSubmitState('idle');
    showNotification('error', 'An error occurred. Please try again later.');
  }
};
```

## Step 7: Verify Resend Configuration

Before deploying, make sure:
1. You've updated the "from" email address if using a custom domain (currently set to `noreply@cluso.dev`)
2. You have email domain verified in Resend dashboard
3. Environment variables are set in Netlify

## Step 8: Deploy to Netlify

1. Commit your changes to git
2. Push to your GitHub repository
3. Connect your repo to Netlify (if not already connected)
4. In Netlify dashboard:
   - Go to Site Settings → Build & Deploy → Environment
   - Add environment variable: `RESEND_API_KEY` with your API key value
5. Trigger a new deploy

## Step 9: Test Locally (Optional)

To test locally, you can use Netlify Dev:

```bash
npm install -g netlify-cli
netlify dev
```

This will run your local dev server with Netlify Functions enabled.

## Troubleshooting

### Email not sending
- Check that `RESEND_API_KEY` is set in environment variables
- Verify your email address is in the Resend verified list
- Check Netlify function logs in the dashboard

### 405 Method Not Allowed
- Make sure you're sending a POST request, not GET
- Check the fetch call is using correct method

### Email validation fails
- Ensure email format is correct (contains @ and .)
- Check that no spaces are in the email

## Customizing the Email Template

Edit the HTML in `netlify/functions/send-email.ts` in the `resend.emails.send()` call to customize:
- Sender name and address
- Email subject
- Email content and design
- Links and branding

## Next Steps

1. Install dependencies: `npm install`
2. Set up `.env.local` with your Resend API key
3. Create the function files as shown above
4. Test locally with `netlify dev`
5. Deploy to Netlify with environment variables set

That's it! Your waitlist form will now send welcome emails automatically.
