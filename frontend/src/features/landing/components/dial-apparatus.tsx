/**
 * The apparatus: a hand-built gauge over a 240° arc, 0 → 300 s, six
 * graduations. Not a glowing orb, not a screenshot, not a re-drawn phone —
 * it is the three limits this gateway actually enforces, drawn to scale.
 *
 * Night pulse only (3% over 4s, on the scale arc). It never rotates.
 *
 * The readouts are real text in the HTML next to the SVG rather than <text>
 * inside it: they inherit the page's typography, wrap naturally on a narrow
 * screen, and stay readable to assistive tech without an aria description.
 */

const CX = 100;
const CY = 100;
const R_ARC = 88;
const R_INNER = 78;
const R_NEEDLE = 62;
const SWEEP_DEG = 240;
const START_DEG = 210;

/** v (0–300 s) → point at radius r, angles measured counter-clockwise. */
function point(v: number, r: number) {
  const deg = START_DEG - (v / 300) * SWEEP_DEG;
  const rad = (deg * Math.PI) / 180;
  return {
    x: Number((CX + r * Math.cos(rad)).toFixed(2)),
    y: Number((CY - r * Math.sin(rad)).toFixed(2))
  };
}

const GRADUATIONS = [0, 60, 120, 180, 240, 300].map((v) => ({
  v,
  outer: point(v, R_ARC),
  inner: point(v, R_INNER)
}));

const ARC_START = point(0, R_ARC);
const ARC_END = point(300, R_ARC);
const NEEDLE_TIP = point(0, R_NEEDLE);

const READOUTS = [
  { key: 'ttl', value: '300 s' },
  { key: 'attempts', value: '3' },
  { key: 'throttle', value: '5 / phone · hour' }
];

export function DialApparatus() {
  return (
    <figure className='lm-dial'>
      <svg className='lm-dial__gauge' viewBox='10 10 180 142' aria-hidden='true' focusable='false'>
        <path
          className='lm-dial__arc lm-dial__emit'
          d={`M ${ARC_START.x} ${ARC_START.y} A ${R_ARC} ${R_ARC} 0 1 1 ${ARC_END.x} ${ARC_END.y}`}
        />
        {GRADUATIONS.map(({ v, outer, inner }) => (
          <line
            key={v}
            className={v % 60 === 0 ? 'lm-dial__tick lm-dial__tick--major' : 'lm-dial__tick'}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
          />
        ))}
        <line
          className='lm-dial__needle'
          x1={CX}
          y1={CY}
          x2={NEEDLE_TIP.x}
          y2={NEEDLE_TIP.y}
        />
        <circle className='lm-dial__hub' cx={CX} cy={CY} r='4' />
      </svg>
      <figcaption>
        <ul className='lm-dial__readouts'>
          {READOUTS.map(({ key, value }) => (
            <li key={key}>
              <span className='lm-dial__key'>{key}</span>
              <span className='lm-dial__val'>{value}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
