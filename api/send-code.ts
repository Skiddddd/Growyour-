import { randomInt } from 'node:crypto';
import {
  CODE_TTL_MS,
  MAX_SENDS_PER_HOUR,
  RESEND_COOLDOWN_MS,
  getServices,
  hashCode,
  isEmail,
  sendVerificationEmail
} from './_lib.js';

// POST /api/send-code  { email }
// Emails a 6-digit code to an account that is still waiting for email verification.
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

  let services;
  try {
    services = getServices();
  } catch (err) {
    console.error('send-code config error:', err);
    return res.status(500).json({ error: 'Verification service is not configured yet.' });
  }
  const { db, auth, secret } = services;

  try {
    // Same answer whether or not the account exists, so emails can't be probed.
    const generic = () => res.status(200).json({ ok: true });

    let uid: string;
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch {
      return generic();
    }

    const profile = (await db.doc(`profiles/${uid}`).get()).data();
    const needsVerification = profile && profile.accountStatus === 'PENDING' && profile.emailVerified !== true;
    if (!needsVerification) return generic();

    const now = Date.now();
    const ref = db.doc(`email_codes/${uid}`);
    const prev = (await ref.get()).data() || {};

    if (prev.lastSentAt && now - prev.lastSentAt < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - prev.lastSentAt)) / 1000);
      return res.status(429).json({ error: `Please wait ${wait}s before requesting another code.`, retryAfter: wait });
    }

    let windowStart = prev.windowStart || now;
    let count = prev.sendCount || 0;
    if (now - windowStart > 60 * 60 * 1000) {
      windowStart = now;
      count = 0;
    }
    if (count >= MAX_SENDS_PER_HOUR) {
      return res.status(429).json({ error: 'Too many codes requested. Please try again in an hour.' });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await ref.set({
      hash: hashCode(secret, uid, code),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      lastSentAt: now,
      windowStart,
      sendCount: count + 1
    });

    try {
      await sendVerificationEmail(email, code);
    } catch (err) {
      console.error('send-code email error:', err);
      // Let the user retry right away instead of waiting out the cooldown.
      await ref.set({ ...prev, lastSentAt: 0 }, { merge: true }).catch(() => {});
      return res.status(502).json({ error: 'We could not send the email right now. Please try again shortly.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-code error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
