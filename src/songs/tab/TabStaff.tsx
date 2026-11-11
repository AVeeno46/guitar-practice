import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { STRING_COUNT, STRING_NAMES, barCount, nextNote, perBar, rhythmOf, type Note, type RhythmNote, type TabScore } from './score';

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
  /** 확대 배율 (1 = 기본). 줄바꿈도 이 배율에 맞춰 다시 계산한다 */
  zoom?: number;
}

const LABEL_W = 16;
const BEAT_GAP = 6;
const BAR_PAD = 8;
const NUM_ROW = 18; // 마디 번호·템포 줄
const MARK_ROW = 16; // P.M. 줄 (+ 벤딩 화살표 여유)
const TOP = NUM_ROW + MARK_ROW + 6;
const RHYTHM_H = 30; // TAB 아래 박자(기둥·꼬리) 줄
const STEM = 17; // 4분·8분·16분음표 기둥 길이
const BEAM_GAP = 4.2;

/**
 * TAB 아래 박자 표시. 한 박 안의 8분·16분음표는 빔으로 묶고, 혼자면 꼬리.
 * 2분음표는 짧은 기둥, 온음표는 기둥 없음, 점음표는 점, 셋잇단 묶음에는 3.
 */
function RhythmMarks({
  notes,
  xOf,
  y0,
  npb,
}: {
  notes: RhythmNote[];
  xOf: Map<number, number>;
  y0: number;
  npb: number;
}) {
  const out: ReactElement[] = [];
  const end = y0 + STEM;
  const level = (r: RhythmNote) => (r.kind === 'sixteenth' ? 2 : r.kind === 'eighth' ? 1 : 0);
  const beamable = (r: RhythmNote) => level(r) > 0 && (npb === 3 || Math.floor(r.col / npb) === Math.floor((r.col + r.slots - 1) / npb));

  // 기둥·점
  for (const r of notes) {
    const x = xOf.get(r.col)!;
    if (r.kind !== 'whole') {
      const y1 = r.kind === 'half' ? y0 + STEM * 0.5 : end;
      out.push(<line key={`st${r.col}`} x1={x} x2={x} y1={y0} y2={y1} className="tab-stem" />);
      if (r.dotted) out.push(<circle key={`d${r.col}`} cx={x + 4} cy={y0 + 4} r={1.5} className="tab-beam" />);
    }
  }

  // 한 박 안에서 이어진 빔 묶음
  const groups: RhythmNote[][] = [];
  for (const r of notes) {
    if (!beamable(r)) continue;
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    const sameBeat = prev && Math.floor(prev.col / npb) === Math.floor(r.col / npb) && prev.col + prev.slots === r.col;
    if (sameBeat) last.push(r);
    else groups.push([r]);
  }

  for (const g of groups) {
    const xs = g.map((r) => xOf.get(r.col)!);
    if (g.length === 1) {
      // 꼬리
      for (let k = 0; k < level(g[0]); k++) {
        const y = end - k * BEAM_GAP;
        out.push(<path key={`f${g[0].col}-${k}`} d={`M${xs[0]},${y} q5,-1.5 6,-7`} className="tab-flag" />);
      }
    } else {
      out.push(<rect key={`b${g[0].col}`} x={xs[0]} y={end - 2.4} width={xs[xs.length - 1] - xs[0]} height={2.4} className="tab-beam" />);
      // 16분음표 둘째 빔: 이웃도 16분이면 이어 긋고, 혼자면 짧게
      g.forEach((r, k) => {
        if (level(r) < 2) return;
        const y = end - 2.4 - BEAM_GAP;
        if (k + 1 < g.length && level(g[k + 1]) >= 2) {
          out.push(<rect key={`b2${r.col}`} x={xs[k]} y={y} width={xs[k + 1] - xs[k]} height={2.4} className="tab-beam" />);
        } else if (!(k > 0 && level(g[k - 1]) >= 2)) {
          const toLeft = k === g.length - 1;
          const w = Math.min(6, (toLeft ? xs[k] - xs[k - 1] : xs[k + 1] - xs[k]) / 2);
          out.push(<rect key={`b2${r.col}`} x={toLeft ? xs[k] - w : xs[k]} y={y} width={w} height={2.4} className="tab-beam" />);
        }
      });
      if (npb === 3) {
        out.push(
          <text key={`t${g[0].col}`} x={(xs[0] + xs[xs.length - 1]) / 2} y={end + 8} textAnchor="middle" className="tab-tuplet">
            3
          </text>,
        );
      }
    }
  }
  return <g className="tab-rhythm">{out}</g>;
}

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

type RestKind = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

/**
 * 쉼표 길이(칸)를 악보에서 쓰는 쉼표 기호들로 나눈다.
 * 박 경계에 맞춰 큰 것부터: 온(한 마디 전체) → 2분 → 4분 → 8분 → 16분.
 */
function splitRest(start: number, length: number, npb: number, perBarCols: number) {
  const out: { col: number; kind: RestKind }[] = [];
  const sizes: [RestKind, number][] = [
    ['half', npb * 2],
    ['quarter', npb],
    ['eighth', npb / 2],
    ['sixteenth', npb / 4],
  ];
  let p = start;
  const end = start + length;
  if (p % perBarCols === 0 && length >= perBarCols) {
    out.push({ col: p, kind: 'whole' });
    p += perBarCols;
  }
  while (p < end) {
    const inBar = p % perBarCols;
    const fit = sizes.find(([, n]) => Number.isInteger(n) && n >= 1 && inBar % n === 0 && p + n <= end);
    if (!fit) {
      // 셋잇단처럼 딱 맞는 기호가 없으면 칸마다 8분쉼표 모양으로
      out.push({ col: p, kind: 'eighth' });
      p += 1;
      continue;
    }
    out.push({ col: p, kind: fit[0] });
    p += fit[1];
  }
  return out;
}

/** 쉼표 기호. (x, mid)는 칸 가운데와 오선 가운데, g는 줄 간격 */
function RestGlyph({ kind, x, mid, g }: { kind: RestKind; x: number; mid: number; g: number }) {
  if (kind === 'whole' || kind === 'half') {
    // 온쉼표는 가운데 줄에 매달리고, 2분쉼표는 그 아래 줄 위에 얹힌다
    const y = kind === 'whole' ? mid - g / 2 : mid + g / 2 - 3.5;
    return <rect x={x - 4.5} y={y} width={9} height={3.5} className="tab-rest" />;
  }
  if (kind === 'quarter') {
    const h = g * 1.6;
    const t = mid - h / 2;
    return (
      <path
        className="tab-rest stroke"
        d={`M${x - 1.5},${t} L${x + 2.5},${t + h * 0.3} L${x - 1.5},${t + h * 0.55} L${x + 2.5},${t + h * 0.8} Q${x - 3},${t + h * 0.72} ${x},${t + h}`}
      />
    );
  }
  const flags = kind === 'eighth' ? 1 : 2;
  const top = mid - g * 0.55;
  return (
    <g className="tab-rest">
      {Array.from({ length: flags }, (_, k) => {
        const y = top + k * g * 0.55;
        return (
          <g key={k}>
            <circle cx={x - 2.2 - k * 0.8} cy={y} r={1.7} />
            <path className="stroke" d={`M${x - 2.2 - k * 0.8},${y + 0.8} Q${x + 0.5},${y + 1.6} ${x + 2.8 - k * 0.8},${y - 0.8}`} />
          </g>
        );
      })}
      <line className="stroke" x1={x + 2.8} y1={top - 0.8} x2={x - 0.5} y2={top + g * (flags === 1 ? 1.3 : 1.85)} />
    </g>
  );
}

const labelOf = (n: Note) => (n.dead ? 'X' : n.tie ? `(${n.fret})` : String(n.fret));

/**
 * TAB 악보. 1번줄(e)이 위. 박마다 살짝 띄우고 마디마다 세로선, 위에 마디 번호와 템포,
 * 그 아래 P.M. 표시. 음에는 벤딩 화살표, 슬라이드 선, 해머링·풀링 호(h/p)를 그린다.
 * 편집 중에는 칸이 커지고, 칸을 눌러 고른다.
 */
export default function TabStaff({ score, editing, cursor, selection, loop, onCellTap, onBarTap, zoom = 1 }: Props) {
  const [ref, rawWidth] = useWidth();
  const width = rawWidth / zoom; // 확대한 만큼 좁은 폭에 그린 뒤 키운다
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
  const rowH = TOP + staffH + 12 + RHYTHM_H;
  const rhythm = useMemo(() => rhythmOf(score), [score]);
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
            if (note.slideOut) {
              // 슬라이드 아웃: 숫자 뒤로 짧게 내려가는 선
              marks.push(
                <line key={`so${i}-${s}`} x1={cx + 6} x2={cx + 6 + Math.min(14, col * 0.8)} y1={cy - 2} y2={cy + 4} className="tab-slide" />,
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
            width={svgW * zoom}
            height={rowH * zoom}
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

            {/* 쉼표 */}
            {idxs.map((i) => {
              const len = score.cols[i].rest;
              if (!len) return null;
              const mid = (yOf(2) + yOf(3)) / 2;
              return splitRest(i, len, npb, n)
                .filter((r) => xOf.has(r.col))
                .map((r) => <RestGlyph key={`r${r.col}`} kind={r.kind} x={xOf.get(r.col)!} mid={mid} g={lineGap} />);
            })}

            {marks}

            {/* 박자: TAB 아래 기둥·꼬리 */}
            <RhythmMarks
              notes={rhythm.filter((rn) => xOf.has(rn.col))}
              xOf={xOf}
              y0={yOf(0) + lineGap * 0.6 + 2}
              npb={npb}
            />

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
