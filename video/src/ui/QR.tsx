import React from 'react';
import QRCode from 'qrcode';

// A QR code drawn as one SVG path, computed at render time (no network, deterministic).
export const QR = ({ text, size, color = '#0E1A2B' }: { text: string; size: number; color?: string }) => {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges" style={{ display: 'block' }}>
      <path d={d} fill={color} />
    </svg>
  );
};
