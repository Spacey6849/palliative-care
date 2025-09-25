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

// Richer lid-open report email including optional fill percentage classification
export async function sendBinOpenReportEmail(options: {
  to: string;
  binName: string;
  minutesOpen: number;
  fillPct?: number | null;
  locationLabel?: string | null;
  binType?: string | null;
}) {
  const { to, binName, minutesOpen } = options;
  const env = process.env as Record<string, string | undefined>;
  const transport = getTransport();
  const pct = typeof options.fillPct === 'number' ? Math.round(options.fillPct) : null;
  const full = pct != null && pct >= 100;
  const almost = pct != null && !full && pct > 80;
  const statusTag = full ? 'FULL' : almost ? 'ALMOST FULL' : pct != null ? `${pct}%` : undefined;
  const duration = minutesOpen < 1 ? '<1 minute' : `${minutesOpen} minute${minutesOpen === 1 ? '' : 's'}`;

  const subjectParts: string[] = [`${binName} Lid Open ${minutesOpen}m`];
  if (statusTag) subjectParts.push(statusTag);
  const subject = `[BinLink] ${subjectParts.join(' – ')}`;

  const lines: string[] = [];
  lines.push(`The lid for "${binName}" has remained open for ${duration}.`);
  if (pct != null) {
    if (full) lines.push(`Current fill level: 100% (FULL). Immediate collection recommended.`);
    else if (almost) lines.push(`Current fill level: ${pct}% (ALMOST FULL). Plan collection soon.`);
    else lines.push(`Current fill level: ${pct}%.`);
  }
  if (options.locationLabel) lines.push(`Location: ${options.locationLabel}`);
  if (options.binType) lines.push(`Bin Type: ${String(options.binType).toUpperCase()}`);
  lines.push('Action: Please check the bin and close the lid to prevent contamination, pests, or sensor misreads.');

  const text = lines.join('\n');
  const html = `<div>${lines.map(l => `<p>${escapeHtml(l)}</p>`).join('')}</div>`;

  await transport.sendMail({
    from: env['MAIL_FROM'] || 'alerts@binlink.local',
    to,
    subject,
    text,
    html,
  });
}

// Alert when bin crosses fill thresholds ("almost full" >80%, "full" =100%)
export async function sendBinFillAlertEmail(to: string, binName: string, fillPct: number) {
  const env = process.env as Record<string, string | undefined>;
  const transport = getTransport();
  const pct = Math.round(fillPct);
  const full = pct >= 100;
  const almost = !full && pct > 80;
  if (!full && !almost) return; // nothing to send
  const subject = full
    ? `[BinLink] ${binName} is FULL (100%)`
    : `[BinLink] ${binName} nearly full (${pct}%)`;
  const text = full
    ? `Your bin "${binName}" has reached 100% capacity. Please schedule immediate collection.`
    : `Your bin "${binName}" is almost full at ${pct}%. Plan collection soon to avoid overflow.`;
  const html = full
    ? `<p>Your bin <strong>${escapeHtml(binName)}</strong> has reached <strong>100% capacity</strong>.</p><p><strong>Action:</strong> Schedule immediate collection.</p>`
    : `<p>Your bin <strong>${escapeHtml(binName)}</strong> is almost full at <strong>${pct}%</strong>.</p><p><strong>Action:</strong> Plan collection soon to avoid overflow.</p>`;
  await transport.sendMail({
    from: env['MAIL_FROM'] || 'alerts@binlink.local',
    to,
    subject,
    text,
    html,
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
