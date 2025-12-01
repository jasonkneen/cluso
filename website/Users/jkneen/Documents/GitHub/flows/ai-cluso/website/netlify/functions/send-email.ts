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
