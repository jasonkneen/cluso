import { Handler } from "@netlify/functions";

async function saveToGoogleSheets(email: string): Promise<boolean> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK;

  if (!webhookUrl) {
    console.log("GOOGLE_SHEETS_WEBHOOK not configured, skipping");
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    console.log("Google Sheets response:", response.status);
    return response.ok;
  } catch (error) {
    console.error("Google Sheets error:", error);
    return false;
  }
}

async function sendEmail(email: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("RESEND_API_KEY not configured, skipping email");
    return false;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

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
          <p style="color: #a1a1a1; font-size: 14px; line-height: 1.6;">
            Have questions? Reach out at hello@cluso.dev
          </p>
        </div>
      `,
    });

    console.log("Resend response:", response);
    return !!response.data?.id;
  } catch (error) {
    console.error("Resend error:", error);
    return false;
  }
}

const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { email } = JSON.parse(event.body || "{}");

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid email address" }),
      };
    }

    // Try both, don't fail if one doesn't work
    const [sheetsSaved, emailSent] = await Promise.all([
      saveToGoogleSheets(email),
      sendEmail(email),
    ]);

    console.log(`Results - Sheets: ${sheetsSaved}, Email: ${emailSent}`);

    // Success if at least one worked
    if (sheetsSaved || emailSent) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sheetsSaved,
          emailSent,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to process signup",
        sheetsSaved,
        emailSent,
      }),
    };
  } catch (error) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

export { handler };
