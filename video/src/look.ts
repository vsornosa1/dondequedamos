import { useVideoConfig } from 'remotion';

// The look comes from the app itself (app/globals.css, components/brand.tsx):
// station signage for a meeting point. Each person is a coloured line; yellow
// only ever marks the meeting point.
export const video = { width: 1080, height: 1350, fps: 30 };

export const c = {
  paper: '#F0F0EA', // the product's ground
  panel: '#FFFFFF',
  ink: '#0E1A2B', // text, and the night ground of the problem and the end card
  ink2: '#4A5565',
  rule: '#D9DAD1',
  tint: '#E6E6DE',
  signal: '#FFD100', // the meeting point, nothing else
  danger: '#A8261C',
  night2: '#1A2A42', // lines and plates on the night ground
  nightText: '#C9D2DF',
};

// Vicent, Jenny, Ángel, Yania: the app's first four line colours.
export const PEOPLE_COLORS = ['#E5352B', '#1F6FD1', '#12A150', '#8B4FD3'];

export const font = '"Overpass", system-ui, sans-serif';
export const mono = '"Overpass Mono", ui-monospace, monospace';

// Title-safe margin for 1080 wide.
export const SAFE_X = 72;

export const useLayout = () => {
  const { width, height } = useVideoConfig();
  return { W: width, H: height, V: height > width, cx: width / 2, cy: height / 2 };
};
