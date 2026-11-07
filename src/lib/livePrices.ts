import { useEffect, useRef, useState } from 'react';

// Live crypto prices from Coinbase's free public market data (no API key needed).
export type CoinSymbol = 'BTC' | 'ETH' | 'SOL';
export const COINS: { symbol: CoinSymbol; name: string; product: string }[] = [
  { symbol: 'BTC', name: 'Bitcoin', product: 'BTC-USD' },
  { symbol: 'ETH', name: 'Ethereum', product: 'ETH-USD' },
  { symbol: 'SOL', name: 'Solana', product: 'SOL-USD' }
];

const REST = 'https://api.exchange.coinbase.com';
const WS_URL = 'wss://ws-feed.exchange.coinbase.com';

export interface LivePrice {
  price: number;
  open24h: number; // used to work out the 24h % change
}
export type PriceMap = Partial<Record<CoinSymbol, LivePrice>>;
export type FeedStatus = 'connecting' | 'live' | 'polling' | 'offline';

const symbolFor = (product: string) => COINS.find((c) => c.product === product)?.symbol;

async function fetchJson(path: string): Promise<any> {
  const res = await fetch(`${REST}${path}`);
  if (!res.ok) throw new Error(`Price feed error ${res.status}`);
  return res.json();
}

async function fetchSnapshot(): Promise<PriceMap> {
  const entries = await Promise.all(
    COINS.map(async (c) => {
      const stats = await fetchJson(`/products/${c.product}/stats`);
      const last = Number(stats.last);
      const open = Number(stats.open);
      return [c.symbol, { price: last, open24h: open || last }] as const;
    })
  );
  return Object.fromEntries(entries) as PriceMap;
}

// Real-time prices: WebSocket when available, falls back to polling every 8s.
export function useLivePrices(): { prices: PriceMap; status: FeedStatus; updatedAt: number | null } {
  const [prices, setPrices] = useState<PriceMap>({});
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const wsOk = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const applySnapshot = async () => {
      try {
        const snap = await fetchSnapshot();
        if (cancelled) return;
        setPrices((prev) => ({ ...prev, ...snap }));
        setUpdatedAt(Date.now());
        setStatus((s) => (wsOk.current ? 'live' : 'polling'));
      } catch {
        if (!cancelled && !wsOk.current) setStatus('offline');
      }
    };

    const connect = () => {
      if (cancelled || typeof WebSocket === 'undefined') return;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        return;
      }
      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            type: 'subscribe',
            product_ids: COINS.map((c) => c.product),
            channels: ['ticker']
          })
        );
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type !== 'ticker') return;
          const sym = symbolFor(msg.product_id);
          const price = Number(msg.price);
          if (!sym || !isFinite(price)) return;
          wsOk.current = true;
          setPrices((prev) => ({
            ...prev,
            [sym]: { price, open24h: Number(msg.open_24h) || prev[sym]?.open24h || price }
          }));
          setUpdatedAt(Date.now());
          setStatus('live');
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        wsOk.current = false;
        if (cancelled) return;
        setStatus((s) => (s === 'live' ? 'polling' : s));
        reconnectTimer = setTimeout(connect, 4000);
      };
      ws.onerror = () => ws?.close();
    };

    applySnapshot();
    connect();
    // Polling runs always but is cheap; it keeps prices fresh if the socket drops.
    pollTimer = setInterval(() => {
      if (!wsOk.current) applySnapshot();
    }, 8000);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
      ws?.close();
    };
  }, []);

  return { prices, status, updatedAt };
}

export type ChartRange = '1H' | '24H' | '7D';
const RANGE_CFG: Record<ChartRange, { granularity: number; points: number }> = {
  '1H': { granularity: 60, points: 60 },
  '24H': { granularity: 900, points: 96 },
  '7D': { granularity: 3600, points: 168 }
};

export interface Candle {
  time: number; // unix seconds
  price: number;
}

// Historical candles for the chart (refreshed every minute; the newest point is kept live by the caller).
export function useCandles(symbol: CoinSymbol, range: ChartRange) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const product = COINS.find((c) => c.symbol === symbol)!.product;
    const { granularity, points } = RANGE_CFG[range];

    const load = async () => {
      try {
        const end = new Date();
        const start = new Date(end.getTime() - granularity * points * 1000);
        const rows: number[][] = await fetchJson(
          `/products/${product}/candles?granularity=${granularity}&start=${start.toISOString()}&end=${end.toISOString()}`
        );
        if (cancelled) return;
        // Rows are [time, low, high, open, close, volume], newest first.
        const list = rows
          .map((r) => ({ time: r[0], price: Number(r[4]) }))
          .sort((a, b) => a.time - b.time);
        setCandles(list);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol, range]);

  return { candles, loading, failed };
}

export const formatUsd = (n: number) =>
  n >= 1000
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 5 : 2 });
