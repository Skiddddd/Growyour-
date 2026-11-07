// Calls the server functions in /api that email and check the 6-digit code.
async function post(path: string, body: Record<string, string>): Promise<void> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('Network error. Please check your connection and try again.');
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !data?.ok) {
    if (data?.error) throw new Error(data.error);
    throw new Error('Verification service is unavailable right now. Please try again later.');
  }
}

// Admin-only: emails the user that their account was approved.
export async function notifyApproved(userId: string, idToken: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/notify-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ userId })
    });
  } catch {
    throw new Error('Network error.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || !data?.ok) throw new Error(data?.error || 'Email service is unavailable.');
}

export const verificationService = {
  sendCode: (email: string) => post('/api/send-code', { email: email.toLowerCase().trim() }),
  verifyCode: (email: string, code: string) =>
    post('/api/verify-code', { email: email.toLowerCase().trim(), code: code.trim() })
};
