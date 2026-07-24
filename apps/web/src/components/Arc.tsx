import { cn } from '@/lib/cn';

interface ArcProps {
  /** Degrees of the sweep, 0–180. Range of motion is measured in degrees; this
   *  motif exists because that measurement is the language of the practice. */
  degrees: number;
  label?: string;
  className?: string;
  tone?: 'clinic' | 'balm';
}

const R = 46;
const CX = 50;
const CY = 50;

function point(deg: number) {
  const rad = ((180 - deg) * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) };
}

/**
 * The signature element. A protractor sweep: the arc a joint travels through.
 * Used to mark the stages of care, which genuinely are a sequence, and as the
 * quiet structural motif in the hero.
 */
export function Arc({ degrees, label, className, tone = 'clinic' }: ArcProps) {
  const clamped = Math.max(0, Math.min(180, degrees));
  const end = point(clamped);
  const start = point(0);
  const stroke = tone === 'clinic' ? 'stroke-clinic' : 'stroke-balm';

  return (
    <svg
      viewBox="0 0 100 60"
      className={cn('h-auto w-full', className)}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* full sweep, faint */}
      <path
        d={`M ${point(0).x} ${point(0).y} A ${R} ${R} 0 0 1 ${point(180).x} ${point(180).y}`}
        className="stroke-line-strong"
        strokeWidth={1}
        fill="none"
      />
      {/* degree ticks every 15° */}
      {Array.from({ length: 13 }, (_, i) => i * 15).map((d) => {
        const outer = point(d);
        const inner = {
          x: CX + (R - (d % 45 === 0 ? 7 : 3.5)) * Math.cos(((180 - d) * Math.PI) / 180),
          y: CY - (R - (d % 45 === 0 ? 7 : 3.5)) * Math.sin(((180 - d) * Math.PI) / 180),
        };
        return (
          <line
            key={d}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            className="stroke-line-strong"
            strokeWidth={0.8}
          />
        );
      })}
      {/* the travelled arc */}
      <path
        d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${clamped > 180 ? 1 : 0} 1 ${end.x} ${end.y}`}
        className={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <line x1={CX} y1={CY} x2={end.x} y2={end.y} className={stroke} strokeWidth={1.25} />
      <circle cx={CX} cy={CY} r={2} className={tone === 'clinic' ? 'fill-clinic' : 'fill-balm'} />
    </svg>
  );
}
