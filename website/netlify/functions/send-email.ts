import { Handler } from "@netlify/functions";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Google Sheets webhook URL (set via GOOGLE_SHEETS_WEBHOOK in Netlify env vars)
// To set up:
// 1. Create a Google Sheet with columns: email, timestamp
// 2. Go to Extensions > Apps Script
// 3. Paste this code:
//    function doPost(e) {
//      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
//      const data = JSON.parse(e.postData.contents);
//      sheet.appendRow([data.email, new Date().toISOString()]);
//      return ContentService.createTextOutput(JSON.stringify({success: true}));
//    }
// 4. Deploy > New Deployment > Web App > Execute as: Me > Who has access: Anyone
// 5. Copy the URL and set it as GOOGLE_SHEETS_WEBHOOK environment variable

async function saveToGoogleSheets(email: string) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK;

  if (!webhookUrl) {
    console.log("GOOGLE_SHEETS_WEBHOOK not configured, skipping sheet save");
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    console.log("Email saved to Google Sheets:", email);
  } catch (error) {
    console.error("Failed to save to Google Sheets:", error);
    // Don't throw - we still want to send the email even if sheet fails
  }
}

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

    // Save to Google Sheets
    await saveToGoogleSheets(email);

    // Send email using Resend (use verified domain or Resend's test sender)
    const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const response = await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: "Welcome to the Cluso Waitlist!",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0a0a0a; margin-bottom: 16px;">Welcome to Cluso!</h2>

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
            &copy; 2024 Cluso. All rights reserved.<br>
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
