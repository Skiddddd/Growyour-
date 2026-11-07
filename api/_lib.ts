// Shared helpers for the email-verification server functions.
// Files starting with "_" are not exposed as routes by Vercel.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

export const CODE_TTL_MS = 10 * 60 * 1000; // code is valid for 10 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between codes
export const MAX_SENDS_PER_HOUR = 5;
export const MAX_ATTEMPTS = 5;

let cachedApp: App | null = null;
let cachedSecret = '';

function loadServiceAccount(): any {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  const json = JSON.parse(raw);
  if (typeof json.private_key === 'string') {
    // Environment variables often store the key with escaped line breaks.
    json.private_key = json.private_key.replace(/\\n/g, '\n');
  }
  return json;
}

export function getServices(): { db: Firestore; auth: Auth; secret: string } {
  if (!cachedApp) {
    const sa = loadServiceAccount();
    cachedSecret = String(sa.private_key || '');
    cachedApp = getApps()[0] || initializeApp({ credential: cert(sa) });
  }
  return { db: getFirestore(cachedApp), auth: getAuth(cachedApp), secret: cachedSecret };
}

export function hashCode(secret: string, uid: string, code: string): string {
  return createHmac('sha256', secret).update(`${uid}:${code}`).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const isEmail = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ---- Email sending: Brevo (domain or single sender) or Resend (verified domain) ----
export const BRAND = process.env.EMAIL_FROM_NAME || 'EquityVest Pro';
export const SITE_URL = (process.env.SITE_URL || 'https://equityvestpro.com').replace(/\/+$/, '');

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const fromName = BRAND;
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  if (process.env.BREVO_API_KEY) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: msg.to }],
        subject: msg.subject,
        htmlContent: msg.html,
        textContent: msg.text
      })
    });
    if (!res.ok) throw new Error(`Brevo error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }

  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text })
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }

  throw new Error('No email provider configured (set RESEND_API_KEY or BREVO_API_KEY)');
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  await sendEmail({
    to,
    subject: `Your ${BRAND} verification code: ${code}`,
    text: `Your ${BRAND} verification code is ${code}. It expires in 10 minutes. If you did not create an account, you can ignore this email.`,
    html: `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">Verify your email</h2>
      <p style="margin:0 0 16px;color:#475569">Enter this code on the sign-up screen to confirm your email address:</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#f1f5f9;border-radius:12px;padding:16px;text-align:center">${code}</div>
      <p style="margin:16px 0 0;color:#64748b;font-size:13px">This code expires in 10 minutes. After verification, your account still needs to be approved by our team before you can sign in.</p>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:12px">If you did not create an account, you can safely ignore this email.</p>
    </div>`
  });
}

export async function sendApprovalEmail(to: string, fullName: string): Promise<void> {
  const name = escapeHtml((fullName || '').trim() || 'there');
  await sendEmail({
    to,
    subject: `Welcome to ${BRAND} - your account is approved`,
    text: `Hi ${fullName || 'there'}, good news! Your ${BRAND} account has been reviewed and approved. You can sign in now: ${SITE_URL}\n\nIf you do not see future emails from us, please check your spam folder.`,
    html: `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:460px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">Welcome to ${escapeHtml(BRAND)}!</h2>
      <p style="margin:0 0 12px;color:#334155">Hi ${name},</p>
      <p style="margin:0 0 16px;color:#334155">Good news - your account has been reviewed and <strong>approved</strong>. You can sign in now and get started.</p>
      <p style="margin:0 0 20px"><a href="${SITE_URL}" style="display:inline-block;background:#06b6d4;color:#04121a;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px">Sign in to your account</a></p>
      <p style="margin:0 0 6px;color:#64748b;font-size:13px">Or open this link: <a href="${SITE_URL}" style="color:#0891b2">${SITE_URL}</a></p>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:12px">Tip: add this sender to your contacts so our emails do not land in spam.</p>
    </div>`
  });
}
