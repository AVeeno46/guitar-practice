import { useEffect, useMemo, useState } from 'react';
import { pluck } from '../scales/pluck';
import { loadLocal, saveLocal } from '../storage';
import ChordDiagram from './ChordDiagram';
import { CHORDS, CHORD_TYPES, ROOT_NAMES, chordName, voicingMidi, voicingsFor, type ChordType, type Voicing } from './chords';
import './chords.css';

const STORAGE_KEY = 'gp.chords';

interface ChordSettings {
  root: number;
  type: ChordType;
}

const DEFAULTS: ChordSettings = { root: 0, type: 'maj' };

/** 아래 줄부터 조금씩 늦게 쳐서 스트럼처럼 */
function strum(v: Voicing) {
  voicingMidi(v).forEach((midi, i) => setTimeout(() => void pluck(midi), i * 35));
}

function shapeLabel(v: Voicing): string {
  if (v.shape === 'open') return '오픈 코드';
  const rootFret = v.shape === 'E' ? v.frets[0] : v.frets[1];
  return `${v.shape === 'E' ? '6' : '5'}번줄 근음 · ${rootFret}프렛`;
}

export default function Chords() {
  const [s, setS] = useState<ChordSettings>(() => {
    const v = loadLocal(STORAGE_KEY, DEFAULTS);
    return v.type in CHORDS ? v : DEFAULTS;
  });
  useEffect(() => saveLocal(STORAGE_KEY, s), [s]);
  const { root, type } = s;
  const def = CHORDS[type];
  const voicings = useMemo(() => voicingsFor(root, type), [root, type]);
  const name = chordName(root, type);

  return (
    <section className="chords">
      <div className="scale-controls">
        <div className="scale-row">
          <span className="scale-row-title">근음</span>
          <div className="scale-chips keys">
            {ROOT_NAMES.map((n, pc) => (
              <button
                key={pc}
                className={`scale-chip ${root === pc ? 'selected' : ''}`}
                onClick={() => setS({ ...s, root: pc })}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="scale-row">
          <span className="scale-row-title">종류</span>
          <div className="scale-chips">
            {CHORD_TYPES.map((t) => (
              <button
                key={t}
                className={`scale-chip wide ${type === t ? 'selected' : ''}`}
                onClick={() => setS({ ...s, type: t })}
              >
                {CHORDS[t].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="scale-summary">
        <h2>{name}</h2>
        <ol className="scale-notes">
          {def.intervals.map((iv, i) => (
            <li key={iv} className={iv === 0 ? 'root' : ''}>
              <span className="scale-note-name">{ROOT_NAMES[(root + iv) % 12]}</span>
              <span className="scale-note-degree">{def.degrees[i]}</span>
            </li>
          ))}
        </ol>
        <p className="scale-tip">
          그림을 누르면 소리가 나요. 숫자는 손가락(1 검지 · 2 중지 · 3 약지 · 4 새끼), 위의 ×는 치지 않는 줄, ○는 개방현,
          가로 막대는 한 손가락으로 여러 줄을 누르는 바레예요.
        </p>
      </div>

      <ul className="chord-voicings">
        {voicings.map((v) => (
          <li key={v.frets.join(',')}>
            <button className="chord-card" onClick={() => strum(v)} aria-label={`${name} ${shapeLabel(v)} 소리 듣기`}>
              <ChordDiagram voicing={v} />
              <span className="chord-card-label">{shapeLabel(v)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
