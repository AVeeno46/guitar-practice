import { useEffect, useMemo, useState } from 'react';
import { loadLocal, saveLocal } from '../storage';
import {
  ALL_PATTERNS,
  CHROMATIC_DEFAULTS,
  COMMON_PATTERNS,
  chromaticKey,
  chromaticLabel,
  chromaticRounds,
  type ChromaticSettings,
} from './chromatic';
import DrillRunner, { ChoiceRow, PatternRow, StartFretRow } from './DrillRunner';
import { DIRECTION_OPTIONS, NOTES_PER_BEAT_OPTIONS } from './drillOptions';

const STORAGE_KEY = 'gp.chromatic';

export default function Chromatic() {
  const [s, setS] = useState<ChromaticSettings>(() => loadLocal(STORAGE_KEY, CHROMATIC_DEFAULTS));
  useEffect(() => saveLocal(STORAGE_KEY, s), [s]);
  const set = (patch: Partial<ChromaticSettings>) => setS((prev) => ({ ...prev, ...patch }));
  const rounds = useMemo(() => chromaticRounds(s), [s]);

  return (
    <div className="drill">
      <div className="drill-controls">
        <PatternRow value={s.pattern} common={COMMON_PATTERNS} all={ALL_PATTERNS} onChange={(pattern) => set({ pattern })} />
        <StartFretRow startFret={s.startFret} shift={s.shift} onChange={set} />
        <ChoiceRow title="방향" value={s.direction} options={DIRECTION_OPTIONS} onChange={(direction) => set({ direction })} />
        <ChoiceRow
          title="박당"
          value={s.notesPerBeat}
          options={NOTES_PER_BEAT_OPTIONS}
          onChange={(notesPerBeat) => set({ notesPerBeat })}
        />
      </div>

      <DrillRunner
        rounds={rounds}
        notesPerBeat={s.notesPerBeat}
        drillKey={chromaticKey(s)}
        label={chromaticLabel(s)}
        metronomeLabel="크로매틱 BPM"
        tip={
          <>
            검지 1 · 중지 2 · 약지 3 · 새끼 4, 한 손가락이 한 프렛을 맡아요. ⊓는 다운, V는 업 피킹.
            틀리지 않고 몇 번 연속으로 치면 BPM을 2~5씩 올려 보세요. 이 패턴의 BPM은 따로 기억돼요.
          </>
        }
      />
    </div>
  );
}
