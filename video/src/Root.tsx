import React from 'react';
import { Composition, Still } from 'remotion';
import { Main } from './Main';
import { MapPlate } from './MapPlate';
import { PLATE } from './geo';
import { video } from './look';
import { TOTAL } from './timing';

export const Root = () => (
  <>
    <Composition id="Main" component={Main} width={video.width} height={video.height} fps={video.fps} durationInFrames={TOTAL} defaultProps={{ music: true }} />
    {/* One-off map plates (need network); the film uses the saved PNGs. */}
    <Still id="MapNight" component={MapPlate} width={PLATE.w} height={PLATE.h} defaultProps={{ theme: 'night' as const }} />
    <Still id="MapDay" component={MapPlate} width={PLATE.w} height={PLATE.h} defaultProps={{ theme: 'day' as const }} />
  </>
);
