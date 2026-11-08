import { useEffect, useRef, useState } from 'react';
import { STRING_COUNT, STRING_NAMES, barCount, perBar, type TabScore } from './score';

export interface Cell {
  col: number;
  string: number;
}

interface Props {
  score: TabScore;
  editing: boolean;
  /** 재생 중 지금 칸 (-1이면 없음) */
  cursor: number;
  selection: Cell | null;
  /** 반복 구간 (마디 번호, 0부터) */
  loop: { from: number; to: number } | null;
  onCellTap?: (cell: Cell) => void;
  onBarTap?: (bar: number) => void;
}

const LABEL_W = 16;
const BEAT_GAP = 6;
const BAR_PAD = 8;
const TOP = 22; // 위쪽 마디 번호 자리

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * TAB 악보. 1번줄(e)이 위. 박마다 살짝 띄우고 마디마다 세로선, 위에 마디 번호.
 * 편집 중에는 칸이 커지고, 칸을 눌러 고른다.
 */
export default function TabStaff({ score, editing, cursor, selection, loop, onCellTap, onBarTap }: Props) {
  const [ref, width] = useWidth();
  const n = perBar(score);
  const bars = barCount(score);
  const npb = score.notesPerBeat;

  const lineGap = editing ? 24 : 15;
  const colMin = editing ? 26 : 17;
  const colMax = editing ? 34 : 24;
  const usable = width - LABEL_W - 6;
  const fixed = (score.beatsPerBar - 1) * BEAT_GAP + BAR_PAD * 2;
  const col = Math.max(colMin, Math.min(colMax, Math.floor((usable - fixed) / n)));
  const barW = n * col + fixed;
  const barsPerRow = Math.floor(usable / barW);
  // 한 마디가 한 줄에 안 들어가면 박 단위로 나눈다
  const beatsPerRow = barsPerRow >= 1 ? 0 : Math.max(1, Math.floor((usable - BAR_PAD * 2) / (npb * col + BEAT_GAP)));
  const perRow = barsPerRow >= 1 ? barsPerRow * n : beatsPerRow * npb;

  const staffH = lineGap * (STRING_COUNT - 1);
  const rowH = TOP + staffH + 12;
  const yOf = (string: number) => TOP + (STRING_COUNT - 1 - string) * lineGap;

  const rows: number[][] = [];
  for (let i = 0; i < score.cols.length; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, score.cols.length - i) }, (_, k) => i + k));
  }

  // 재생 커서·선택 칸이 화면 밖으로 나가면 따라 스크롤
  const focusCol = cursor >= 0 ? cursor : (selection?.col ?? -1);
  const focusRow = focusCol >= 0 ? Math.floor(focusCol / perRow) : -1;
  const rowRefs = useRef<(SVGSVGElement | null)[]>([]);
  useEffect(() => {
    const el = focusRow >= 0 ? rowRefs.current[focusRow] : null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const bottom = window.innerHeight - (editing ? 300 : 230); // 아래 붙은 패드·메트로놈을 피한다
    if (r.top < 70 || r.bottom > bottom) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusRow, editing]);

  return (
    <div className={`tabstaff ${editing ? 'editing' : ''}`} ref={ref}>
      {rows.map((idxs, r) => {
        const xs: number[] = [];
        const barStarts: { bar: number; x: number }[] = [];
        const barLines: number[] = [];
        let x = LABEL_W + 2;
        idxs.forEach((i, k) => {
          const inBar = i % n;
          if (inBar === 0) {
            if (k > 0) x += BAR_PAD;
            barLines.push(x);
            barStarts.push({ bar: i / n, x });
            x += BAR_PAD;
          } else if (inBar % npb === 0) {
            x += BEAT_GAP;
          }
          xs.push(x + col / 2);
          x += col;
        });
        const lastIdx = idxs[idxs.length - 1];
        if ((lastIdx + 1) % n === 0) {
          x += BAR_PAD;
          barLines.push(x);
        }
        const svgW = Math.max(x + 2, 60);
        const firstBar = Math.floor(idxs[0] / n);
        const lastBar = Math.floor(lastIdx / n);

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
          >
            {STRING_NAMES.map((name, s) => (
              <g key={s}>
                <text x={2} y={yOf(s)} className="tab-string-name" dominantBaseline="central">
                  {name}
                </text>
                <line x1={LABEL_W} x2={svgW - 1} y1={yOf(s)} y2={yOf(s)} className="tab-line" />
              </g>
            ))}
            {barLines.map((bx, k) => (
              <line key={`b${k}`} x1={bx} x2={bx} y1={yOf(STRING_COUNT - 1)} y2={yOf(0)} className="tab-bar" />
            ))}

            {/* 마디 번호: 누르면 구간 반복 설정 (연습 모드) */}
            {barStarts.map(({ bar, x: bx }) => (
              <g
                key={`n${bar}`}
                className={`tab-barnum ${loop && bar >= loop.from && bar <= loop.to ? 'in-loop' : ''} ${onBarTap ? 'tappable' : ''}`}
                onClick={onBarTap ? () => onBarTap(bar) : undefined}
                role={onBarTap ? 'button' : undefined}
                aria-label={onBarTap ? `${bar + 1}마디` : undefined}
              >
                <rect x={bx} y={0} width={Math.max(26, col * 1.5)} height={TOP - 4} rx={5} />
                <text x={bx + 5} y={(TOP - 4) / 2} dominantBaseline="central">
                  {bar + 1}
                </text>
              </g>
            ))}
            {firstBar === lastBar && idxs[0] % n !== 0 && (
              <text x={LABEL_W + 4} y={(TOP - 4) / 2} dominantBaseline="central" className="tab-barcont">
                ({firstBar + 1}마디 이어서)
              </text>
            )}

            {idxs.map((i, k) => {
              const c = score.cols[i];
              const cx = xs[k];
              const isCursor = i === cursor;
              return (
                <g key={i} className={`tab-col ${isCursor ? 'current' : ''}`}>
                  {c.map((fret, s) => {
                    const cy = yOf(s);
                    const selected = editing && selection?.col === i && selection.string === s;
                    return (
                      <g key={s}>
                        {fret !== null && (
                          <>
                            <rect x={cx - col / 2 + 2} y={cy - 7} width={col - 4} height={14} className="tab-mask" />
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="tab-fret">
                              {fret}
                            </text>
                          </>
                        )}
                        {selected && (
                          <rect x={cx - col / 2 + 2} y={cy - lineGap / 2 + 1} width={col - 4} height={lineGap - 2} rx={5} className="tab-selcell" />
                        )}
                        {editing && onCellTap && (
                          <rect
                            x={cx - col / 2}
                            y={cy - lineGap / 2}
                            width={col}
                            height={lineGap}
                            className="tab-hit"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              onCellTap({ col: i, string: s });
                            }}
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            {/* 반복 구간: 숫자 위에 옅게 덮는다 (숫자 뒤 가림막에 가려지지 않게) */}
            {loop &&
              Array.from({ length: lastBar - firstBar + 1 }, (_, j) => firstBar + j)
                .filter((bar) => bar >= loop.from && bar <= loop.to)
                .map((bar) => {
                  const ks = idxs.map((i, k) => (Math.floor(i / n) === bar ? k : -1)).filter((k) => k >= 0);
                  const k0 = ks[0];
                  const k1 = ks[ks.length - 1];
                  const startsBar = idxs[k0] % n === 0;
                  const endsBar = (idxs[k1] + 1) % n === 0;
                  const x0 = xs[k0] - col / 2 - (startsBar ? BAR_PAD : 0);
                  const x1 = xs[k1] + col / 2 + (endsBar ? BAR_PAD : 0);
                  return (
                    <rect key={`l${bar}`} x={x0} y={TOP - lineGap / 2} width={x1 - x0} height={staffH + lineGap} className="tab-loop" />
                  );
                })}

            {/* 선택한 칸이 있는 세로줄 */}
            {editing && selection && idxs.includes(selection.col) && (
              <rect
                x={xs[idxs.indexOf(selection.col)] - col / 2}
                y={TOP - lineGap / 2}
                width={col}
                height={staffH + lineGap}
                rx={4}
                className="tab-selcol"
              />
            )}

            {/* 재생 중인 칸 */}
            {cursor >= 0 && idxs.includes(cursor) && (
              <rect
                x={xs[idxs.indexOf(cursor)] - col / 2 + 2}
                y={TOP - lineGap / 2}
                width={col - 4}
                height={staffH + lineGap}
                rx={6}
                className="tab-playcol"
              />
            )}
          </svg>
        );
      })}
      {bars === 0 && <p className="muted">빈 악보</p>}
    </div>
  );
}
