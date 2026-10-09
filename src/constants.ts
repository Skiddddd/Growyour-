import { InvestmentPlan, SystemConfig } from './types';

export const INITIAL_PLANS: InvestmentPlan[] = [
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
];

export const INITIAL_CONFIG: SystemConfig = {
  btcAddress: 'bc1qynty8rdg8448dektk7yesd9ph0w08tfy7dav3y',
  ethAddress: '0xf4059C384bAa6d60E426F91681F1e62A830E4Ec9',
  // Set the real Solana deposit address in Admin > System Config.
  solAddress: ''
};

export const STORAGE_KEY = 'nexus_crypto_db_v1';
export const REMEMBERED_EMAIL_KEY = 'nexus_remembered_email';
export const TOKEN_KEY = 'nexus_auth_token';
