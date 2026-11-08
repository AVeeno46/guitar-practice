import { useEffect, useRef, useState } from 'react';
import type { DrillNote } from './chromatic';

interface Props {
  notes: DrillNote[];
  /** 지금 칠 음의 위치. -1이면 표시 안 함 */
  current: number;
  notesPerBeat: number;
  beatsPerBar: number;
  /** 얼터네이트 피킹 표시(⊓ 다운, V 업) */
  showPicking: boolean;
}

const COL_MAX = 22; // 음 하나 폭 (넓은 화면)
const COL_MIN = 17; // 폰에서 한 마디를 한 줄에 넣으려고 줄일 수 있는 최소 폭
const BEAT_GAP = 6; // 박 사이 여백
const BAR_GAP = 10; // 마디선 양옆 여백
const LABEL_W = 16;
const LINE_GAP = 13; // 줄 간격
const TOP = 12;
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e']; // 0 = 6번줄

/** 컨테이너 폭을 따라간다 */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * 연습 순서를 TAB 악보로 그린다. 1번줄(e)이 위, 6번줄(E)이 아래.
 * 박 단위로 살짝 띄우고 마디마다 세로선을 그어서 리듬이 보이게 한다.
 */
export default function TabView({ notes, current, notesPerBeat, beatsPerBar, showPicking }: Props) {
  const [ref, width] = useWidth();
  const perBar = notesPerBeat * beatsPerBar;
  const usable = width - LABEL_W - 4;
  const fixed = (beatsPerBar - 1) * BEAT_GAP + BAR_GAP * 2;
  // 한 마디가 한 줄에 들어가도록 음 폭을 줄인다 (최소 COL_MIN)
  const COL = Math.max(COL_MIN, Math.min(COL_MAX, Math.floor((usable - fixed) / perBar)));
  const barWidth = perBar * COL + fixed;
  // 한 줄에 마디를 몇 개 넣을지. 한 마디도 안 들어가면 박 단위로 자른다 (박 중간에서 끊지 않게)
  const barsPerRow = Math.floor(usable / barWidth);
  const beatWidth = notesPerBeat * COL + BEAT_GAP;
  const perRow =
    barsPerRow >= 1 ? barsPerRow * perBar : Math.max(1, Math.floor((usable - BAR_GAP * 2) / beatWidth)) * notesPerBeat;

  const rows: number[][] = [];
  for (let i = 0; i < notes.length; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, notes.length - i) }, (_, k) => i + k));
  }

  const stringsH = LINE_GAP * 5;
  const rowH = TOP + stringsH + (showPicking ? 22 : 10);
  const yOf = (string: number) => TOP + (5 - string) * LINE_GAP;

  // 지금 칠 음이 있는 줄이 화면 밖이면 보이게 스크롤
  const currentRow = current >= 0 ? Math.floor(current / perRow) : -1;
  const rowRefs = useRef<(SVGSVGElement | null)[]>([]);
  useEffect(() => {
    const el = currentRow >= 0 ? rowRefs.current[currentRow] : null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const bottomLimit = window.innerHeight - 220; // 아래 붙은 메트로놈 높이만큼 피한다
    if (r.top < 60 || r.bottom > bottomLimit) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentRow]);

  return (
    <div className="tabview" ref={ref}>
      {rows.map((idxs, r) => {
        // 각 음의 x 위치: 박·마디 경계마다 여백을 더한다
        const xs: number[] = [];
        const barLines: number[] = [];
        let x = LABEL_W + 2;
        idxs.forEach((idx, k) => {
          const inBar = idx % perBar;
          if (inBar === 0) {
            if (k > 0) x += BAR_GAP;
            barLines.push(x);
            x += BAR_GAP;
          } else if (inBar % notesPerBeat === 0) {
            x += BEAT_GAP;
          }
          xs.push(x + COL / 2);
          x += COL;
        });
        const end = x + (idxs.length && (idxs[idxs.length - 1] + 1) % perBar === 0 ? BAR_GAP : 0);
        if (idxs.length && (idxs[idxs.length - 1] + 1) % perBar === 0) barLines.push(end);
        const svgW = Math.max(end + 2, 60);

        return (
          <svg
            key={r}
            ref={(el) => {
              rowRefs.current[r] = el;
            }}
            className="tab-row"
            width={svgW}
            height={rowH}
            viewBox={`0 0 ${svgW} ${rowH}`}
            role="img"
            aria-label={`TAB ${r + 1}번째 줄`}
          >
            {STRING_NAMES.map((name, s) => (
              <g key={s}>
                <text x={2} y={yOf(s)} className="tab-string-name" dominantBaseline="central">
                  {name}
                </text>
                <line x1={LABEL_W} x2={svgW - 1} y1={yOf(s)} y2={yOf(s)} className="tab-line" />
              </g>
            ))}
            {barLines.map((bx) => (
              <line key={bx} x1={bx} x2={bx} y1={yOf(5)} y2={yOf(0)} className="tab-bar" />
            ))}
            {idxs.map((idx, k) => {
              const n = notes[idx];
              const cx = xs[k];
              const cy = yOf(n.string);
              const isCurrent = idx === current;
              const played = current >= 0 && idx < current;
              return (
                <g key={idx} className={`tab-note ${isCurrent ? 'current' : ''} ${played ? 'played' : ''}`}>
                  {isCurrent ? (
                    <circle cx={cx} cy={cy} r={9} className="tab-cursor" />
                  ) : (
                    <rect x={cx - COL / 2 + 1} y={cy - 6} width={COL - 2} height={12} className="tab-mask" />
                  )}
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="tab-fret">
                    {n.fret}
                  </text>
                  {showPicking && (
                    <text x={cx} y={TOP + stringsH + 14} textAnchor="middle" className="tab-pick">
                      {idx % 2 === 0 ? '⊓' : 'V'}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        );
      })}
    </div>
  );
}
