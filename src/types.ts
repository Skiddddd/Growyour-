export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED'
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  INVESTMENT = 'INVESTMENT'
}

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  balance: number;
  role: UserRole;
  isActive?: boolean;
  accountStatus?: AccountStatus;
  externalWallets?: {
    btc?: string;
    eth?: string;
    usdt?: string;
  };
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  userEmail: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  date: string;
  method: string;
  planId?: string | null;
}

export interface InvestmentPlan {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  dailyRoi: number;
  durationDays: number;
  risk?: string;
  strategy?: string;
}

export interface SystemConfig {
  btcAddress: string;
  ethAddress: string;
  usdtAddress: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  transactions: Transaction[];
  plans: InvestmentPlan[];
  systemConfig: SystemConfig;
}

export interface SupportMessage {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  sender: 'USER' | 'ADMIN';
  text: string;
  createdAt: string;
  readByAdmin: boolean;
  readByUser: boolean;
}
