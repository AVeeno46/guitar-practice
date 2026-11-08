import { useEffect, useMemo, useState } from 'react';
import { clampBpm } from './engine';
import { loadMetronomeSettings, useMetronome } from './useMetronome';
import './mini.css';

interface Props {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  /** 버튼 설명에 쓰는 이름 (예: "연습 BPM") */
  label?: string;
}

/**
 * 다른 화면 아래에 붙여 쓰는 작은 메트로놈.
 * 박자·세분·강박·볼륨은 메트로놈 탭 설정을 따르고, BPM만 부모가 정한다.
 * PC에서는 스페이스바로 시작/정지.
 */
export default function MiniMetronome({ bpm, onBpmChange, label = 'BPM' }: Props) {
  const [base] = useState(loadMetronomeSettings);
  const settings = useMemo(() => ({ ...base, bpm }), [base, bpm]);
  const { running, activeBeat, toggle } = useMetronome(settings);

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

  const step = (delta: number) => onBpmChange(clampBpm(bpm + delta));

  return (
    <div className="mini-metronome">
      <div className="mini-beats" aria-hidden>
        {Array.from({ length: settings.beatsPerBar }, (_, i) => (
          <span
            key={i}
            className={['mini-beat', i === 0 && settings.accentFirst ? 'accent' : '', i === activeBeat ? 'on' : ''].join(' ')}
          />
        ))}
      </div>
      <div className="mini-controls">
        <button className="mini-step" onClick={() => step(-5)} aria-label={`${label} 5 내리기`}>
          −5
        </button>
        <button className="mini-step" onClick={() => step(-1)} aria-label={`${label} 1 내리기`}>
          −1
        </button>
        <span className="mini-bpm">
          {bpm}
          <small>BPM</small>
        </span>
        <button className="mini-step" onClick={() => step(1)} aria-label={`${label} 1 올리기`}>
          +1
        </button>
        <button className="mini-step" onClick={() => step(5)} aria-label={`${label} 5 올리기`}>
          +5
        </button>
        <button className={`mini-play ${running ? 'stop' : ''}`} onClick={toggle} aria-label={running ? '정지' : '시작'}>
          {running ? '■' : '▶'}
        </button>
      </div>
    </div>
  );
}
