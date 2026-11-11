import { useEffect, useMemo, useState } from 'react';
import MiniMetronome from '../metronome/MiniMetronome';
import type { ScreenSettingsProps } from '../storage';
import { useScreenSettings } from '../useScreenSettings';
import { SCALES_STORAGE_KEY, SCALE_DEFAULTS, scaleLabel, scaleName as scaleNameOf, type ScaleSettings } from './settings';
import { usePracticeActivity } from '../practice/hooks';
import Fretboard, { type LabelMode } from './Fretboard';
import {
  BOX_COLORS,
  PENTATONIC_TYPES,
  SCALES,
  SEVEN_TYPES,
  isPentatonic,
  relativeRoot,
  rootLabel,
  scaleBoxes,
  scaleNotes,
  validType,
  type ScaleType,
} from './theory';
import './scales.css';

const ROOTS = Array.from({ length: 12 }, (_, i) => i);
const LABEL_MODES: { value: LabelMode; label: string }[] = [
  { value: 'name', label: '음이름' },
  { value: 'degree', label: '도수' },
  { value: 'none', label: '점만' },
];

/** 폰처럼 좁은 화면에서는 지판을 세로로 세운다. */
function useVerticalBoard() {
  const query = '(max-width: 699px)';
  const [vertical, setVertical] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setVertical(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return vertical;
}

export default function Scales(props: ScreenSettingsProps<ScaleSettings>) {
  const [settings, set] = useScreenSettings(SCALES_STORAGE_KEY, SCALE_DEFAULTS, props);
  const vertical = useVerticalBoard();
  const { root, labelMode, outlines } = settings;
  const type = validType(settings.type);
  const penta = isPentatonic(type);
  const blue = penta && settings.blue;
  const def = SCALES[type];
  const positionCount = def.intervals.length;
  const position = settings.position <= positionCount ? settings.position : 0;

  const notes = useMemo(() => scaleNotes(root, type, blue), [root, type, blue]);
  const allBoxes = useMemo(() => scaleBoxes(root, type), [root, type]);
  const boxes = position ? allBoxes.filter((b) => b.position === position) : null;

  const ordered = [...notes.values()].sort(
    (a, b) => ((a.pc - root + 12) % 12) - ((b.pc - root + 12) % 12),
  );
  // 같은 음을 쓰는 스케일: 펜타토닉은 마이너↔메이저, 7음은 메이저 스케일(메이저면 내추럴 마이너)
  const relType: ScaleType = penta
    ? type === 'minor'
      ? 'major'
      : 'minor'
    : type === 'ionian'
      ? 'aeolian'
      : 'ionian';
  const relRoot = relativeRoot(root, type);

  /** 펜타토닉 ↔ 7음을 바꿀 때 같은 느낌(마이너/메이저)으로 */
  const switchFamily = (toPenta: boolean) => {
    if (toPenta === penta) return;
    const minorish = def.degrees.includes('♭3');
    const next: ScaleType = toPenta ? (minorish ? 'minor' : 'major') : minorish ? 'aeolian' : 'ionian';
    set({ type: next, position: 0 });
  };
  const scaleName = scaleNameOf(settings);
  usePracticeActivity({
    key: `scale:${root}:${type}:${blue ? 'b' : ''}:${position}`,
    kind: 'scale',
    label: scaleLabel(settings),
    bpm: settings.bpm,
  });
  const startFret = boxes?.[0] ? Math.min(...boxes[0].spans.map(([a]) => a)) : null;

  return (
    <section className="scales">
      <div className="scale-controls">
        <div className="scale-row">
          <span className="scale-row-title">키</span>
          <div className="scale-chips keys">
            {ROOTS.map((pc) => (
              <button
                key={pc}
                className={`scale-chip ${root === pc ? 'selected' : ''}`}
                onClick={() => set({ root: pc })}
              >
                {rootLabel(pc, type)}
              </button>
            ))}
          </div>
        </div>

        <div className="scale-row">
          <span className="scale-row-title">음 수</span>
          <div className="scale-chips">
            <button className={`scale-chip wide ${penta ? 'selected' : ''}`} onClick={() => switchFamily(true)}>
              펜타토닉 <span className="chip-sub">5음</span>
            </button>
            <button className={`scale-chip wide ${!penta ? 'selected' : ''}`} onClick={() => switchFamily(false)}>
              메이저·마이너·모드 <span className="chip-sub">7음</span>
            </button>
          </div>
        </div>

        <div className="scale-row">
          <span className="scale-row-title">종류</span>
          <div className="scale-chips">
            {(penta ? PENTATONIC_TYPES : SEVEN_TYPES).map((t) => (
              <button
                key={t}
                className={`scale-chip wide ${type === t ? 'selected' : ''}`}
                onClick={() => set({ type: t, ...(position > SCALES[t].intervals.length ? { position: 0 } : {}) })}
              >
                {SCALES[t].short}
              </button>
            ))}
            {penta && (
              <button
                className={`scale-chip wide toggle ${blue ? 'on' : ''}`}
                onClick={() => set({ blue: !blue })}
                aria-pressed={blue}
              >
                + 블루 노트
              </button>
            )}
          </div>
        </div>

        <div className="scale-row">
          <span className="scale-row-title">포지션</span>
          <div className="scale-chips">
            {Array.from({ length: positionCount + 1 }, (_, p) => p).map((p) => (
              <button
                key={p}
                className={`scale-chip ${position === p ? 'selected' : ''}`}
                onClick={() => set({ position: p })}
              >
                {p > 0 && outlines && <span className="box-dot" style={{ background: BOX_COLORS[p - 1] }} />}
                {p === 0 ? '전체' : p}
              </button>
            ))}
          </div>
        </div>

        <div className="scale-row">
          <span className="scale-row-title">표시</span>
          <div className="scale-chips">
            {LABEL_MODES.map((m) => (
              <button
                key={m.value}
                className={`scale-chip wide ${labelMode === m.value ? 'selected' : ''}`}
                onClick={() => set({ labelMode: m.value })}
              >
                {m.label}
              </button>
            ))}
            <button
              className={`scale-chip wide toggle box ${outlines ? 'on' : ''}`}
              onClick={() => set({ outlines: !outlines })}
              aria-pressed={outlines}
            >
              박스 테두리
            </button>
          </div>
        </div>
      </div>

      <div className="scale-summary">
        <h2>
          {scaleName}
          {startFret !== null && <span className="scale-pos"> · {position}번 포지션 ({startFret}프렛~)</span>}
        </h2>
        <ol className="scale-notes">
          {ordered.map((n) => (
            <li key={n.pc} className={n.isRoot ? 'root' : n.isBlue ? 'blue' : n.isFeature ? 'feature' : ''}>
              <span className="scale-note-name">{n.name}</span>
              <span className="scale-note-degree">{n.degree}</span>
            </li>
          ))}
        </ol>
        <p className="scale-tip">
          {def.feature && (
            <>
              <strong className="scale-feature">특징음 {def.degrees[def.intervals.indexOf(def.feature.interval)]}</strong>
              {' '}
              {def.feature.text}.{' '}
            </>
          )}
          {rootLabel(relRoot, relType)} {SCALES[relType].name}과 같은 음이라 지판 모양도 같아요.
          {!penta && ' 포지션은 한 줄에 3음씩(3NPS) 치는 모양이에요.'} 음을 누르면 소리가 나요.
        </p>
      </div>

      <div className="fretboard-wrap">
        <Fretboard
          notes={notes}
          boxes={boxes}
          outlines={outlines ? (boxes ?? (penta ? allBoxes : [])) : []}
          labelMode={labelMode}
          vertical={vertical}
        />
      </div>

      <MiniMetronome bpm={settings.bpm} onBpmChange={(bpm) => set({ bpm })} label="스케일 연습 BPM" />
    </section>
  );
}
