import { useCallback, useEffect, useMemo, useState } from 'react';
import MiniMetronome from '../metronome/MiniMetronome';
import type { MetronomeSettings } from '../metronome/engine';
import { usePracticeActivity } from '../practice/hooks';
import { loadLocal, saveLocal } from '../storage';
import {
  ALL_PATTERNS,
  CHROMATIC_DEFAULTS,
  COMMON_PATTERNS,
  NOTE_VALUE_LABEL,
  START_FRET_MAX,
  START_FRET_MIN,
  chromaticKey,
  chromaticLabel,
  chromaticRounds,
  patternLabel,
  type ChromaticSettings,
  type Direction,
  type NotesPerBeat,
} from './chromatic';
import { loadDrills, setDrillBpm } from './drillStore';
import TabView from './TabView';

const STORAGE_KEY = 'gp.chromatic';
const DEFAULT_BPM = 60;

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'updown', label: '왕복' },
  { value: 'up', label: '올라가기' },
  { value: 'down', label: '내려가기' },
];

interface TickState {
  index: number; // 메트로놈 소리 번호 (정지 -1)
  perBar: number; // 한 마디의 소리 수 = 카운트인 길이
  beatsPerBar: number;
}

export default function Chromatic() {
  const [s, setS] = useState<ChromaticSettings>(() => loadLocal(STORAGE_KEY, CHROMATIC_DEFAULTS));
  const [showAll, setShowAll] = useState(() => !COMMON_PATTERNS.includes(s.pattern));
  const [drills, setDrills] = useState(loadDrills);
  const [tick, setTick] = useState<TickState>({ index: -1, perBar: 0, beatsPerBar: 4 });

  useEffect(() => saveLocal(STORAGE_KEY, s), [s]);
  const set = (patch: Partial<ChromaticSettings>) => setS((prev) => ({ ...prev, ...patch }));

  const key = chromaticKey(s);
  const label = chromaticLabel(s);
  const bpm = drills[key]?.bpm ?? DEFAULT_BPM;

  usePracticeActivity({ key: `drill:${key}`, kind: 'drill', label, bpm });

  const changeBpm = (next: number) => {
    setDrillBpm(key, label, next);
    setDrills(loadDrills());
  };

  const onTick = useCallback((index: number, m: MetronomeSettings) => {
    setTick({ index, perBar: m.beatsPerBar * m.subdivision, beatsPerBar: m.beatsPerBar });
  }, []);

  const rounds = useMemo(() => chromaticRounds(s), [s]);
  const total = rounds.reduce((t, r) => t + r.notes.length, 0);

  // 1마디 카운트인 뒤부터 음을 따라간다. 끝까지 가면 처음부터 반복
  const running = tick.index >= 0;
  const noteIndex = running ? tick.index - tick.perBar : -1;
  const countIn = running && noteIndex < 0 ? Math.ceil(-noteIndex / s.notesPerBeat) : 0;
  let roundIdx = 0;
  let current = -1;
  if (noteIndex >= 0) {
    let pos = noteIndex % total;
    while (pos >= rounds[roundIdx].notes.length) {
      pos -= rounds[roundIdx].notes.length;
      roundIdx++;
    }
    current = pos;
  }
  const shown = rounds[roundIdx];
  const loops = noteIndex >= 0 ? Math.floor(noteIndex / total) : 0;

  const patterns = showAll ? ALL_PATTERNS : COMMON_PATTERNS;

  return (
    <div className="drill">
      <div className="drill-controls">
        <div className="scale-row">
          <span className="scale-row-title">패턴</span>
          <div className="scale-chips">
            {patterns.map((p) => (
              <button
                key={p}
                className={`scale-chip ${s.pattern === p ? 'selected' : ''}`}
                onClick={() => set({ pattern: p })}
              >
                {patternLabel(p)}
              </button>
            ))}
            <button className="scale-chip toggle" onClick={() => setShowAll(!showAll)}>
              {showAll ? '자주 쓰는 것만' : '전체 24개'}
            </button>
          </div>
        </div>

        <div className="scale-row">
          <span className="scale-row-title">시작</span>
          <div className="fret-stepper">
            <button
              className="scale-chip"
              onClick={() => set({ startFret: Math.max(START_FRET_MIN, s.startFret - 1) })}
              disabled={s.startFret <= START_FRET_MIN}
              aria-label="시작 프렛 내리기"
            >
              −
            </button>
            <span className="fret-value">
              {s.startFret}
              <small>프렛</small>
            </span>
            <button
              className="scale-chip"
              onClick={() => set({ startFret: Math.min(START_FRET_MAX, s.startFret + 1) })}
              disabled={s.startFret >= START_FRET_MAX}
              aria-label="시작 프렛 올리기"
            >
              +
            </button>
            <button
              className={`scale-chip wide toggle ${s.shift ? 'on' : ''}`}
              onClick={() => set({ shift: !s.shift })}
              aria-pressed={s.shift}
            >
              한 바퀴마다 +1프렛
            </button>
          </div>
        </div>

        <div className="scale-row">
          <span className="scale-row-title">방향</span>
          <div className="scale-chips">
            {DIRECTIONS.map((d) => (
              <button
                key={d.value}
                className={`scale-chip wide ${s.direction === d.value ? 'selected' : ''}`}
                onClick={() => set({ direction: d.value })}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="scale-row">
          <span className="scale-row-title">박당</span>
          <div className="scale-chips">
            {([1, 2, 3, 4] as NotesPerBeat[]).map((n) => (
              <button
                key={n}
                className={`scale-chip wide ${s.notesPerBeat === n ? 'selected' : ''}`}
                onClick={() => set({ notesPerBeat: n })}
              >
                {n}음 <span className="chip-sub">{NOTE_VALUE_LABEL[n]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="drill-status" aria-live="polite">
        {countIn > 0 ? (
          <span className="drill-countin">준비 {countIn}</span>
        ) : running ? (
          <span>
            <span className="drill-live">● 따라 치는 중</span>
            {loops > 0 && <span className="muted"> · {loops + 1}번째 반복</span>}
          </span>
        ) : (
          <span className="muted">▶를 누르면 1마디 세고 시작해요. 주황 동그라미가 지금 칠 음이에요.</span>
        )}
        {s.shift && (
          <span className="muted">
            {' '}
            · {shown.startFret}프렛부터 ({roundIdx + 1}/{rounds.length}바퀴)
          </span>
        )}
      </div>

      <TabView
        notes={shown.notes}
        current={current}
        notesPerBeat={s.notesPerBeat}
        beatsPerBar={tick.beatsPerBar}
        showPicking
      />

      <p className="drill-tip">
        검지 1 · 중지 2 · 약지 3 · 새끼 4, 한 손가락이 한 프렛을 맡아요. ⊓는 다운, V는 업 피킹.
        틀리지 않고 몇 번 연속으로 치면 BPM을 2~5씩 올려 보세요. 이 패턴의 BPM은 따로 기억돼요.
      </p>

      <MiniMetronome
        bpm={bpm}
        onBpmChange={changeBpm}
        label="크로매틱 BPM"
        subdivision={s.notesPerBeat}
        onTick={onTick}
      />
    </div>
  );
}
