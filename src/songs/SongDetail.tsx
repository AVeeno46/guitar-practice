import { useEffect, useMemo, useRef, useState } from 'react';
import { clampBpm } from '../metronome/engine';
import { loadMetronomeSettings, useMetronome } from '../metronome/useMetronome';
import { saveSong } from './db';
import SheetView from './SheetView';
import { progressOf, withPracticeBpm, type Song } from './types';

interface Props {
  song: Song;
  onBack: () => void;
  onEdit: () => void;
  onChange: (song: Song) => void;
}

const formatDay = (date: string) => {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
};

export default function SongDetail({ song, onBack, onEdit, onChange }: Props) {
  // 박자·세분·볼륨은 메트로놈 탭 설정을 따르고, BPM만 이 곡의 연습 BPM을 쓴다
  const [baseSettings] = useState(loadMetronomeSettings);
  const settings = useMemo(
    () => ({ ...baseSettings, bpm: song.practiceBpm }),
    [baseSettings, song.practiceBpm],
  );
  const { running, activeBeat, toggle } = useMetronome(settings);
  const [saveError, setSaveError] = useState(false);
  // 버튼을 빠르게 연달아 눌러도 직전 값에 이어서 계산하도록 최신 곡을 따로 들고 있는다
  const latest = useRef(song);
  useEffect(() => {
    latest.current = song;
  }, [song]);

  const changeBpm = (delta: number) => {
    const current = latest.current;
    const bpm = clampBpm(current.practiceBpm + delta);
    if (bpm === current.practiceBpm) return;
    const next = withPracticeBpm(current, bpm);
    latest.current = next;
    onChange(next);
    saveSong(next).then(
      () => setSaveError(false),
      () => setSaveError(true),
    );
  };

  // PC: 스페이스로 시작/정지
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const progress = progressOf(song);
  const reached = progress !== null && progress >= 1;
  const history = song.bpmLog.slice(-6);

  return (
    <section className="song-detail">
      <div className="detail-bar">
        <button className="link-button" onClick={onBack}>
          ‹ 목록
        </button>
        <button className="link-button" onClick={onEdit}>
          편집
        </button>
      </div>

      <div className="detail-head">
        <h2>{song.title}</h2>
        {song.artist && <p className="detail-artist">{song.artist}</p>}
      </div>

      <div className="detail-card">
        <div className="detail-bpms">
          <div>
            <span className="detail-label">연습</span>
            <span className="detail-number">{song.practiceBpm}</span>
          </div>
          <span className="detail-arrow" aria-hidden>
            →
          </span>
          <div>
            <span className="detail-label">목표</span>
            <span className="detail-number muted">{song.targetBpm ?? '–'}</span>
          </div>
        </div>
        {progress !== null && (
          <>
            <span className="progress" aria-hidden>
              <span className={`progress-fill ${reached ? 'done' : ''}`} style={{ width: `${progress * 100}%` }} />
            </span>
            <p className="detail-note">
              {reached
                ? '목표 BPM 달성! 목표를 올려 보세요.'
                : `목표까지 ${song.targetBpm! - song.practiceBpm} BPM 남았어요`}
            </p>
          </>
        )}
        {history.length > 1 && (
          <p className="detail-history">
            {history.map((e, i) => (
              <span key={e.date}>
                {i > 0 && <span className="muted"> → </span>}
                <span className="muted">{formatDay(e.date)}</span> {e.bpm}
              </span>
            ))}
          </p>
        )}
        {saveError && <p className="form-error">BPM을 저장하지 못했어요.</p>}
      </div>

      {song.memo && <p className="detail-memo">{song.memo}</p>}

      {song.sheets.length > 0 ? (
        <div className="sheets">
          {song.sheets.map((s) => (
            <SheetView key={s.id} sheet={s} />
          ))}
        </div>
      ) : (
        <p className="songs-empty small">
          악보가 없어요. <button className="link-button inline" onClick={onEdit}>편집</button>에서 사진이나 PDF를 추가할 수 있어요.
        </p>
      )}

      {/* 악보를 넘기는 동안에도 손이 닿도록 아래에 붙어 있는 메트로놈 */}
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
          <button className="step" onClick={() => changeBpm(-5)} aria-label="연습 BPM 5 내리기">
            −5
          </button>
          <button className="step" onClick={() => changeBpm(-1)} aria-label="연습 BPM 1 내리기">
            −1
          </button>
          <span className="mini-bpm">
            {song.practiceBpm}
            <small>BPM</small>
          </span>
          <button className="step" onClick={() => changeBpm(1)} aria-label="연습 BPM 1 올리기">
            +1
          </button>
          <button className="step" onClick={() => changeBpm(5)} aria-label="연습 BPM 5 올리기">
            +5
          </button>
          <button className={`mini-play ${running ? 'stop' : ''}`} onClick={toggle} aria-label={running ? '정지' : '시작'}>
            {running ? '■' : '▶'}
          </button>
        </div>
      </div>
    </section>
  );
}
