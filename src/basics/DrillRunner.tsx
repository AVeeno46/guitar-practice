// 기본기 연습 공용 부분: 설정 줄(패턴·시작 프렛·방향·박당), 1마디 카운트인, 메트로놈 따라 TAB 커서, 연습별 BPM 기억.
// 크로매틱·스파이더처럼 '음 순서(rounds)만 다른' 연습이 같이 쓴다.

import { useCallback, useState, type ReactNode } from 'react';
import MiniMetronome from '../metronome/MiniMetronome';
import type { MetronomeSettings } from '../metronome/engine';
import { usePracticeActivity } from '../practice/hooks';
import {
  START_FRET_MAX,
  START_FRET_MIN,
  patternLabel,
  type DrillRound,
  type NotesPerBeat,
} from './chromatic';
import { loadDrills, setDrillBpm } from './drillStore';
import TabView from './TabView';

const DEFAULT_BPM = 60;

// ---------- 설정 줄 ----------

export function PatternRow({
  value,
  common,
  all,
  onChange,
}: {
  value: string;
  common: string[];
  all: string[];
  onChange: (p: string) => void;
}) {
  const [showAll, setShowAll] = useState(() => !common.includes(value));
  const patterns = showAll ? all : common;
  return (
    <div className="scale-row">
      <span className="scale-row-title">패턴</span>
      <div className="scale-chips">
        {patterns.map((p) => (
          <button key={p} className={`scale-chip ${value === p ? 'selected' : ''}`} onClick={() => onChange(p)}>
            {patternLabel(p)}
          </button>
        ))}
        <button className="scale-chip toggle" onClick={() => setShowAll(!showAll)}>
          {showAll ? '자주 쓰는 것만' : `전체 ${all.length}개`}
        </button>
      </div>
    </div>
  );
}

export function StartFretRow({
  startFret,
  shift,
  onChange,
}: {
  startFret: number;
  shift: boolean;
  onChange: (patch: { startFret?: number; shift?: boolean }) => void;
}) {
  return (
    <div className="scale-row">
      <span className="scale-row-title">시작</span>
      <div className="fret-stepper">
        <button
          className="scale-chip"
          onClick={() => onChange({ startFret: Math.max(START_FRET_MIN, startFret - 1) })}
          disabled={startFret <= START_FRET_MIN}
          aria-label="시작 프렛 내리기"
        >
          −
        </button>
        <span className="fret-value">
          {startFret}
          <small>프렛</small>
        </span>
        <button
          className="scale-chip"
          onClick={() => onChange({ startFret: Math.min(START_FRET_MAX, startFret + 1) })}
          disabled={startFret >= START_FRET_MAX}
          aria-label="시작 프렛 올리기"
        >
          +
        </button>
        <button
          className={`scale-chip wide toggle ${shift ? 'on' : ''}`}
          onClick={() => onChange({ shift: !shift })}
          aria-pressed={shift}
        >
          한 바퀴마다 +1프렛
        </button>
      </div>
    </div>
  );
}

export function ChoiceRow<T extends string | number>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="scale-row">
      <span className="scale-row-title">{title}</span>
      <div className="scale-chips">
        {options.map((o) => (
          <button
            key={o.value}
            className={`scale-chip wide ${value === o.value ? 'selected' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- 따라 치기 ----------

interface TickState {
  index: number; // 메트로놈 소리 번호 (정지 -1)
  perBar: number; // 한 마디의 소리 수 = 카운트인 길이
  beatsPerBar: number;
}

interface Props {
  rounds: DrillRound[];
  notesPerBeat: NotesPerBeat;
  /** BPM·기록을 모으는 키 (drillStore) */
  drillKey: string;
  label: string;
  metronomeLabel: string;
  tip: ReactNode;
}

export default function DrillRunner({ rounds, notesPerBeat, drillKey, label, metronomeLabel, tip }: Props) {
  const [drills, setDrills] = useState(loadDrills);
  const [tick, setTick] = useState<TickState>({ index: -1, perBar: 0, beatsPerBar: 4 });
  const bpm = drills[drillKey]?.bpm ?? DEFAULT_BPM;

  usePracticeActivity({ key: `drill:${drillKey}`, kind: 'drill', label, bpm });

  const changeBpm = (next: number) => {
    setDrillBpm(drillKey, label, next);
    setDrills(loadDrills());
  };

  const onTick = useCallback((index: number, m: MetronomeSettings) => {
    setTick({ index, perBar: m.beatsPerBar * m.subdivision, beatsPerBar: m.beatsPerBar });
  }, []);

  const total = rounds.reduce((t, r) => t + r.notes.length, 0);

  // 1마디 카운트인 뒤부터 음을 따라간다. 끝까지 가면 처음부터 반복
  const running = tick.index >= 0;
  const noteIndex = running ? tick.index - tick.perBar : -1;
  const countIn = running && noteIndex < 0 ? Math.ceil(-noteIndex / notesPerBeat) : 0;
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

  return (
    <>
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
        {rounds.length > 1 && (
          <span className="muted">
            {' '}
            · {shown.startFret}프렛부터 ({roundIdx + 1}/{rounds.length}바퀴)
          </span>
        )}
      </div>

      <TabView
        notes={shown.notes}
        current={current}
        notesPerBeat={notesPerBeat}
        beatsPerBar={tick.beatsPerBar}
        showPicking
      />

      <p className="drill-tip">{tip}</p>

      <MiniMetronome
        bpm={bpm}
        onBpmChange={changeBpm}
        label={metronomeLabel}
        subdivision={notesPerBeat}
        onTick={onTick}
      />
    </>
  );
}
