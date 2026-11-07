import { MAX_ATTEMPTS, getServices, hashCode, isEmail, safeEqualHex } from './_lib.js';

// POST /api/verify-code  { email, code }
// Marks the account's email as verified. The account itself stays PENDING until an admin approves it.
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email || '').toLowerCase().trim();
  const code = String(req.body?.code || '').trim();
  if (!isEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter the 6-digit code from your email.' });
  }

  let services;
  try {
    services = getServices();
  } catch (err) {
    console.error('verify-code config error:', err);
    return res.status(500).json({ error: 'Verification service is not configured yet.' });
  }
  const { db, auth, secret } = services;

  const invalid = { error: 'That code is invalid or has expired. Request a new one.' };

  try {
    let uid: string;
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch {
      return res.status(400).json(invalid);
    }

    const codeRef = db.doc(`email_codes/${uid}`);
    const profileRef = db.doc(`profiles/${uid}`);

    // One transaction so parallel guesses can't beat the attempt counter.
    const outcome = await db.runTransaction(async (t) => {
      const snap = await t.get(codeRef);
      if (!snap.exists) return { status: 'invalid' as const };
      const data = snap.data()!;

      if (Date.now() > data.expiresAt) {
        t.delete(codeRef);
        return { status: 'invalid' as const };
      }
      if ((data.attempts || 0) >= MAX_ATTEMPTS) {
        t.delete(codeRef);
        return { status: 'locked' as const };
      }

      if (!safeEqualHex(String(data.hash), hashCode(secret, uid, code))) {
        const attempts = (data.attempts || 0) + 1;
        t.update(codeRef, { attempts });
        return { status: 'wrong' as const, left: MAX_ATTEMPTS - attempts };
      }

      t.update(profileRef, { emailVerified: true, emailVerifiedAt: new Date().toISOString() });
      t.delete(codeRef);
      return { status: 'ok' as const };
    });

    if (outcome.status === 'ok') return res.status(200).json({ ok: true });
    if (outcome.status === 'locked') {
      return res.status(429).json({ error: 'Too many wrong attempts. Please request a new code.' });
    }
    if (outcome.status === 'wrong') {
      return res.status(400).json({
        error: outcome.left > 0 ? `Incorrect code. ${outcome.left} attempt${outcome.left === 1 ? '' : 's'} left.` : 'Incorrect code. Please request a new one.'
      });
    }
    return res.status(400).json(invalid);
  } catch (err) {
    console.error('verify-code error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
