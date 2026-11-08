import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MiniMetronome from '../metronome/MiniMetronome';
import { usePracticeActivity } from '../practice/hooks';
import { saveSong } from './db';
import SheetView from './SheetView';
import { progressOf, withPracticeBpm, type Song } from './types';
import { BPM_MAX } from '../metronome/engine';
import { loadLocal, saveLocal } from '../storage';
import SongTab from './tab/SongTab';
import { exportSong } from './songFile';
import { barCount, normalizeScore, type TabScore } from './tab/score';
import { SPEED_STEP, useTabPlayer, type LoopRange, type PlayOptions } from './tab/useTabPlayer';

const PLAY_OPTIONS_KEY = 'gp.tabPlay';
const PLAY_DEFAULTS: PlayOptions = { sound: true, click: true, speedUp: false };

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
  usePracticeActivity({ key: `song:${song.id}`, kind: 'song', label: song.title, bpm: song.practiceBpm, refId: song.id });
  // 버튼을 빠르게 연달아 눌러도 직전 값에 이어서 계산하도록 최신 곡을 따로 들고 있는다
  const latest = useRef(song);
  useEffect(() => {
    latest.current = song;
  }, [song]);

  const changeBpmRef = useRef<(bpm: number) => void>(() => {});
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

  useEffect(() => {
    changeBpmRef.current = changeBpm;
  });

  const saveTab = (tab: TabScore | null) => {
    const next = { ...latest.current, tab, updatedAt: Date.now() };
    latest.current = next;
    onChange(next);
    saveSong(next).then(
      () => setSaveError(false),
      () => setSaveError(true),
    );
  };

  // ---------- TAB 악보 연습 ----------
  const score = useMemo(() => (song.tab ? normalizeScore(song.tab) : null), [song.tab]);
  const [editingTab, setEditingTab] = useState(false);
  const [loopRaw, setLoop] = useState<LoopRange | null>(null);
  const loop = score && loopRaw && loopRaw.to < barCount(score) ? loopRaw : null;
  const [playOptions, setPlayOptionsState] = useState<PlayOptions>(() => loadLocal(PLAY_OPTIONS_KEY, PLAY_DEFAULTS));
  const setPlayOptions = (o: PlayOptions) => {
    setPlayOptionsState(o);
    saveLocal(PLAY_OPTIONS_KEY, o);
  };

  // 점점 빠르게: 한 바퀴 돌 때마다 +2 BPM, 목표 BPM이 있으면 거기서 멈춘다
  const onPass = useCallback(() => {
    if (!playOptions.speedUp) return;
    const cur = latest.current;
    const cap = cur.targetBpm && cur.practiceBpm < cur.targetBpm ? cur.targetBpm : cur.targetBpm ? cur.practiceBpm : BPM_MAX;
    const nextBpm = Math.min(cap, cur.practiceBpm + SPEED_STEP);
    if (nextBpm > cur.practiceBpm) changeBpmRef.current(nextBpm);
  }, [playOptions.speedUp]);
  const player = useTabPlayer(score, loop, playOptions, song.practiceBpm, onPass);

  const progress = progressOf(song);
  const reached = progress !== null && progress >= 1;
  const history = song.bpmLog.slice(-6);

  return (
    <section className="song-detail">
      <div className="detail-bar">
        <button className="link-button" onClick={onBack}>
          ‹ 목록
        </button>
        <span className="detail-bar-actions">
          <button className="link-button" onClick={() => void exportSong(latest.current)}>
            내보내기
          </button>
          <button className="link-button" onClick={onEdit}>
            편집
          </button>
        </span>
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

      <SongTab
        score={score}
        onScoreChange={saveTab}
        editing={editingTab}
        onEditingChange={setEditingTab}
        loop={loop}
        onLoopChange={setLoop}
        options={playOptions}
        onOptionsChange={setPlayOptions}
        player={player}
        targetBpm={song.targetBpm}
        practiceBpm={song.practiceBpm}
      />

      {song.sheets.length > 0 ? (
        <div className="sheets">
          <h3 className="sheets-title">악보 사진·PDF</h3>
          {song.sheets.map((s) => (
            <SheetView key={s.id} sheet={s} />
          ))}
        </div>
      ) : (
        !editingTab && (
          <p className="songs-empty small">
            종이 악보가 있다면 <button className="link-button inline" onClick={onEdit}>편집</button>에서 사진이나 PDF로 추가할 수도 있어요.
          </p>
        )
      )}

      {/* 악보를 보는 동안에도 손이 닿도록 아래에 붙어 있는 메트로놈. BPM이 곧 이 곡의 연습 BPM.
          TAB이 있으면 TAB의 박자·리듬으로 맞추고 커서·소리를 함께 낸다. 편집 중에는 입력 패드가 대신 붙는다 */}
      {!editingTab && (
        <MiniMetronome
          bpm={song.practiceBpm}
          onBpmChange={changeBpm}
          label="연습 BPM"
          subdivision={score?.notesPerBeat}
          beatsPerBar={score?.beatsPerBar}
          click={score ? playOptions.click : true}
          onTick={score ? player.onTick : undefined}
          onSchedule={score ? player.onSchedule : undefined}
          tempoScale={score ? player.tempoScale : undefined}
        />
      )}
    </section>
  );
}
