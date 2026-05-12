import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    console.warn("[EMAIL] SMTP not configured — email sending disabled");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: host,
    port: Number(port),
    secure: Number(port) === 465, // true only for 465, false for 587
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false, // helps avoid TLS issues in dev
    },
  });

  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.sendMail({
      from: `"University App" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`[EMAIL] Sent successfully to ${to}: "${subject}"`);
    return true;
  } catch (err: any) {
    console.error("[EMAIL] Failed to send email:", err?.message || err);
    return false;
  }
}
