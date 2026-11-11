import { useEffect, useMemo, useState } from 'react';
import MiniMetronome from '../metronome/MiniMetronome';
import type { ScreenSettingsProps } from '../storage';
import { useScreenSettings } from '../useScreenSettings';
import { SCALES_STORAGE_KEY, SCALE_DEFAULTS, scaleLabel, scaleName as scaleNameOf, type ScaleSettings } from './settings';
import { usePracticeActivity } from '../practice/hooks';
import Fretboard, { type LabelMode } from './Fretboard';
import {
  BOX_COLORS,
  SCALES,
  pentatonicBoxes,
  relativeRoot,
  rootLabel,
  scaleNotes,
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
  const { root, type, position, labelMode, blue, outlines } = settings;


  const notes = useMemo(() => scaleNotes(root, type, blue), [root, type, blue]);
  const allBoxes = useMemo(() => pentatonicBoxes(root, type), [root, type]);
  const boxes = position ? allBoxes.filter((b) => b.position === position) : null;

  const ordered = [...notes.values()].sort(
    (a, b) => ((a.pc - root + 12) % 12) - ((b.pc - root + 12) % 12),
  );
  const relType: ScaleType = type === 'minor' ? 'major' : 'minor';
  const relRoot = relativeRoot(root, type);
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
          <span className="scale-row-title">종류</span>
          <div className="scale-chips">
            {(['minor', 'major'] as const).map((t) => (
              <button
                key={t}
                className={`scale-chip wide ${type === t ? 'selected' : ''}`}
                onClick={() => set({ type: t })}
              >
                {t === 'minor' ? '마이너' : '메이저'}
              </button>
            ))}
            <button
              className={`scale-chip wide toggle ${blue ? 'on' : ''}`}
              onClick={() => set({ blue: !blue })}
              aria-pressed={blue}
            >
              + 블루 노트
            </button>
          </div>
        </div>

        <div className="scale-row">
          <span className="scale-row-title">포지션</span>
          <div className="scale-chips">
            {[0, 1, 2, 3, 4, 5].map((p) => (
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
            <li key={n.pc} className={n.isRoot ? 'root' : n.isBlue ? 'blue' : ''}>
              <span className="scale-note-name">{n.name}</span>
              <span className="scale-note-degree">{n.degree}</span>
            </li>
          ))}
        </ol>
        <p className="scale-tip">
          {rootLabel(relRoot, relType)} {SCALES[relType].name}과 같은 음이라 지판 모양도 같아요.
          {' '}음을 누르면 소리가 나요.
        </p>
      </div>

      <div className="fretboard-wrap">
        <Fretboard
          notes={notes}
          boxes={boxes}
          outlines={outlines ? (boxes ?? allBoxes) : []}
          labelMode={labelMode}
          vertical={vertical}
        />
      </div>

      <MiniMetronome bpm={settings.bpm} onBpmChange={(bpm) => set({ bpm })} label="스케일 연습 BPM" />
    </section>
  );
}
