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

export const verificationService = {
  sendCode: (email: string) => post('/api/send-code', { email: email.toLowerCase().trim() }),
  verifyCode: (email: string, code: string) =>
    post('/api/verify-code', { email: email.toLowerCase().trim(), code: code.trim() })
};
