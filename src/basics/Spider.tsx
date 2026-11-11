import { useMemo } from 'react';
import type { ScreenSettingsProps } from '../storage';
import { useScreenSettings } from '../useScreenSettings';
import DrillRunner, { ChoiceRow, PatternRow, StartFretRow } from './DrillRunner';
import { DIRECTION_OPTIONS, NOTES_PER_BEAT_OPTIONS } from './drillOptions';
import {
  SPIDER_ALL,
  SPIDER_COMMON,
  SPIDER_DEFAULTS,
  spiderKey,
  spiderLabel,
  spiderRounds,
  type SpiderSettings,
  type SpiderStep,
} from './spider';

const STORAGE_KEY = 'gp.spider';

const STEP_OPTIONS: { value: SpiderStep; label: string }[] = [
  { value: 1, label: '한 줄씩' },
  { value: 2, label: '두 줄씩' },
];

export default function Spider(props: ScreenSettingsProps<SpiderSettings>) {
  const [s, set] = useScreenSettings(STORAGE_KEY, SPIDER_DEFAULTS, props);
  const rounds = useMemo(() => spiderRounds(s), [s]);

  return (
    <div className="drill">
      <div className="drill-controls">
        <PatternRow value={s.pattern} common={SPIDER_COMMON} all={SPIDER_ALL} onChange={(pattern) => set({ pattern })} />
        <StartFretRow startFret={s.startFret} shift={s.shift} onChange={set} />
        <ChoiceRow title="방향" value={s.direction} options={DIRECTION_OPTIONS} onChange={(direction) => set({ direction })} />
        <ChoiceRow title="이동" value={s.step} options={STEP_OPTIONS} onChange={(step) => set({ step })} />
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
        drillKey={spiderKey(s)}
        label={spiderLabel(s)}
        metronomeLabel="스파이더 BPM"
        tip={
          <>
            이웃한 두 줄을 오가요. 패턴의 1·3번째 손가락은 굵은 줄, 2·4번째는 가는 줄을 쳐요.
            친 손가락은 다음 차례가 올 때까지 떼지 말고 누른 채로 두세요. 손가락이 줄에서 멀리 뜨지 않게 하는 게 핵심이에요.
          </>
        }
      />
    </div>
  );
}
