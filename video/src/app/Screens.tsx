import React, { type CSSProperties } from 'react';
import '../../../app/globals.css';
import { PEOPLE_COLORS, c } from '../look';
import { MODES, NAMES, FROM, PLAN, type Mode } from '../timing';
import { S } from '../geo';
import {
  BackIcon, ChevronIcon, ClockIcon, CopyIcon, LocateIcon, MODE_LABEL, MODE_SHAPES, ModeIcon, PLANS, PinIcon, PlanIcon, SearchIcon, ShareIcon, planTxt, type Plan,
} from '../ui/icons';
import { Mark } from '../ui/Mark';
import { enter } from '../ui/motion';
import { CHROME_H, SCREEN } from '../ui/Phone';

// The app's screens rebuilt with its own stylesheet (app/globals.css) and the same
// markup as its components. Every state comes in as props, driven by the frame.

const overrides = `
.dq-phone .app{max-width:none;padding:14px 16px 120px}
.dq-phone .top:not(.compact) h1{font-size:39px}
.dq-phone .sign-name{font-size:39px}
.dq-phone .bar{position:absolute}
.dq-phone .sheet{max-height:none}
`;
export const AppStyle = () => <style>{overrides}</style>;

const v = (o: Record<string, string | number>) => o as CSSProperties;

/* ---------- Plan ---------- */

export type PlanState = {
  scroll: number; // content scroll, CSS px
  rows: number[]; // 0..1 entrance of each person row
  yaniaFilled: boolean;
  plan: Plan | null;
  planPop: number; // 0..1 bounce of the chosen plan icon
  later: number; // 0..1 the "Más tarde" panel opening
  day: number; // index of the chosen day
  timeScroll: number; // scroll of the time strip, CSS px
  time: number | null; // chosen slot (minutes)
  headerMark: boolean; // false while the logo is still flying in
};

const DAYS = [['Hoy', 29], ['Mañana', 30], ['sáb', 31], ['dom', 1], ['lun', 2], ['mar', 3], ['mié', 4]] as const;
const SLOTS = Array.from({ length: (26 * 60 - 8 * 60) / 30 + 1 }, (_, k) => 8 * 60 + k * 30);
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const PlanScreen = ({ st }: { st: PlanState }) => {
  const people = NAMES.map((name, i) => {
    const filled = i < 3 || st.yaniaFilled;
    return { name: filled ? name : 'Persona 4', where: filled ? FROM[i] : null, mode: (filled ? MODES[i] : 'TRANSIT') as Mode, initial: filled ? name[0] : '4' };
  });
  const missing = !st.yaniaFilled;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: CHROME_H, right: 0, height: SCREEN.h - CHROME_H, overflow: 'hidden' }}>
        <div style={{ transform: `translateY(${-st.scroll}px)` }}>
          <div className="app">
            <header className="top">
              <span style={{ opacity: st.headerMark ? 1 : 0 }}><Mark size={50} /></span>
              <h1 style={{ opacity: st.headerMark ? 1 : 0 }}>¿Dónde quedamos?</h1>
              <p className="lede">El punto medio del mapa engaña. Buscamos el sitio donde <strong>todos tardáis lo mismo</strong>, cada uno con su transporte.</p>
            </header>
            <div className="view plan-view">
              <section className="block">
                <h2>Quién viene y desde dónde</h2>
                <ol className="people">
                  {people.map((p, i) => {
                    const t = st.rows[i];
                    if (t <= 0) return null;
                    return (
                      <li key={i} className="person" style={v({ '--c': PEOPLE_COLORS[i], height: 70 * Math.min(1, t * 1.4), opacity: Math.min(1, t * 1.6) })}>
                        <button type="button" className="person-btn" style={{ transform: `translateX(${(1 - t) * 40}px)` }}>
                          <span className="stop" style={{ transform: `scale(${Math.min(1, t * 1.3)})` }}>{p.initial}</span>
                          <span className="person-main">
                            <span className="person-name">{p.name}</span>
                            <span className={p.where ? 'person-where' : 'person-where missing'}>{p.where ?? '¿Desde dónde sale?'}</span>
                          </span>
                          <span className="person-mode"><ModeIcon mode={p.mode} /></span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <button type="button" className="add-person"><span>+</span>Añadir a alguien</button>
              </section>

              <section className="block">
                <h2>Qué plan</h2>
                <div className="plans">
                  {PLANS.map((p) => (
                    <button key={p.id} type="button" aria-checked={st.plan === p.id}>
                      <PlanIcon plan={p.id} style={st.plan === p.id ? { transform: `scale(${0.6 + 0.4 * st.planPop}) rotate(${-14 * (1 - st.planPop)}deg)` } : undefined} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="block">
                <h2>Cuándo</h2>
                <div className="when">
                  <div className="seg2">
                    <button type="button" aria-checked={st.later < 0.5}>Ahora</button>
                    <button type="button" aria-checked={st.later >= 0.5}>Más tarde</button>
                  </div>
                  {st.later > 0 ? (
                    <div className="when-later" style={{ height: 232 * st.later, opacity: st.later, overflow: st.later < 1 ? 'hidden' : 'visible' }}>
                      <div className="hstrip">
                        {DAYS.map(([name, num], d) => (
                          <button key={d} type="button" className="day" aria-checked={st.day === d}>
                            <span className="day-name">{name}</span>
                            <span className="day-num">{num}</span>
                          </button>
                        ))}
                      </div>
                      <div className="hstrip">
                        <div style={{ display: 'flex', gap: 8, transform: `translateX(${-st.timeScroll}px)` }}>
                          {SLOTS.map((m) => (
                            <React.Fragment key={m}>
                              {m === 24 * 60 && <span className="strip-sep">madrugada</span>}
                              <button type="button" className="slot" aria-checked={st.time === m}>{hhmm(m)}</button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      <p className="when-sum">
                        <ClockIcon />
                        <span><b>{`${st.day === 0 ? 'Hoy' : 'Mañana'} a las ${hhmm(st.time ?? 21 * 60 + 30)}`}</b>Con el transporte y el tráfico de esa hora.</span>
                      </p>
                    </div>
                  ) : (
                    <p className="hint">El metro de un domingo no es el de un martes a las 9: usamos los horarios y el tráfico del momento.</p>
                  )}
                </div>
              </section>
              <p className="privacy">No guardamos ninguna dirección. Se usan para calcular y se olvidan.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bar">
        <div className="bar-in">
          <button type="button" className={missing ? 'cta pending' : 'cta'}>
            {missing ? 'Falta desde dónde sale Persona 4' : 'Buscar el sitio justo'}
          </button>
        </div>
      </div>
    </>
  );
};

/* ---------- Ficha de una persona ---------- */

export type SheetState = { open: number; name: string; mode: Mode | null; query: string; caret: boolean; results: number };

export const PersonSheetView = ({ st }: { st: SheetState }) => {
  if (st.open <= 0) return null;
  const sheetH = SCREEN.h - 26;
  const typing = st.query.length >= 3;
  return (
    <div className="sheet-root">
      <div className="sheet-backdrop" style={{ opacity: st.open }} />
      <div className="sheet full" style={{ height: sheetH, transform: `translateY(${(1 - st.open) * (sheetH + 30)}px)` }}>
        <div className="sheet-grab"><span /></div>
        <div className="sheet-body ps" style={v({ '--c': PEOPLE_COLORS[3] })}>
          <div className="ps-head">
            <span className="stop big">{st.name ? st.name[0] : '4'}</span>
            <div className="ps-name" style={{ color: st.name ? c.ink : 'rgba(14,26,43,.5)' }}>{st.name || 'Persona 4'}</div>
            <button type="button" className="ps-done">Listo</button>
          </div>
          <p className="ps-label">Va en</p>
          <div className="ps-modes">
            {(['TRANSIT', 'DRIVE', 'BICYCLE', 'WALK'] as Mode[]).map((m) => (
              <button key={m} type="button" aria-checked={st.mode === m}>
                <ModeIcon mode={m} />
                <span>{MODE_LABEL[m]}</span>
              </button>
            ))}
          </div>
          <p className="ps-label">Sale de</p>
          <div className="ps-search">
            <SearchIcon />
            <div style={{ flex: 1, fontSize: 17, fontWeight: st.query ? 600 : 400, color: st.query ? c.ink : c.ink2 }}>
              {st.query || 'Calle, barrio o estación'}
              {st.caret && <span style={{ display: 'inline-block', width: 2, height: 20, marginLeft: 1, background: c.ink, verticalAlign: -3 }} />}
            </div>
          </div>
          <ul className="ps-results">
            {!typing && (
              <li><button type="button"><span className="ps-ico accent"><LocateIcon /></span><span>Usar mi ubicación actual<small>Si sale de donde estás ahora</small></span></button></li>
            )}
            {typing && st.results > 0 && (
              <li style={{ opacity: st.results }}><button type="button"><span className="ps-ico"><PinIcon /></span><span>El Cabanyal<small>Valencia, España</small></span></button></li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

/* ---------- Cargando ---------- */

export const LoaderView = ({ f, at, opacity }: { f: number; at: number; opacity: number }) => {
  const cyc = ((f - at) % 36 + 36) % 36; // the app loops its mark every ~1.2 s
  const line = (k: number) => Math.max(0, Math.min(1, (cyc - k * 4) / 14));
  const dot = Math.max(0, Math.min(1, (cyc - 16) / 6));
  const fade = cyc > 30 ? 1 - (cyc - 30) / 6 : 1;
  return (
    <div className="loader" style={{ opacity }}>
      <svg className="ld-mark" viewBox="0 0 48 48" style={{ opacity: fade }}>
        <g fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          {['M5 12h11l10 12', 'M5 24h21', 'M5 36h11l10-12'].map((d, k) => (
            <path key={d} d={d} stroke={['#E5352B', '#1F6FD1', '#12A150'][k]} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - line(k)} />
          ))}
        </g>
        <circle cx="33" cy="24" r={6.5 * (dot < 1 ? 1.25 * dot - 0.25 * dot * dot : 1)} fill="#FFD100" stroke={c.ink} strokeWidth="3" />
      </svg>
      <p className="ld-msg" style={{ opacity: enter(f, at + 4, 14), transform: `translateY(${(1 - enter(f, at + 4, 14)) * 8}px)` }}>Probando zonas entre vosotros…</p>
    </div>
  );
};

/* ---------- Resultados ---------- */

const best = S.options[0];
const mid = S.midpoint.times.map((t) => t.min);
const PRICE: Record<string, string> = { PRICE_LEVEL_INEXPENSIVE: '€', PRICE_LEVEL_MODERATE: '€€', PRICE_LEVEL_EXPENSIVE: '€€€', PRICE_LEVEL_VERY_EXPENSIVE: '€€€€' };
const FACTS = [best.type, PRICE[best.price], `${best.rating.toFixed(1).replace('.', ',')} ★ (${best.ratings})`];
const LINES = best.times.map((min, i) => ({ name: NAMES[i], mode: MODES[i], min, ghost: mid[i], color: PEOPLE_COLORS[i] }));
const scaleMax = Math.max(...mid, ...S.options.flatMap((o) => o.times));

// Same geometry as components/Diagram.tsx.
function layout(W: number) {
  const n = LINES.length, rowH = 50, top = 8, axisH = 24;
  const labelW = W < 400 ? 100 : 122;
  const end = W - 24;
  const maxT = Math.max(10, scaleMax, ...LINES.map((l) => Math.max(l.min, l.ghost ?? 0)));
  const step = maxT > 60 ? 20 : maxT > 30 ? 10 : 5;
  const axis = Math.ceil(maxT / step) * step;
  const k = (end - labelW - 16) / axis;
  const x = (m: number) => end - m * k;
  return { W, H: top + n * rowH + axisH, top, rowH, end, labelW, axis, step, x, ys: LINES.map((_, i) => top + i * rowH + rowH / 2) };
}

export const Diagram = ({ draw, ghosts, station }: { draw: number[]; ghosts: number; station: number }) => {
  const g = layout(330);
  return (
    <div className="diagram-box">
      <svg viewBox={`0 0 ${g.W} ${g.H}`} width={g.W} height={g.H}>
        {Array.from({ length: g.axis / g.step }, (_, k) => (k + 1) * g.step).map((val) => (
          <g key={val}>
            <line className="dg-grid" x1={g.x(val)} x2={g.x(val)} y1={g.top} y2={g.top + LINES.length * g.rowH} />
            <text className="dg-tick" x={g.x(val)} y={g.H - 6} textAnchor="middle">{val === g.axis ? `${val} min` : val}</text>
          </g>
        ))}
        {LINES.map((l, i) => {
          const x0 = g.x(l.min);
          const x1 = g.end + 6;
          const d = draw[i];
          return (
            <g key={i} style={v({ '--c': l.color })}>
              <text className="dg-name" x={0} y={g.ys[i] - 4}>{l.name}</text>
              <g className="dg-mode" transform={`translate(0 ${g.ys[i] + 3}) scale(.6)`}>{MODE_SHAPES[l.mode]}</g>
              <text className="dg-min" x={19} y={g.ys[i] + 15}>{`${Math.round(l.min * Math.min(1, d * 1.15))} min`}</text>
              <line className="dg-line" x1={x1 - (x1 - x0) * d} y1={g.ys[i]} x2={x1} y2={g.ys[i]} opacity={d > 0 ? 1 : 0} />
              <circle className="dg-ghost" cx={g.x(l.ghost)} cy={g.ys[i]} r={6} opacity={ghosts} />
              <circle className="dg-stop" cx={x1 - (x1 - x0) * d} cy={g.ys[i]} r={7 * Math.min(1, d * 3)} />
            </g>
          );
        })}
        <rect className="dg-station" x={g.end} y={g.top + 6 + (1 - station) * (LINES.length * g.rowH - 12) / 2} width={20} height={(LINES.length * g.rowH - 12) * station} rx={10} />
      </svg>
    </div>
  );
};

export type ResultState = { scroll: number; sign: number; nameAt: number; f: number; draw: number[]; ghosts: number; station: number; insight: number };

export const ResultScreen = ({ st, Flip }: { st: ResultState; Flip: React.ComponentType<{ text: string; f: number; at: number }> }) => (
  <>
    <div style={{ position: 'absolute', left: 0, top: CHROME_H, right: 0, height: SCREEN.h - CHROME_H, overflow: 'hidden' }}>
      <div style={{ transform: `translateY(${-st.scroll}px)` }}>
        <div className="app">
          <header className="top compact">
            <Mark size={34} />
            <h1>¿Dónde quedamos?</h1>
          </header>
          <div className="view results">
            <div className="res-top" style={{ opacity: st.sign, transform: `translateY(${(1 - st.sign) * 26}px)` }}>
              <button type="button" className="back"><BackIcon />Cambiar datos</button>
              <span className="res-when">Para {planTxt(PLAN)}, mañana a las 21:00</span>
            </div>
            <article className="sign" style={{ opacity: st.sign, transform: `translateY(${(1 - st.sign) * 40}px)` }}>
              <div className="sign-body">
                <p className="sign-label"><PlanIcon plan={PLAN} />Punto de encuentro</p>
                <h2 className="sign-name"><Flip text={best.name} f={st.f} at={st.nameAt} /></h2>
                <ul className="sign-facts">{FACTS.map((x) => <li key={x}>{x}</li>)}</ul>
                <p className="sign-line">Nadie tarda más de {best.justo.max} min. Diferencia: {best.justo.gap} min.</p>
                <button type="button" className="sign-more">Ver fotos e información <ChevronIcon /></button>
              </div>
            </article>
            <section className="diagram" style={{ opacity: st.sign }}>
              {/* A fresh SVG every frame: once the camera has zoomed, Chrome keeps the
                  tick labels laid out at the old scale, and the render tabs disagreed. */}
              <Diagram key={st.f} draw={st.draw} ghosts={st.ghosts} station={st.station} />
              <p className="insight" style={{ opacity: st.insight }}>
                En el punto medio del mapa, Yania tardaría {mid[3]} min y Jenny solo {mid[1]}. Aquí la diferencia baja a {best.justo.gap} min.
              </p>
              <div className="legend" style={{ opacity: st.insight }}>
                <span><svg viewBox="0 0 22 10"><line x1="3" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>Lo que tarda cada uno hasta aquí</span>
                <span><svg viewBox="0 0 14 14"><circle className="dg-ghost" cx="7" cy="7" r="5" /></svg>En el punto medio del mapa</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
    <div className="bar">
      <div className="bar-in">
        <button type="button" className="cta"><ShareIcon />Mandar al grupo</button>
        <button type="button" className="icon-btn"><CopyIcon /></button>
      </div>
    </div>
  </>
);
