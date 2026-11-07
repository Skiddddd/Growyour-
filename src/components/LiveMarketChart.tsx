import React, { useMemo, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { COINS, ChartRange, CoinSymbol, FeedStatus, PriceMap, formatUsd, useCandles } from '../lib/livePrices';

interface Props {
  prices: PriceMap;
  status: FeedStatus;
}

const STATUS_LABEL: Record<FeedStatus, { text: string; cls: string }> = {
  live: { text: 'LIVE', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  polling: { text: 'UPDATING', cls: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
  connecting: { text: 'CONNECTING', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  offline: { text: 'OFFLINE', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/20' }
};

export const LiveMarketChart: React.FC<Props> = ({ prices, status }) => {
  const [symbol, setSymbol] = useState<CoinSymbol>('BTC');
  const [range, setRange] = useState<ChartRange>('24H');
  const { candles, loading, failed } = useCandles(symbol, range);

  const live = prices[symbol];
  const change = live ? ((live.price - live.open24h) / live.open24h) * 100 : null;
  const up = (change ?? 0) >= 0;
  const color = up ? '#10b981' : '#f43f5e';

  // Historical candles with the newest point kept in sync with the live price.
  const data = useMemo(() => {
    if (candles.length === 0) return [];
    const list = candles.map((c) => ({ time: c.time, price: c.price }));
    if (live) list.push({ time: Math.floor(Date.now() / 1000), price: live.price });
    return list;
  }, [candles, live?.price]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTick = (t: number) => {
    const d = new Date(t * 1000);
    return range === '7D'
      ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const badge = STATUS_LABEL[status];

  return (
    <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Live Market Chart</h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.cls}`}>
              {status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1 align-middle"></span>}
              {badge.text}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{live ? formatUsd(live.price) : '—'}</span>
            {change !== null && (
              <span className={`text-xs font-bold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}% (24h)
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {COINS.map((c) => (
              <button
                key={c.symbol}
                onClick={() => setSymbol(c.symbol)}
                className={`px-3 py-1 rounded font-semibold transition ${
                  symbol === c.symbol ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {c.symbol}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(['1H', '24H', '7D'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded font-semibold transition ${
                  range === r ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-64 sm:h-72 w-full relative">
        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            {loading ? 'Loading live market data…' : failed ? 'Market data is unavailable right now. Retrying…' : 'No data'}
          </div>
        )}
        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="liveArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={formatTick} minTickGap={40} />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                width={64}
                tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v).toLocaleString()}` : `$${Number(v).toFixed(2)}`)}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                labelFormatter={(t) => new Date(Number(t) * 1000).toLocaleString()}
                formatter={(v: any) => [formatUsd(Number(v)), symbol]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={2.5}
                fill="url(#liveArea)"
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-[10px] text-slate-500 mt-2">Market prices from public exchange data. Prices are for reference only.</p>
    </div>
  );
};

export default LiveMarketChart;
