import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { User, UserRole, Transaction, TransactionStatus, TransactionType, SystemConfig } from '../types';
import { INITIAL_CONFIG } from '../constants';

const PROFILES = 'profiles';
const TRANSACTIONS = 'transactions';
const CONFIG_COLLECTION = 'system_config';
const CONFIG_DOC = 'main';

// Translate Firebase auth error codes into the messages the UI already checks for.
function friendlyAuthError(err: any): Error {
  const code: string = err?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return new Error('User already registered');
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return new Error('Invalid login credentials');
    case 'auth/invalid-email':
      return new Error('Please enter a valid email address.');
    case 'auth/weak-password':
      return new Error('Password must be at least 6 characters long.');
    case 'auth/too-many-requests':
      return new Error('Too many attempts. Please wait a moment and try again.');
    case 'auth/network-request-failed':
      return new Error('Network error. Please check your connection and try again.');
    default:
      return new Error(err?.message || 'Authentication failed. Please try again.');
  }
}

function toIso(value: any): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  return new Date(value).toISOString();
}

function profileToUser(uid: string, p: any, fbUser?: FirebaseUser | null, fallbackEmail = ''): User {
  const email = p?.email || fbUser?.email || fallbackEmail;
  return {
    id: uid,
    email,
    fullName: p?.fullName || fbUser?.displayName || (email ? email.split('@')[0] : 'User'),
    balance: Number(p?.balance) || 0,
    role: p?.role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER,
    isActive: p?.isActive ?? true,
    createdAt: toIso(p?.createdAt || fbUser?.metadata?.creationTime),
  };
}

function docToTransaction(id: string, t: any): Transaction {
  return {
    id,
    userId: t.userId,
    userEmail: t.userEmail || '',
    type: t.type as TransactionType,
    amount: Number(t.amount) || 0,
    status: t.status as TransactionStatus,
    method: t.method || 'USDT',
    date: toIso(t.date),
    planId: t.planId || null,
  };
}

async function fetchProfile(uid: string) {
  if (!db) return null;
  const snap = await getDoc(doc(db, PROFILES, uid));
  return snap.exists() ? snap.data() : null;
}

export const firebaseService = {
  isAvailable: () => isFirebaseConfigured && Boolean(auth) && Boolean(db),

  async signUp(fullName: string, email: string, password?: string): Promise<User> {
    if (!auth || !db) throw new Error('Firebase is not configured.');

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim() || cleanEmail.split('@')[0];
    const pass = password || 'Default@123';

    let fbUser: FirebaseUser;
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      fbUser = cred.user;
    } catch (err) {
      throw friendlyAuthError(err);
    }

    // Create the profile document (role is always USER here; admins are promoted manually).
    const createdAt = new Date().toISOString();
    await setDoc(doc(db, PROFILES, fbUser.uid), {
      email: cleanEmail,
      fullName: cleanName,
      role: 'USER',
      balance: 0,
      isActive: true,
      createdAt,
    });

    return {
      id: fbUser.uid,
      email: cleanEmail,
      fullName: cleanName,
      balance: 0,
      role: UserRole.USER,
      isActive: true,
      createdAt,
    };
  },

  async signIn(email: string, password?: string): Promise<User> {
    if (!auth || !db) throw new Error('Firebase is not configured.');

    const cleanEmail = email.toLowerCase().trim();
    const pass = password || 'Default@123';

    let fbUser: FirebaseUser;
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      fbUser = cred.user;
    } catch (err) {
      throw friendlyAuthError(err);
    }

    let profile = await fetchProfile(fbUser.uid).catch(() => null);

    // Self-heal: accounts created outside the app may not have a profile yet.
    if (!profile) {
      const fresh = {
        email: cleanEmail,
        fullName: fbUser.displayName || cleanEmail.split('@')[0],
        role: 'USER',
        balance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, PROFILES, fbUser.uid), fresh);
        profile = fresh;
      } catch (err) {
        console.warn('Could not create missing profile:', err);
      }
    }

    return profileToUser(fbUser.uid, profile, fbUser, cleanEmail);
  },

  async signOut(): Promise<void> {
    if (!auth) return;
    await fbSignOut(auth);
  },

  // Firebase sends the user an email with a secure reset link.
  async sendPasswordReset(email: string): Promise<void> {
    if (!auth) throw new Error('Firebase is not configured.');
    try {
      await sendPasswordResetEmail(auth, email.toLowerCase().trim());
    } catch (err) {
      throw friendlyAuthError(err);
    }
  },

  async getCurrentUser(): Promise<User | null> {
    if (!auth || !db) return null;

    // Wait for Firebase to restore any persisted session.
    await auth.authStateReady();
    const fbUser = auth.currentUser;
    if (!fbUser) return null;

    const profile = await fetchProfile(fbUser.uid).catch(() => null);
    return profileToUser(fbUser.uid, profile, fbUser);
  },

  async getTransactions(userId?: string, isAdmin = false, _userEmail?: string): Promise<Transaction[]> {
    if (!db) return [];

    try {
      const col = collection(db, TRANSACTIONS);
      let snap;
      if (isAdmin) {
        snap = await getDocs(col);
      } else if (userId) {
        snap = await getDocs(query(col, where('userId', '==', userId)));
      } else {
        return [];
      }

      // Sorted client-side so no composite Firestore index is required.
      return snap.docs
        .map((d) => docToTransaction(d.id, d.data()))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err) {
      console.warn('Failed to load transactions:', err);
      return [];
    }
  },

  async createTransaction(tx: {
    userId: string;
    userEmail: string;
    type: TransactionType;
    amount: number;
    method: string;
    planId?: string | null;
  }): Promise<Transaction> {
    if (!auth || !db) throw new Error('Firebase is not configured.');

    // Always bind the transaction to the signed-in user (enforced by security rules too).
    const uid = auth.currentUser?.uid || tx.userId;
    const date = new Date().toISOString();

    const payload = {
      userId: uid,
      userEmail: tx.userEmail.toLowerCase().trim(),
      type: tx.type,
      amount: tx.amount,
      method: tx.method,
      status: TransactionStatus.PENDING,
      planId: tx.planId || null,
      date,
    };

    const ref = await addDoc(collection(db, TRANSACTIONS), payload);
    return docToTransaction(ref.id, payload);
  },

  async updateTransactionStatus(id: string, status: TransactionStatus): Promise<void> {
    if (!db) return;
    const firestore = db;

    // Atomic: status change and balance adjustment succeed or fail together.
    await runTransaction(firestore, async (t) => {
      const txRef = doc(firestore, TRANSACTIONS, id);
      const txSnap = await t.get(txRef);
      if (!txSnap.exists()) throw new Error('Transaction not found.');
      const tx = txSnap.data();

      let profileRef: ReturnType<typeof doc> | null = null;
      let currentBalance = 0;
      const shouldAdjust =
        status === TransactionStatus.COMPLETED && tx.status !== TransactionStatus.COMPLETED;

      if (shouldAdjust) {
        profileRef = doc(firestore, PROFILES, tx.userId);
        const profileSnap = await t.get(profileRef);
        currentBalance = Number(profileSnap.data()?.balance) || 0;
      }

      t.update(txRef, { status });

      if (shouldAdjust && profileRef) {
        let newBalance = currentBalance;
        if (tx.type === TransactionType.DEPOSIT) {
          newBalance += Number(tx.amount);
        } else if (tx.type === TransactionType.WITHDRAWAL) {
          newBalance = Math.max(0, currentBalance - Number(tx.amount));
        }
        t.update(profileRef, { balance: newBalance });
      }
    });
  },

  async getSystemConfig(): Promise<SystemConfig> {
    if (!db) return INITIAL_CONFIG;

    try {
      const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC));
      if (snap.exists()) {
        const data = snap.data();
        return {
          btcAddress: data.btcAddress || INITIAL_CONFIG.btcAddress,
          ethAddress: data.ethAddress || INITIAL_CONFIG.ethAddress,
          usdtAddress: data.usdtAddress || INITIAL_CONFIG.usdtAddress,
        };
      }
    } catch {
      // return default
    }
    return INITIAL_CONFIG;
  },

  async updateSystemConfig(config: SystemConfig): Promise<void> {
    if (!db) return;
    await setDoc(
      doc(db, CONFIG_COLLECTION, CONFIG_DOC),
      {
        btcAddress: config.btcAddress,
        ethAddress: config.ethAddress,
        usdtAddress: config.usdtAddress,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  },

  async getUsers(): Promise<User[]> {
    if (!db) return [];

    try {
      const snap = await getDocs(collection(db, PROFILES));
      return snap.docs.map((d) => profileToUser(d.id, d.data()));
    } catch (err) {
      console.warn('Failed to load users:', err);
      return [];
    }
  },

  async updateUser(userId: string, data: { role?: string; isActive?: boolean; balance?: number }): Promise<void> {
    if (!db) return;

    const payload: Record<string, any> = {};
    if (data.role) payload.role = data.role;
    if (data.isActive !== undefined) payload.isActive = data.isActive;
    if (data.balance !== undefined) payload.balance = data.balance;
    if (Object.keys(payload).length === 0) return;

    await updateDoc(doc(db, PROFILES, userId), payload);
  },
};
