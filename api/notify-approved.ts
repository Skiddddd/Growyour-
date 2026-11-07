import { getServices, sendApprovalEmail } from './_lib.js';

// POST /api/notify-approved  { userId }   (Authorization: Bearer <admin's Firebase ID token>)
// Sends the "your account is approved" email. Only a signed-in admin can call it, and each
// account is emailed once.
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = String(req.body?.userId || '').trim();
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  if (!userId || userId.length > 128 || userId.includes('/')) return res.status(400).json({ error: 'Invalid user.' });

  let services;
  try {
    services = getServices();
  } catch (err) {
    console.error('notify-approved config error:', err);
    return res.status(500).json({ error: 'Email service is not configured yet.' });
  }
  const { db, auth } = services;

  try {
    let callerUid: string;
    try {
      callerUid = (await auth.verifyIdToken(token)).uid;
    } catch {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    const caller = (await db.doc(`profiles/${callerUid}`).get()).data();
    if (!caller || caller.role !== 'ADMIN') return res.status(403).json({ error: 'Admins only.' });

    const targetRef = db.doc(`profiles/${userId}`);
    const target = (await targetRef.get()).data();
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.accountStatus !== 'APPROVED') {
      return res.status(409).json({ error: 'This account is not approved.' });
    }
    if (target.welcomeEmailSentAt) return res.status(200).json({ ok: true, alreadySent: true });
    if (!target.email) return res.status(409).json({ error: 'This account has no email address.' });

    try {
      await sendApprovalEmail(String(target.email), String(target.fullName || ''));
    } catch (err) {
      console.error('notify-approved email error:', err);
      return res.status(502).json({ error: 'The approval email could not be sent.' });
    }

    await targetRef.update({ welcomeEmailSentAt: new Date().toISOString() });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('notify-approved error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
