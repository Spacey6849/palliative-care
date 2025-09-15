import nodemailer from 'nodemailer';

// Expect env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
export function getTransport() {
  const env = process.env as Record<string, string | undefined>;
  const host = env['SMTP_HOST'];
  if (!host) throw new Error('SMTP_HOST not set');
  const port = parseInt(env['SMTP_PORT'] || '587', 10);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: env['SMTP_USER'] ? {
      user: env['SMTP_USER']!,
      pass: env['SMTP_PASS'],
    } : undefined,
  });
}

export async function sendVerificationEmail(to: string, token: string) {
  const env = process.env as Record<string, string | undefined>;
  const base = env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000';
  const verifyUrl = `${base}/auth/verify?token=${encodeURIComponent(token)}`;
  const transport = getTransport();
  await transport.sendMail({
    from: env['MAIL_FROM'] || 'no-reply@ecowell.local',
    to,
    subject: 'Verify your EcoWell email',
    text: `Click to verify: ${verifyUrl}`,
    html: `<p>Click to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const env = process.env as Record<string, string | undefined>;
  const base = env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000';
  const resetUrl = `${base}/auth/reset?token=${encodeURIComponent(token)}`;
  const transport = getTransport();
  await transport.sendMail({
    from: env['MAIL_FROM'] || 'no-reply@ecowell.local',
    to,
    subject: 'Reset your EcoWell password',
    text: `You requested a password reset. If this was you, click to reset: ${resetUrl}. If not, ignore this email.`,
    html: `<p>You requested a password reset. If this was you, click the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
  });
}
