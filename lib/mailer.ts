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
  // Use absolute path with URL to avoid inheriting any path (e.g., '/maps') from base
  const verifyUrl = new URL(`/auth/verify?token=${encodeURIComponent(token)}`, base).toString();
  const transport = getTransport();
  await transport.sendMail({
    from: env['MAIL_FROM'] || 'no-reply@binlink.local',
    to,
    subject: 'Verify your BinLink email',
    text: `Click to verify: ${verifyUrl}`,
    html: `<p>Click to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const env = process.env as Record<string, string | undefined>;
  const base = env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000';
  const resetUrl = new URL(`/auth/reset?token=${encodeURIComponent(token)}`, base).toString();
  const transport = getTransport();
  await transport.sendMail({
    from: env['MAIL_FROM'] || 'no-reply@binlink.local',
    to,
    subject: 'Reset your BinLink password',
    text: `You requested a password reset. If this was you, click to reset: ${resetUrl}. If not, ignore this email.`,
    html: `<p>You requested a password reset. If this was you, click the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
  });
}

// Alert email when a bin is left open for too long
export async function sendBinOpenAlertEmail(to: string, binName: string, minutesOpen: number) {
  const env = process.env as Record<string, string | undefined>;
  const transport = getTransport();
  const subject = `[BinLink] ${binName} left open for ${minutesOpen} minutes`;
  const text = `Your bin "${binName}" appears to be open for over ${minutesOpen} minutes. Please check and close it to avoid issues.`;
  const html = `<p>Your bin <strong>${binName}</strong> appears to be open for over <strong>${minutesOpen} minutes</strong>.</p><p>Please check and close it to avoid issues.</p>`;
  await transport.sendMail({
    from: env['MAIL_FROM'] || 'alerts@binlink.local',
    to,
    subject,
    text,
    html,
  });
}
