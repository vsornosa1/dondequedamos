import React from 'react';
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { c } from './look';
import { K, T, TOTAL } from './timing';
import { Fonts, Grain } from './ui/Base';
import { AppStyle } from './app/Screens';
import { NightScene } from './scenes/Night';
import { LogoScene } from './scenes/Logo';
import { DemoScene } from './scenes/Demo';
import { PayoffScene } from './scenes/Payoff';
import { EndScene } from './scenes/End';

// Scenes read the global frame and decide for themselves when they are on screen,
// so carried transitions can overlap without Sequence offsets.
export const Main = ({ music = true }: { music?: boolean }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: c.ink }}>
      <Fonts />
      <AppStyle />
      {f >= T.logo.from + 30 && f < K.end.wipe + 40 && <AbsoluteFill style={{ background: c.paper }} />}
      {f < T.logo.from + 40 && <NightScene f={f} />}
      {f >= T.logo.from - 2 && f < T.logo.from + 60 && <LogoScene f={f} layer="back" />}
      {f >= K.payoff.map && f < K.end.wipe + 40 && <PayoffScene f={f} />}
      {f >= K.logo.fly - 2 && f < K.payoff.map + 34 && <DemoScene f={f} />}
      {f >= T.logo.from && f < T.people.from + 40 && <LogoScene f={f} layer="front" />}
      {f >= K.end.wipe && <EndScene f={f} />}
      <Grain />
      {music && (
        <Audio
          src={staticFile('music.wav')}
          volume={(fr) => interpolate(fr, [TOTAL - 40, TOTAL - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
    </AbsoluteFill>
  );
};
