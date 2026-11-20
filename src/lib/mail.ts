import nodemailer from "nodemailer";

/**
 * Creates or reuses a transporter.
 * Uses environment variables (SMTP) if provided, otherwise creates an Ethereal test account.
 */
async function getTransporter() {
  if (process.env.EMAIL_SERVER_HOST && process.env.EMAIL_SERVER_USER) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT) || 587,
      secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });
  }

  // Fallback for development: Ethereal Email test account
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    const transporter = await getTransporter();
    const from = process.env.EMAIL_FROM || '"Premium CBT" <no-reply@premiumcbt.com>';

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });

    console.log("-----------------------------------------");
    console.log(`[Email Sent] To: ${to} | Subject: "${subject}"`);
    console.log("Message ID:", info.messageId);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Email Preview Link]: ${previewUrl}`);
    }
    console.log("-----------------------------------------");

    return info;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

/**
 * Account Activation Email
 */
export async function sendActivationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const activationLink = `${baseUrl}/activate?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Activate your Premium CBT account",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 26px;">🎓 Premium CBT</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Welcome to the next generation test platform</p>
        </div>
        
        <h2 style="color: #0f172a; font-size: 20px; margin-bottom: 12px;">Activate Your Account</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Thank you for signing up! Before you can log in and start practicing exams, please verify your email address by clicking the button below:
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${activationLink}" style="background-color: #6366f1; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);">Activate My Account</a>
        </div>
        
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          This activation link is valid for <strong>24 hours</strong>. If you did not create an account on Premium CBT, please disregard this email.
        </p>
        
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; word-break: break-all; margin: 0;">
          If the button above does not work, copy and paste this URL into your browser:<br/>
          <a href="${activationLink}" style="color: #6366f1;">${activationLink}</a>
        </p>
      </div>
    `,
  });
}

/**
 * Forgot / Reset Password Email
 */
export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Reset your Premium CBT password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 26px;">🎓 Premium CBT</h1>
        </div>
        
        <h2 style="color: #0f172a; font-size: 20px; margin-bottom: 12px;">Password Reset Request</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          We received a request to reset the password for your account associated with <strong>${email}</strong>. Click the button below to choose a new password:
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background-color: #6366f1; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);">Reset Password</a>
        </div>
        
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          This reset link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
        </p>
        
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; word-break: break-all; margin: 0;">
          If the button does not work, copy and paste this link into your browser:<br/>
          <a href="${resetLink}" style="color: #6366f1;">${resetLink}</a>
        </p>
      </div>
    `,
  });
}
