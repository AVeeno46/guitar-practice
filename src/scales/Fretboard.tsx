import { MAX_FRET, STRING_LABELS, TUNING, cellKey, pitchClassAt, type Box, type ScaleNote } from './theory';
import { pluck } from './pluck';

export type LabelMode = 'name' | 'degree' | 'none';

interface Props {
  notes: Map<number, ScaleNote>;
  /** 강조할 포지션 박스들(같은 포지션의 12프렛 위 모양 포함). null이면 전체 표시 */
  boxes: Box[] | null;
  labelMode: LabelMode;
  vertical: boolean;
}

const INLAYS = [3, 5, 7, 9, 15];
const STRINGS = [0, 1, 2, 3, 4, 5];
const FRETS = Array.from({ length: MAX_FRET + 1 }, (_, f) => f);

/**
 * 지판 그림. 가로(PC)는 1번줄이 위, 세로(폰)는 6번줄이 왼쪽에 오고
 * 0프렛(개방현)은 너트 바깥에 그린다.
 */
export default function Fretboard({ notes, boxes, labelMode, vertical }: Props) {
  const open = vertical ? 40 : 40; // 개방현 칸 길이
  const fw = vertical ? 46 : 58; // 프렛 간격
  const sp = vertical ? 50 : 34; // 줄 간격
  const r = vertical ? 16 : 13; // 음 표시 반지름
  const length = open + MAX_FRET * fw;

  // 지판 방향(along)과 줄 방향(across) 좌표를 화면 좌표로 바꾼다
  const padAlong = vertical ? 6 : 26; // 가로일 때 왼쪽 줄 번호 자리
  const padAcross = vertical ? 30 : 6; // 세로일 때 왼쪽 프렛 번호 자리
  const across = (s: number) => padAcross + r + 4 + (vertical ? s : 5 - s) * sp;
  const xy = (along: number, acrossPos: number) =>
    vertical ? { x: acrossPos, y: padAlong + along } : { x: padAlong + along, y: acrossPos };
  const fretCenter = (f: number) => (f === 0 ? open / 2 : open + (f - 0.5) * fw);
  const fretLine = (f: number) => open + f * fw;

  const crossSize = padAcross + 2 * (r + 4) + 5 * sp + (vertical ? 4 : 24);
  const alongSize = padAlong + length + 8;
  const width = vertical ? crossSize : alongSize;
  const height = vertical ? alongSize : crossSize;

  const edgeLo = across(vertical ? 0 : 5) - sp / 2;
  const edgeHi = across(vertical ? 5 : 0) + sp / 2;
  const boardStart = xy(fretLine(0), Math.min(edgeLo, edgeHi));
  const boardEnd = xy(length, Math.max(edgeLo, edgeHi));

  const inBox = (s: number, f: number, note: ScaleNote) =>
    !boxes ||
    boxes.some(
      (b) => b.cells.has(cellKey(s, f)) || (note.isBlue && f > b.spans[s][0] && f < b.spans[s][1]),
    );

  const fretNumberPos = (f: number) =>
    vertical ? xy(fretCenter(f), padAcross / 2 + 2) : xy(fretCenter(f), across(0) + r + 16);

  return (
    <svg
      className={`fretboard ${vertical ? 'vertical' : 'horizontal'}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      role="img"
      aria-label="스케일 지판표"
    >
      <rect
        className="fb-wood"
        x={boardStart.x}
        y={boardStart.y}
        width={boardEnd.x - boardStart.x}
        height={boardEnd.y - boardStart.y}
        rx={3}
      />

      {INLAYS.map((f) => {
        const p = xy(fretCenter(f), (across(2) + across(3)) / 2);
        return <circle key={f} className="fb-inlay" cx={p.x} cy={p.y} r={5} />;
      })}
      {[
        (across(1) + across(2)) / 2,
        (across(3) + across(4)) / 2,
      ].map((a) => {
        const p = xy(fretCenter(12), a);
        return <circle key={a} className="fb-inlay" cx={p.x} cy={p.y} r={5} />;
      })}

      {FRETS.map((f) => {
        const a = xy(fretLine(f), Math.min(edgeLo, edgeHi));
        const b = xy(fretLine(f), Math.max(edgeLo, edgeHi));
        return <line key={f} className={f === 0 ? 'fb-nut' : 'fb-fret'} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}

      {STRINGS.map((s) => {
        const a = xy(0, across(s));
        const b = xy(length, across(s));
        return (
          <line key={s} className="fb-string" x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={2.4 - s * 0.32} />
        );
      })}

      {!vertical &&
        STRINGS.map((s) => {
          const p = { x: 10, y: across(s) };
          return (
            <text key={s} className="fb-label" x={p.x} y={p.y} dominantBaseline="central" textAnchor="middle">
              {STRING_LABELS[s]}
            </text>
          );
        })}

      {FRETS.filter((f) => f > 0).map((f) => {
        const p = fretNumberPos(f);
        return (
          <text
            key={f}
            className={`fb-label ${INLAYS.includes(f) || f === 12 ? 'strong' : ''}`}
            x={p.x}
            y={p.y}
            dominantBaseline="central"
            textAnchor="middle"
          >
            {f}
          </text>
        );
      })}

      {STRINGS.flatMap((s) =>
        FRETS.map((f) => {
          const note = notes.get(pitchClassAt(s, f));
          if (!note) return null;
          const p = xy(fretCenter(f), across(s));
          const kind = note.isRoot ? 'root' : note.isBlue ? 'blue' : 'tone';
          const label = labelMode === 'name' ? note.name : labelMode === 'degree' ? note.degree : '';
          return (
            <g
              key={`${s}-${f}`}
              className={`fb-note ${kind} ${inBox(s, f, note) ? '' : 'dim'}`}
              onPointerDown={() => pluck(TUNING[s] + f)}
              aria-label={`${STRING_LABELS[s]}번줄 ${f}프렛 ${note.name}`}
            >
              <circle cx={p.x} cy={p.y} r={r} />
              {label && (
                <text x={p.x} y={p.y} dominantBaseline="central" textAnchor="middle" fontSize={label.length > 2 ? 9.5 : 11.5}>
                  {label}
                </text>
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}
