import React from 'react';
import { formatUsd, useLivePrices } from '../lib/livePrices';

// Small self-contained live BTC price for the landing page.
export const LiveBtcPrice: React.FC = () => {
  const { prices } = useLivePrices();
  const btc = prices.BTC;
  return (
    <span className="text-xs font-mono font-bold text-white">
      {btc ? formatUsd(btc.price).replace(/\.\d+$/, '') : '—'}
    </span>
  );
};

export default LiveBtcPrice;
