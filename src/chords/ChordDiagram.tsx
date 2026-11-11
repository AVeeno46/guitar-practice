import type { Voicing } from './chords';

const STRINGS = 6;
const SP = 18; // 줄 간격
const FH = 24; // 프렛 칸 높이
const LEFT = 26; // 시작 프렛 번호 자리
const TOP = 22; // ×·○ 자리
const R = 7.5;

/** 코드 운지 그림 (세로: 왼쪽이 6번줄, 위가 낮은 프렛) */
export default function ChordDiagram({ voicing }: { voicing: Voicing }) {
  const pressed = voicing.frets.filter((f): f is number => f !== null && f > 0);
  const max = pressed.length ? Math.max(...pressed) : 0;
  const min = pressed.length ? Math.min(...pressed) : 1;
  const start = max <= 4 ? 1 : min;
  const rows = Math.max(4, max - start + 1);

  const sx = (s: number) => LEFT + s * SP;
  const fy = (f: number) => TOP + (f - start + 0.5) * FH; // 프렛 f 칸의 가운데
  const width = LEFT + (STRINGS - 1) * SP + 14;
  const height = TOP + rows * FH + 6;

  // 같은 손가락이 같은 프렛의 여러 줄을 누르면 바레
  const barres: { fret: number; from: number; to: number }[] = [];
  const byFinger = new Map<string, number[]>();
  voicing.frets.forEach((f, s) => {
    const finger = voicing.fingers[s];
    if (f === null || f === 0 || !finger) return;
    const k = `${finger}:${f}`;
    byFinger.set(k, [...(byFinger.get(k) ?? []), s]);
  });
  for (const [k, strings] of byFinger) {
    if (strings.length < 2) continue;
    barres.push({ fret: Number(k.split(':')[1]), from: Math.min(...strings), to: Math.max(...strings) });
  }

  return (
    <svg className="chord-diagram" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      {/* 프렛 줄 */}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line
          key={i}
          x1={sx(0)}
          x2={sx(STRINGS - 1)}
          y1={TOP + i * FH}
          y2={TOP + i * FH}
          className={i === 0 && start === 1 ? 'cd-nut' : 'cd-fret'}
        />
      ))}
      {/* 줄 */}
      {Array.from({ length: STRINGS }, (_, s) => (
        <line key={s} x1={sx(s)} x2={sx(s)} y1={TOP} y2={TOP + rows * FH} className="cd-string" />
      ))}
      {start > 1 && (
        <text x={LEFT - 10} y={fy(start)} className="cd-start" textAnchor="end" dominantBaseline="central">
          {start}
        </text>
      )}
      {/* ×, ○ */}
      {voicing.frets.map((f, s) =>
        f === null ? (
          <text key={s} x={sx(s)} y={TOP - 9} className="cd-mute" textAnchor="middle" dominantBaseline="central">
            ×
          </text>
        ) : f === 0 ? (
          <circle key={s} cx={sx(s)} cy={TOP - 9} r={4.5} className="cd-open" />
        ) : null,
      )}
      {barres.map((b) => (
        <rect
          key={`${b.fret}-${b.from}`}
          x={sx(b.from) - R}
          y={fy(b.fret) - R}
          width={sx(b.to) - sx(b.from) + 2 * R}
          height={2 * R}
          rx={R}
          className="cd-barre"
        />
      ))}
      {voicing.frets.map((f, s) =>
        f !== null && f > 0 ? (
          <g key={s}>
            <circle cx={sx(s)} cy={fy(f)} r={R} className="cd-dot" />
            {voicing.fingers[s] > 0 && (
              <text x={sx(s)} y={fy(f)} className="cd-finger" textAnchor="middle" dominantBaseline="central">
                {voicing.fingers[s]}
              </text>
            )}
          </g>
        ) : null,
      )}
    </svg>
  );
}
