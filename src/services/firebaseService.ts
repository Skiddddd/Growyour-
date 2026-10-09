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
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { User, UserRole, Transaction, TransactionStatus, TransactionType, SystemConfig, SupportMessage, AccountStatus } from '../types';
import { INITIAL_CONFIG } from '../constants';

const PROFILES = 'profiles';
const TRANSACTIONS = 'transactions';
const CONFIG_COLLECTION = 'system_config';
const CONFIG_DOC = 'main';
const SUPPORT = 'support_messages';

// True while a sign-up is in progress, so background session checks don't
// react to the half-created account.
let signingUp = false;

export const PENDING_MESSAGE =
  'Your account is awaiting admin approval. You will be able to sign in once it has been approved.';
export const REJECTED_MESSAGE =
  'Your account application was not approved. Please contact support if you think this is a mistake.';

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
    accountStatus: (p?.accountStatus as AccountStatus) || 'APPROVED',
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
    method: t.method || 'SOL',
    date: toIso(t.date),
    planId: t.planId || null,
  };
}

function docToSupport(id: string, m: any): SupportMessage {
  return {
    id,
    userId: m.userId,
    userEmail: m.userEmail || '',
    userName: m.userName || '',
    sender: m.sender === 'ADMIN' ? 'ADMIN' : 'USER',
    text: m.text || '',
    imageData: typeof m.imageData === 'string' ? m.imageData : undefined,
    createdAt: toIso(m.createdAt),
    readByAdmin: Boolean(m.readByAdmin),
    readByUser: Boolean(m.readByUser),
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

    signingUp = true;
    try {
      let fbUser: FirebaseUser;
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        fbUser = cred.user;
      } catch (err) {
        throw friendlyAuthError(err);
      }

      // New accounts always start as PENDING until an admin approves them.
      const createdAt = new Date().toISOString();
      await setDoc(doc(db, PROFILES, fbUser.uid), {
        email: cleanEmail,
        fullName: cleanName,
        role: 'USER',
        balance: 0,
        isActive: true,
        accountStatus: 'PENDING',
        createdAt,
      });

      return {
        id: fbUser.uid,
        email: cleanEmail,
        fullName: cleanName,
        balance: 0,
        role: UserRole.USER,
        isActive: true,
        accountStatus: 'PENDING',
        createdAt,
      };
    } finally {
      // Never leave a pending account signed in.
      if (auth.currentUser) await fbSignOut(auth).catch(() => {});
      signingUp = false;
    }
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
        accountStatus: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, PROFILES, fbUser.uid), fresh);
        profile = fresh;
      } catch (err) {
        console.warn('Could not create missing profile:', err);
      }
    }

    const user = profileToUser(fbUser.uid, profile, fbUser, cleanEmail);
    if (user.role !== UserRole.ADMIN && user.accountStatus !== 'APPROVED') {
      await fbSignOut(auth);
      throw new Error(user.accountStatus === 'REJECTED' ? REJECTED_MESSAGE : PENDING_MESSAGE);
    }
    return user;
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
    if (signingUp) return null;

    // Wait for Firebase to restore any persisted session.
    await auth.authStateReady();
    const fbUser = auth.currentUser;
    if (!fbUser) return null;

    let profile: any;
    try {
      profile = await fetchProfile(fbUser.uid);
    } catch {
      // Network hiccup: keep the session; Firestore rules still protect the data.
      return profileToUser(fbUser.uid, null, fbUser);
    }
    if (!profile) return null;

    const user = profileToUser(fbUser.uid, profile, fbUser);
    if (user.role !== UserRole.ADMIN && user.accountStatus !== 'APPROVED') {
      await fbSignOut(auth).catch(() => {});
      return null;
    }
    return user;
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
          solAddress: data.solAddress || INITIAL_CONFIG.solAddress,
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
        solAddress: config.solAddress,
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

  async updateUser(
    userId: string,
    data: { role?: string; isActive?: boolean; balance?: number; accountStatus?: AccountStatus }
  ): Promise<void> {
    if (!db) return;

    const payload: Record<string, any> = {};
    if (data.role) payload.role = data.role;
    if (data.isActive !== undefined) payload.isActive = data.isActive;
    if (data.balance !== undefined) payload.balance = data.balance;
    if (data.accountStatus) payload.accountStatus = data.accountStatus;
    if (Object.keys(payload).length === 0) return;

    await updateDoc(doc(db, PROFILES, userId), payload);
  },
  // ---------- Customer support chat ----------

  // userId = a user's id for their own thread, or null for the admin inbox (all threads).
  subscribeSupportMessages(
    userId: string | null,
    onChange: (messages: SupportMessage[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    if (!db) return () => {};
    const col = collection(db, SUPPORT);
    const q = userId ? query(col, where('userId', '==', userId)) : query(col);
    return onSnapshot(
      q,
      (snap) => {
        // Sorted client-side so no composite index is required.
        const list = snap.docs
          .map((d) => docToSupport(d.id, d.data()))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        onChange(list);
      },
      (err) => {
        console.warn('Support chat listener error:', err);
        onError?.(err);
      }
    );
  },

  async sendSupportMessage(msg: {
    userId: string;
    userEmail: string;
    userName: string;
    sender: 'USER' | 'ADMIN';
    text: string;
    imageData?: string;
  }): Promise<void> {
    if (!db) throw new Error('Firebase is not configured.');
    const text = msg.text.trim().slice(0, 1000);
    if (!text && !msg.imageData) return;
    await addDoc(collection(db, SUPPORT), {
      userId: msg.userId,
      userEmail: msg.userEmail.toLowerCase().trim(),
      userName: msg.userName,
      sender: msg.sender,
      text,
      ...(msg.imageData ? { imageData: msg.imageData } : {}),
      createdAt: new Date().toISOString(),
      readByAdmin: msg.sender === 'ADMIN',
      readByUser: msg.sender === 'USER',
    });
  },

  async markSupportRead(ids: string[], field: 'readByAdmin' | 'readByUser'): Promise<void> {
    if (!db || ids.length === 0) return;
    const firestore = db;
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(firestore);
      ids.slice(i, i + 400).forEach((id) => batch.update(doc(firestore, SUPPORT, id), { [field]: true }));
      await batch.commit();
    }
  },
};
