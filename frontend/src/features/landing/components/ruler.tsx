const TICKS = 61; // 0 → 300 s in 5 s steps
const MAJOR_EVERY = 12; // every 60 s

/**
 * The code lifetime as a graduated scale: 0 to 300 seconds, a taller
 * graduation every minute.
 *
 * This is a *scale*, deliberately — not a delivery-latency envelope. The repo
 * holds no latency data, and drawing an invented histogram would be a
 * fabricated metric.
 */
export function Ruler() {
  return (
    <figure className='lm-ruler'>
      <p className='lm-ruler__caption'>code lifetime, in seconds</p>
      <div className='lm-ruler__ticks' aria-hidden='true'>
        {Array.from({ length: TICKS }, (_, i) => (
          <span
            key={i}
            className={
              i % MAJOR_EVERY === 0 ? 'lm-ruler__tick lm-ruler__tick--major' : 'lm-ruler__tick'
            }
          />
        ))}
      </div>
      <div className='lm-ruler__scale'>
        <span>0 s</span>
        <span>150 s</span>
        <span>300 s</span>
      </div>
    </figure>
  );
}
