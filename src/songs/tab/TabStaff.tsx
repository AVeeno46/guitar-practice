import { useEffect, useRef, useState, type ReactElement } from 'react';
import { STRING_COUNT, STRING_NAMES, barCount, nextNote, perBar, type Note, type TabScore } from './score';

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
const NUM_ROW = 18; // 마디 번호·템포 줄
const MARK_ROW = 16; // P.M. 줄 (+ 벤딩 화살표 여유)
const TOP = NUM_ROW + MARK_ROW + 6;

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

/** ♩=120: 글꼴마다 ♩ 기호가 깨지거나 작게 나와서 음표를 직접 그린다 */
function TempoMark({ x, y, bpm }: { x: number; y: number; bpm: number }) {
  return (
    <g className="tab-tempo">
      <ellipse cx={x + 3} cy={y + 2.5} rx={3.2} ry={2.3} transform={`rotate(-20 ${x + 3} ${y + 2.5})`} />
      <line x1={x + 5.9} x2={x + 5.9} y1={y + 2} y2={y - 7} />
      <text x={x + 9} y={y} dominantBaseline="central">
        ={bpm}
      </text>
    </g>
  );
}

const labelOf = (n: Note) => (n.dead ? 'X' : n.tie ? `(${n.fret})` : String(n.fret));

/**
 * TAB 악보. 1번줄(e)이 위. 박마다 살짝 띄우고 마디마다 세로선, 위에 마디 번호와 템포,
 * 그 아래 P.M. 표시. 음에는 벤딩 화살표, 슬라이드 선, 해머링·풀링 호(h/p)를 그린다.
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
  const beatsPerRow = barsPerRow >= 1 ? 0 : Math.max(1, Math.floor((usable - BAR_PAD * 2) / (npb * col + BEAT_GAP)));
  const perRow = barsPerRow >= 1 ? barsPerRow * n : beatsPerRow * npb;

  const staffH = lineGap * (STRING_COUNT - 1);
  const rowH = TOP + staffH + 12;
  const yOf = (string: number) => TOP + (STRING_COUNT - 1 - string) * lineGap;
  const fontSize = editing ? 13 : 12;

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
    const bottom = window.innerHeight - (editing ? 340 : 230); // 아래 붙은 패드·메트로놈을 피한다
    if (r.top < 70 || r.bottom > bottom) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusRow, editing]);

  return (
    <div className={`tabstaff ${editing ? 'editing' : ''}`} ref={ref}>
      {rows.map((idxs, r) => {
        const xs: number[] = [];
        const xOf = new Map<number, number>();
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
          xOf.set(i, x + col / 2);
          x += col;
        });
        const lastIdx = idxs[idxs.length - 1];
        if ((lastIdx + 1) % n === 0) {
          x += BAR_PAD;
          barLines.push(x);
        }
        const svgW = Math.max(x + 2, 60);
        const rowEnd = svgW - 2;
        const firstBar = Math.floor(idxs[0] / n);
        const lastBar = Math.floor(lastIdx / n);

        // ---- 음 위·사이에 그리는 기법 표시 ----
        const marks: ReactElement[] = [];
        idxs.forEach((i, k) => {
          const cx = xs[k];
          score.cols[i].notes.forEach((note, s) => {
            if (!note || note.dead) return;
            const cy = yOf(s);
            if (note.bend) {
              const x0 = cx + 5;
              marks.push(
                <g key={`b${i}-${s}`} className="tab-bend">
                  <path d={`M${x0},${cy - 2} Q${x0 + 5},${cy - 2} ${x0 + 5},${cy - 12}`} />
                  <path d={`M${x0 + 2.5},${cy - 9} L${x0 + 5},${cy - 14} L${x0 + 7.5},${cy - 9} Z`} className="tab-bend-head" />
                </g>,
              );
            }
            if ((note.slide || note.legato) && !note.dead) {
              const nx = nextNote(score, i, s);
              const sameRow = nx && xOf.has(nx.col);
              const x2 = sameRow ? xOf.get(nx!.col)! : Math.min(rowEnd, cx + col);
              const up = nx ? nx.note.fret > note.fret : true;
              if (note.slide) {
                marks.push(
                  <line
                    key={`s${i}-${s}`}
                    x1={cx + 6}
                    x2={x2 - 6}
                    y1={cy + (up ? 3 : -3)}
                    y2={cy + (up ? -3 : 3)}
                    className="tab-slide"
                  />,
                );
              } else {
                const mid = (cx + x2) / 2;
                marks.push(
                  <g key={`l${i}-${s}`} className="tab-legato">
                    <path d={`M${cx + 3},${cy - 6} Q${mid},${cy - 14} ${x2 - 3},${cy - 6}`} />
                    <text x={mid} y={cy - 12} textAnchor="middle">
                      {up ? 'h' : 'p'}
                    </text>
                  </g>,
                );
              }
            }
          });
        });

        // P.M. 구간: 이어진 칸을 묶어서 "P.M. - - -"
        const pmRuns: { from: number; to: number }[] = [];
        idxs.forEach((i, k) => {
          if (!score.cols[i].pm) return;
          const last = pmRuns[pmRuns.length - 1];
          if (last && last.to === k - 1) last.to = k;
          else pmRuns.push({ from: k, to: k });
        });

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
              <line key={`bl${k}`} x1={bx} x2={bx} y1={yOf(STRING_COUNT - 1)} y2={yOf(0)} className="tab-bar" />
            ))}

            {/* 마디 번호(누르면 구간 반복)와 템포 */}
            {barStarts.map(({ bar, x: bx }) => {
              const tempo = bar === 0 ? score.cols[0].tempo || score.tempo : score.cols[bar * n].tempo;
              return (
                <g key={`n${bar}`}>
                  <g
                    className={`tab-barnum ${loop && bar >= loop.from && bar <= loop.to ? 'in-loop' : ''} ${onBarTap ? 'tappable' : ''}`}
                    onClick={onBarTap ? () => onBarTap(bar) : undefined}
                    role={onBarTap ? 'button' : undefined}
                    aria-label={onBarTap ? `${bar + 1}마디` : undefined}
                  >
                    <rect x={bx} y={0} width={Math.max(26, col * 1.5)} height={NUM_ROW - 3} rx={5} />
                    <text x={bx + 5} y={(NUM_ROW - 3) / 2} dominantBaseline="central">
                      {bar + 1}
                    </text>
                  </g>
                  {tempo ? <TempoMark x={bx + Math.max(26, col * 1.5) + 6} y={(NUM_ROW - 3) / 2} bpm={tempo} /> : null}
                </g>
              );
            })}
            {/* 마디 중간에서 템포가 바뀌는 경우 */}
            {idxs.map((i, k) =>
              i % n !== 0 && score.cols[i].tempo ? (
                <TempoMark key={`t${i}`} x={xs[k] - col / 2} y={(NUM_ROW - 3) / 2} bpm={score.cols[i].tempo!} />
              ) : null,
            )}
            {firstBar === lastBar && idxs[0] % n !== 0 && (
              <text x={LABEL_W + 4} y={(NUM_ROW - 3) / 2} dominantBaseline="central" className="tab-barcont">
                ({firstBar + 1}마디 이어서)
              </text>
            )}

            {pmRuns.map(({ from, to }) => {
              const x0 = xs[from] - col / 2 + 1;
              const x1 = xs[to] + col / 2 - 1;
              const y = NUM_ROW + MARK_ROW / 2;
              return (
                <g key={`pm${from}`} className="tab-pm">
                  <text x={x0} y={y} dominantBaseline="central">
                    P.M.
                  </text>
                  {to > from && x1 - x0 > 30 && <line x1={x0 + 26} x2={x1} y1={y} y2={y} />}
                </g>
              );
            })}

            {idxs.map((i, k) => {
              const c = score.cols[i];
              const cx = xs[k];
              return (
                <g key={i} className={`tab-col ${i === cursor ? 'current' : ''}`}>
                  {c.notes.map((note, s) => {
                    const cy = yOf(s);
                    const selected = editing && selection?.col === i && selection.string === s;
                    const label = note ? labelOf(note) : '';
                    const w = Math.min(col - 2, label.length * (note?.tie ? 5.5 : 7) + 4);
                    return (
                      <g key={s}>
                        {note && (
                          <>
                            <rect x={cx - w / 2} y={cy - 7} width={w} height={14} className="tab-mask" />
                            <text
                              x={cx}
                              y={cy}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className={`tab-fret ${note.tie ? 'tie' : ''} ${note.dead ? 'dead' : ''}`}
                              fontSize={note.tie ? fontSize - 2.5 : fontSize}
                            >
                              {label}
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

            {marks}

            {/* 반복 구간: 숫자 위에 옅게 덮는다 */}
            {loop &&
              Array.from({ length: lastBar - firstBar + 1 }, (_, j) => firstBar + j)
                .filter((bar) => bar >= loop.from && bar <= loop.to)
                .map((bar) => {
                  const ks = idxs.map((i, k) => (Math.floor(i / n) === bar ? k : -1)).filter((k) => k >= 0);
                  const k0 = ks[0];
                  const k1 = ks[ks.length - 1];
                  const x0 = xs[k0] - col / 2 - (idxs[k0] % n === 0 ? BAR_PAD : 0);
                  const x1 = xs[k1] + col / 2 + ((idxs[k1] + 1) % n === 0 ? BAR_PAD : 0);
                  return (
                    <rect key={`l${bar}`} x={x0} y={TOP - lineGap / 2} width={x1 - x0} height={staffH + lineGap} className="tab-loop" />
                  );
                })}

            {/* 편집 중 선택한 칸이 있는 세로줄 */}
            {editing && selection && xOf.has(selection.col) && (
              <rect
                x={xOf.get(selection.col)! - col / 2}
                y={TOP - lineGap / 2}
                width={col}
                height={staffH + lineGap}
                rx={4}
                className="tab-selcol"
              />
            )}

            {/* 재생 중인 칸 */}
            {cursor >= 0 && xOf.has(cursor) && (
              <rect
                x={xOf.get(cursor)! - col / 2 + 2}
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
