import { useMemo } from 'react';
import type { ScreenSettingsProps } from '../storage';
import { useScreenSettings } from '../useScreenSettings';
import DrillRunner, { ChoiceRow } from './DrillRunner';
import { NOTES_PER_BEAT_OPTIONS } from './drillOptions';
import {
  KIND_LABEL,
  PICKING_DEFAULTS,
  PICKING_FRET_MAX,
  pickingKey,
  pickingLabel,
  pickingRounds,
  stringChoiceLabel,
  stringChoices,
  type PickingKind,
  type PickingMode,
  type PickingSettings,
  validString,
} from './picking';

const STORAGE_KEY = 'gp.picking';

const KINDS: PickingKind[] = ['single', 'crossing', 'inout', 'skip'];

const MODE_OPTIONS: { value: PickingMode; label: string }[] = [
  { value: 'outside', label: '아우터' },
  { value: 'inside', label: '이너' },
];

const TIPS: Record<PickingKind, string> = {
  single:
    '한 줄을 다운(⊓)·업(V) 번갈아 쳐요. 다운과 업의 소리 크기와 간격이 똑같이 들리게, 피크는 줄을 살짝만 지나가게 작게 움직이세요.',
  crossing:
    '한 박마다 옆 줄로 넘어가요. 줄을 바꿀 때 피크가 크게 튀지 않게, 손목은 그대로 두고 팔이 줄 쪽으로 미끄러지듯 이동하세요.',
  inout:
    '두 줄을 한 음씩 번갈아 쳐요. 아우터는 굵은 줄 다운 → 가는 줄 업이라 피크가 두 줄 바깥에서, 이너는 굵은 줄 업 → 가는 줄 다운이라 두 줄 사이에서 움직여요. 더 어려운 쪽을 따로 연습해 보세요.',
  skip:
    '사이 줄 하나를 건너 번갈아 쳐요. 가운데 줄을 건드리지 않게, 줄을 넘을 때도 피킹 방향을 다운·업 그대로 유지하세요.',
};

export default function Picking(props: ScreenSettingsProps<PickingSettings>) {
  const [s, set] = useScreenSettings(STORAGE_KEY, PICKING_DEFAULTS, props);
  const rounds = useMemo(() => pickingRounds(s), [s]);

  const strings = stringChoices(s.kind);
  const selectedString = validString(s.kind, s.string);

  return (
    <div className="drill">
      <div className="drill-controls">
        <ChoiceRow
          title="종류"
          value={s.kind}
          options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          onChange={(kind) => set({ kind })}
        />
        {s.kind === 'inout' && (
          <ChoiceRow title="방식" value={s.mode} options={MODE_OPTIONS} onChange={(mode) => set({ mode })} />
        )}
        {strings.length > 0 && (
          <ChoiceRow
            title="줄"
            value={selectedString}
            options={strings.map((str) => ({ value: str, label: stringChoiceLabel(s.kind, str) }))}
            onChange={(string) => set({ string })}
          />
        )}

        <div className="scale-row">
          <span className="scale-row-title">프렛</span>
          <div className="fret-stepper">
            <button
              className="scale-chip"
              onClick={() => set({ fret: Math.max(0, s.fret - 1) })}
              disabled={s.fret <= 0}
              aria-label="프렛 내리기"
            >
              −
            </button>
            <span className="fret-value">
              {s.fret === 0 ? '개방' : s.fret}
              {s.fret > 0 && <small>프렛</small>}
            </span>
            <button
              className="scale-chip"
              onClick={() => set({ fret: Math.min(PICKING_FRET_MAX, s.fret + 1) })}
              disabled={s.fret >= PICKING_FRET_MAX}
              aria-label="프렛 올리기"
            >
              +
            </button>
          </div>
        </div>

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
        drillKey={pickingKey(s)}
        label={pickingLabel(s)}
        metronomeLabel="피킹 BPM"
        tip={
          <>
            {TIPS[s.kind]} 개방현으로 칠 때 다른 줄이 울리면 왼손으로 살짝 덮어 막아 주세요.
          </>
        }
      />
    </div>
  );
}
