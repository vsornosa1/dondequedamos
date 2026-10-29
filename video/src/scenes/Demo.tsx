import React from 'react';
import { AbsoluteFill } from 'remotion';
import { K, T } from '../timing';
import { S } from '../geo';
import { ChatScreen } from '../app/Chat';
import { LoaderView, PersonSheetView, PlanScreen, ResultScreen, type PlanState } from '../app/Screens';
import { Tap } from '../ui/Base';
import { Caption } from '../ui/Caption';
import { Flip } from '../ui/Mark';
import { Phone, SCREEN, toFrame } from '../ui/Phone';
import { enter, glide, lerp, pop, typed } from '../ui/motion';

// The app itself, on the phone: who is coming, plan and time, the fair place, and
// the message to the group. One phone, its screens changing with the frame.

const NameFlip = ({ text, f, at }: { text: string; f: number; at: number }) => <Flip text={text} f={f} at={at} stagger={1.1} dur={11} />;

// Where the finger lands on the phone screen (CSS px), checked against stills.
const CTA_Y = SCREEN.h - 39;
const SPOT = {
  row4: { x: 190, y: 459 },
  walk: { x: 330, y: 212 },
  pick: { x: 150, y: 379 },
  canas: { x: 62, y: 294 },
  cenar: { x: 195, y: 294 },
  later: { x: 274, y: 444 },
  day: { x: 139, y: 412 },
  time: { x: 195, y: 484 },
  search: { x: 195, y: CTA_Y },
  share: { x: 160, y: CTA_Y },
};

const planState = (f: number): PlanState => {
  const scrollPeople = lerp(glide(f, K.people.rows[2] - 6, 24), 0, 118);
  const scrollPlan = glide(f, K.plan.scroll, 26);
  const scrollWhen = glide(f, K.plan.later + 4, 20);
  return {
    scroll: scrollPeople + lerp(scrollPlan, 0, 368) + lerp(scrollWhen, 0, 120),
    rows: K.people.rows.map((r) => enter(f, r, 16)),
    yaniaFilled: f >= K.people.done,
    // A first tap on Cañas, then they change their mind: Cenar.
    plan: f >= K.plan.cenar ? 'cenar' : f >= K.plan.canas ? 'canas' : null,
    planPop: pop(f, f >= K.plan.cenar ? K.plan.cenar : K.plan.canas, 16, 3),
    later: enter(f, K.plan.later + 2, 18),
    day: f >= K.plan.day ? 1 : 0,
    timeScroll: lerp(glide(f, K.plan.timeScroll, 16), 2088, 2006),
    time: f >= K.plan.time ? 21 * 60 : 21 * 60 + 30,
    headerMark: f >= K.logo.fly + 36,
  };
};

export const DemoScene = ({ f }: { f: number }) => {
  const rise = (1 - glide(f, K.logo.fly + 2, 36)) * 1100;
  const drop = glide(f, K.payoff.map, 30) * 1150;
  const sheetOpen = enter(f, K.people.sheet, 18) * (1 - enter(f, K.people.close, 14));
  const loader = enter(f, K.loader.start, 10) * (1 - enter(f, K.result.sign - 4, 10));
  const showResult = f >= K.result.sign - 4;
  const chatIn = glide(f, K.share.chat, 22);

  // Camera: a push so the sign reads, then still while the sign and the diagram are
  // read (a slow zoom here made the small text shimmer frame to frame).
  const zSign = glide(f, K.result.push, 30) * (1 - glide(f, K.result.scroll - 14, 22));
  const cam = { s: 1 + 0.16 * zSign, x: 540, y: 330 };

  const resultScroll = lerp(glide(f, K.result.scroll, 26), 0, 300);
  const draw = [0, 1, 2, 3].map((i) => glide(f, K.result.lines + i * 5, 22));
  const y = rise + drop;

  const taps: [number, { x: number; y: number }][] = [
    [K.people.tap, SPOT.row4], [K.people.mode, SPOT.walk], [K.people.pick, SPOT.pick],
    [K.plan.canas, SPOT.canas], [K.plan.cenar, SPOT.cenar], [K.plan.later, SPOT.later], [K.plan.day, SPOT.day], [K.plan.time, SPOT.time],
    [K.plan.search, SPOT.search], [K.share.tap, SPOT.share],
  ];

  return (
    <AbsoluteFill>
      <Phone cam={cam} y={y} url={chatIn > 0.5 ? '' : 'dondequedamos.app'} time={f > K.share.chat ? '19:44' : '19:42'}>
        {!showResult && <PlanScreen st={planState(f)} />}
        <PersonSheetView st={{
          open: sheetOpen,
          name: typed('Yania', f, K.people.name, 3),
          mode: f >= K.people.mode ? 'WALK' : 'TRANSIT',
          query: typed('Cabany', f, K.people.type, 3),
          caret: f >= K.people.type - 8 && f < K.people.pick && Math.floor(f / 8) % 2 === 0,
          results: enter(f, K.people.suggest, 8),
        }} />
        {loader > 0 && <LoaderView f={f} at={K.loader.start} opacity={loader} />}
        {showResult && (
          <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-120 * chatIn}px)`, opacity: 1 - 0.4 * chatIn }}>
            <ResultScreen Flip={NameFlip} st={{
              f, scroll: resultScroll, sign: enter(f, K.result.sign, 20), nameAt: K.result.sign + 6, draw,
              ghosts: enter(f, K.result.lines + 24, 14), station: pop(f, K.result.lines + 28, 14, 2.2), insight: enter(f, K.result.lines + 34, 16),
            }} />
          </div>
        )}
        {chatIn > 0 && (
          <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - chatIn) * 400}px)`, boxShadow: '-12px 0 30px rgba(14,26,43,.2)' }}>
            <ChatScreen
              sent={enter(f, K.share.sent, 16)}
              replies={K.share.replies.map((r) => enter(f, r, 12))}
              scroll={lerp(glide(f, K.share.replies[0] - 4, 20), 0, 60) + lerp(glide(f, K.share.replies[1] - 4, 20), 0, 60) + lerp(glide(f, K.share.replies[2] - 4, 20), 0, 66)}
            />
          </div>
        )}
      </Phone>

      {taps.map(([at, p], k) => {
        const q = toFrame(p.x, p.y);
        return <Tap key={k} f={f} at={at} x={q.x} y={q.y + y} scale={1.3} />;
      })}

      <Caption f={f} step={1} text="Apunta quién viene y desde dónde." at={K.people.captionA} out={K.people.captionB - 10} />
      <Caption f={f} text="Cada uno, con su transporte." at={K.people.captionB} out={T.people.to - 6} />
      <Caption f={f} step={2} text="Elige el plan y la hora." at={K.plan.caption} out={K.loader.start - 10} />
      <Caption f={f} step={3} text="Y te da el sitio más justo." at={K.result.caption} out={K.result.scroll} />
      <Caption f={f} text={`La diferencia baja de ${S.midpoint.stats.gap} a ${S.options[0].justo.gap} min.`} at={K.result.captionB} out={K.result.out} />
      <Caption f={f} step={4} text="Mándalo al grupo y listo." at={K.share.caption} out={T.share.to - 10} />
    </AbsoluteFill>
  );
};
