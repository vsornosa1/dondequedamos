import React from 'react';
import { Composition, Still } from 'remotion';
import { Main } from './Main';
import { MapPlate } from './MapPlate';
import { PLATE } from './geo';
import { video } from './look';
import { TOTAL } from './timing';
import { Vuelve } from './vuelve/Vuelve';
import { V_TOTAL } from './vuelve/timing';

export const Root = () => (
  <>
    <Composition id="Main" component={Main} width={video.width} height={video.height} fps={video.fps} durationInFrames={TOTAL} defaultProps={{ music: true }} />
    {/* The relaunch clip (design/VUELVE.md). */}
    <Composition id="Vuelve" component={Vuelve} width={video.width} height={video.height} fps={video.fps} durationInFrames={V_TOTAL} defaultProps={{ music: true }} />
    {/* One-off map plates (need network); the film uses the saved PNGs. */}
    <Still id="MapNight" component={MapPlate} width={PLATE.w} height={PLATE.h} defaultProps={{ theme: 'night' as const }} />
    <Still id="MapDay" component={MapPlate} width={PLATE.w} height={PLATE.h} defaultProps={{ theme: 'day' as const }} />
  </>
);
