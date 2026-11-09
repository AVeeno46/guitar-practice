import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { clampBpm, type MetronomeSettings, type ScheduleListener, type Subdivision, type TempoScale } from './engine';
import { loadMetronomeSettings, useMetronome } from './useMetronome';
import './mini.css';

interface Props {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  /** 버튼 설명에 쓰는 이름 (예: "연습 BPM") */
  label?: string;
  /** 박을 몇 개로 쪼갤지. 주면 메트로놈 탭 설정 대신 이 값을 쓴다 (연습 화면의 박당 음 수) */
  subdivision?: Subdivision;
  /** 소리가 날 때마다 몇 번째 소리인지 알려준다 (정지하면 -1) */
  onTick?: (index: number, settings: MetronomeSettings) => void;
  /** 한 마디 박 수. 주면 메트로놈 탭 설정 대신 이 값을 쓴다 (TAB 악보의 박자) */
  beatsPerBar?: number;
  /** false면 클릭 소리를 끈다 (TAB 소리만 듣고 싶을 때) */
  click?: boolean;
  /** 한 박에 클릭 몇 번 (subdivision보다 적게 하면 박 나눔은 유지하고 소리만 줄인다) */
  clicksPerBeat?: number;
  /** 소리를 예약할 때마다 불린다 (TAB 음을 같은 시계에 맞춰 예약) */
  onSchedule?: ScheduleListener;
  /** 소리 번호마다 템포 배율 (TAB 악보 중간 템포 변경) */
  tempoScale?: TempoScale;
}

// 슬라이더는 자주 쓰는 범위만: 폭이 좁은 폰에서도 1~2 BPM 단위로 움직이게
const SLIDER_MIN = 40;
const SLIDER_MAX = 240;

const HOLD_DELAY_MS = 400; // 누르고 있으면 이 시간 뒤부터
const HOLD_REPEAT_MS = 90; // 이 간격으로 반복

/**
 * 다른 화면 아래에 붙여 쓰는 작은 메트로놈.
 * 박자·세분·강박·볼륨은 메트로놈 탭 설정을 따르고, BPM만 부모가 정한다.
 * ± 버튼은 누르고 있으면 계속 바뀌고, 슬라이더로 크게 옮길 수 있다.
 * PC에서는 스페이스바로 시작/정지.
 */
export default function MiniMetronome({
  bpm,
  onBpmChange,
  label = 'BPM',
  subdivision,
  onTick,
  beatsPerBar,
  click = true,
  onSchedule,
  tempoScale,
  clicksPerBeat,
}: Props) {
  const [base] = useState(loadMetronomeSettings);
  const settings = useMemo(
    () => ({
      ...base,
      bpm,
      subdivision: subdivision ?? base.subdivision,
      beatsPerBar: beatsPerBar ?? base.beatsPerBar,
      volume: click ? base.volume : 0,
    }),
    [base, bpm, subdivision, beatsPerBar, click],
  );
  const { running, activeBeat, tickIndex, toggle } = useMetronome(settings, onSchedule, tempoScale, clicksPerBeat);

  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);
  useEffect(() => {
    onTickRef.current?.(tickIndex, settings);
  }, [tickIndex, settings]);

  // 누르고 있는 동안 반복할 때 직전 값에 이어서 계산하도록 최신 BPM을 따로 둔다
  const bpmRef = useRef(bpm);
  const changeRef = useRef(onBpmChange);
  useEffect(() => {
    bpmRef.current = bpm;
    changeRef.current = onBpmChange;
  }, [bpm, onBpmChange]);

  const holdTimer = useRef<number | null>(null);

  const step = (delta: number) => {
    const next = clampBpm(bpmRef.current + delta);
    if (next === bpmRef.current) return;
    bpmRef.current = next;
    changeRef.current(next);
  };

  const stopHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const startHold = (delta: number) => {
    stopHold();
    step(delta);
    const repeat = () => {
      step(delta);
      holdTimer.current = window.setTimeout(repeat, HOLD_REPEAT_MS);
    };
    holdTimer.current = window.setTimeout(repeat, HOLD_DELAY_MS);
  };

  useEffect(() => stopHold, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const stepButton = (delta: number) => (
    <button
      className="mini-step"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        startHold(delta);
      }}
      onPointerUp={stopHold}
      onPointerCancel={stopHold}
      onLostPointerCapture={stopHold}
      onContextMenu={(e) => e.preventDefault()}
      // 키보드(Enter)로 누른 경우(detail 0)만 click으로 처리. 포인터는 위에서 이미 반영했다.
      onClick={(e) => {
        if (e.detail === 0) step(delta);
      }}
      aria-label={`${label} ${Math.abs(delta)} ${delta > 0 ? '올리기' : '내리기'}`}
    >
      {delta > 0 ? `+${delta}` : `−${-delta}`}
    </button>
  );

  const onSliderKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    // 슬라이더에 포커스가 있을 때 스페이스는 시작/정지로
    if (e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className="mini-metronome">
      <div className="mini-controls">
        {stepButton(-5)}
        {stepButton(-1)}
        <div className="mini-center">
          <div className="mini-beats" aria-hidden>
            {Array.from({ length: settings.beatsPerBar }, (_, i) => (
              <span
                key={i}
                className={['mini-beat', i === 0 && settings.accentFirst ? 'accent' : '', i === activeBeat ? 'on' : ''].join(' ')}
              />
            ))}
          </div>
          <span className="mini-bpm">
            {bpm}
            <small>BPM</small>
          </span>
        </div>
        {stepButton(1)}
        {stepButton(5)}
      </div>
      <div className="mini-row">
        <input
          className="mini-slider"
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, bpm))}
          onChange={(e) => {
            const next = clampBpm(Number(e.target.value));
            bpmRef.current = next;
            onBpmChange(next);
          }}
          onKeyDown={onSliderKey}
          aria-label={`${label} 슬라이더`}
        />
        <button className={`mini-play ${running ? 'stop' : ''}`} onClick={toggle} aria-label={running ? '정지' : '시작'}>
          {running ? '■' : '▶'}
        </button>
      </div>
    </div>
  );
}
