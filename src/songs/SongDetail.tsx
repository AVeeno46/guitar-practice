import { useEffect, useRef, useState } from 'react';
import MiniMetronome from '../metronome/MiniMetronome';
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
  const [saveError, setSaveError] = useState(false);
  // 버튼을 빠르게 연달아 눌러도 직전 값에 이어서 계산하도록 최신 곡을 따로 들고 있는다
  const latest = useRef(song);
  useEffect(() => {
    latest.current = song;
  }, [song]);

  const changeBpm = (bpm: number) => {
    const current = latest.current;
    if (bpm === current.practiceBpm) return;
    const next = withPracticeBpm(current, bpm);
    latest.current = next;
    onChange(next);
    saveSong(next).then(
      () => setSaveError(false),
      () => setSaveError(true),
    );
  };

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

      {/* 악보를 넘기는 동안에도 손이 닿도록 아래에 붙어 있는 메트로놈. BPM이 곧 이 곡의 연습 BPM */}
      <MiniMetronome bpm={song.practiceBpm} onBpmChange={changeBpm} label="연습 BPM" />
    </section>
  );
}
