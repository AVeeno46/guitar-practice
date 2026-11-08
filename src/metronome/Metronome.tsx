import { useEffect, useRef, useState } from 'react';
import {
  BPM_MAX,
  BPM_MIN,
  TapTempo,
  clampBpm,
  type MetronomeSettings,
  type Subdivision,
} from './engine';
import { saveLocal } from '../storage';
import { METRONOME_STORAGE_KEY, loadMetronomeSettings, useMetronome } from './useMetronome';
import './metronome.css';

const TIME_SIGNATURES = [2, 3, 4, 5, 6, 7];

const SUBDIVISIONS: { value: Subdivision; label: string; title: string }[] = [
  { value: 1, label: '♩', title: '4분음표' },
  { value: 2, label: '♫', title: '8분음표' },
  { value: 3, label: '3', title: '셋잇단' },
  { value: 4, label: '♬', title: '16분음표' },
];

function tempoName(bpm: number) {
  if (bpm < 60) return 'Largo';
  if (bpm < 76) return 'Adagio';
  if (bpm < 108) return 'Andante';
  if (bpm < 120) return 'Moderato';
  if (bpm < 168) return 'Allegro';
  return 'Presto';
}

export default function Metronome() {
  const [settings, setSettings] = useState<MetronomeSettings>(loadMetronomeSettings);
  const { running, activeBeat, toggle } = useMetronome(settings);
  const tapRef = useRef<TapTempo | null>(null);

  useEffect(() => {
    saveLocal(METRONOME_STORAGE_KEY, settings);
  }, [settings]);

  const set = (patch: Partial<MetronomeSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const changeBpm = (bpm: number) => set({ bpm: clampBpm(bpm) });

  // 키보드: 스페이스 재생/정지, 위아래 화살표 BPM
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setSettings((s) => ({ ...s, bpm: clampBpm(s.bpm + (e.shiftKey ? 5 : 1)) }));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setSettings((s) => ({ ...s, bpm: clampBpm(s.bpm - (e.shiftKey ? 5 : 1)) }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onTap = () => {
    tapRef.current ??= new TapTempo();
    const bpm = tapRef.current.tap();
    if (bpm) changeBpm(bpm);
  };

  return (
    <section className="metronome">
      <div className="beats" aria-hidden>
        {Array.from({ length: settings.beatsPerBar }, (_, i) => (
          <span
            key={i}
            className={[
              'beat',
              i === 0 && settings.accentFirst ? 'accent' : '',
              i === activeBeat ? 'on' : '',
            ].join(' ')}
          />
        ))}
      </div>

      <div className="bpm-display">
        <button className="step" onClick={() => changeBpm(settings.bpm - 5)} aria-label="BPM 5 내리기">
          −5
        </button>
        <button className="step" onClick={() => changeBpm(settings.bpm - 1)} aria-label="BPM 1 내리기">
          −1
        </button>
        <div className="bpm-value">
          <input
            type="number"
            inputMode="numeric"
            min={BPM_MIN}
            max={BPM_MAX}
            value={settings.bpm}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) set({ bpm: n });
            }}
            onBlur={() => changeBpm(settings.bpm)}
            aria-label="BPM"
          />
          <span className="bpm-label">BPM · {tempoName(settings.bpm)}</span>
        </div>
        <button className="step" onClick={() => changeBpm(settings.bpm + 1)} aria-label="BPM 1 올리기">
          +1
        </button>
        <button className="step" onClick={() => changeBpm(settings.bpm + 5)} aria-label="BPM 5 올리기">
          +5
        </button>
      </div>

      <input
        className="bpm-slider"
        type="range"
        min={BPM_MIN}
        max={BPM_MAX}
        value={settings.bpm}
        onChange={(e) => changeBpm(Number(e.target.value))}
        aria-label="BPM 슬라이더"
      />

      <div className="transport">
        <button className="tap" onClick={onTap}>
          탭
        </button>
        <button className={`play ${running ? 'stop' : ''}`} onClick={toggle}>
          {running ? '정지' : '시작'}
        </button>
        <button
          className={`tap ${settings.accentFirst ? 'active' : ''}`}
          onClick={() => set({ accentFirst: !settings.accentFirst })}
          aria-pressed={settings.accentFirst}
        >
          강박
        </button>
      </div>

      <div className="option-group">
        <span className="option-title">박자</span>
        <div className="chips">
          {TIME_SIGNATURES.map((n) => (
            <button
              key={n}
              className={`chip ${settings.beatsPerBar === n ? 'selected' : ''}`}
              onClick={() => set({ beatsPerBar: n })}
            >
              {n}/4
            </button>
          ))}
        </div>
      </div>

      <div className="option-group">
        <span className="option-title">세분</span>
        <div className="chips">
          {SUBDIVISIONS.map((s) => (
            <button
              key={s.value}
              title={s.title}
              className={`chip ${settings.subdivision === s.value ? 'selected' : ''}`}
              onClick={() => set({ subdivision: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="option-group">
        <span className="option-title">볼륨</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(e) => set({ volume: Number(e.target.value) })}
          aria-label="볼륨"
        />
      </div>

      <p className="hint">PC에서는 스페이스바로 시작/정지, ↑↓로 BPM 조절 (Shift는 5씩)</p>
    </section>
  );
}
