import { useEffect, useRef, useState } from 'react';
import Chromatic from '../basics/Chromatic';
import Picking from '../basics/Picking';
import Spider from '../basics/Spider';
import Metronome from '../metronome/Metronome';
import { notePracticeInteraction, noteRoutine } from '../practice/tracker';
import Scales from '../scales/Scales';
import SongDetail from '../songs/SongDetail';
import type { Song } from '../songs/types';
import { playChime, unlockChime } from './chime';
import { itemLabel, totalMinutes, type Routine, type RoutineItem, type RunState } from './types';

interface Props {
  routine: Routine;
  songs: Song[];
  run: RunState;
  onRunChange: (run: RunState | null) => void;
  onItemChange: (item: RoutineItem) => void;
  onSongChange: (song: Song) => void;
}

const fmt = (ms: number) => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const fmtMinutes = (ms: number) => {
  const min = Math.round(ms / 60000);
  return min < 1 ? '1분 미만' : `${min}분`;
};

/** 연습하는 동안 화면이 꺼지지 않게 (지원하는 브라우저만) */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = () => {
      nav.wakeLock?.request('screen').then(
        (l) => {
          if (cancelled) void l.release();
          else lock = l;
        },
        () => {},
      );
    };
    request();
    // 다른 앱에 갔다 오면 풀리므로 다시 건다
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [on]);
}

export default function RoutineRun({ routine, songs, run, onRunChange, onItemChange, onSongChange }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [confirmStop, setConfirmStop] = useState(false);
  const items = routine.items;
  const item = items[run.index] as RoutineItem | undefined;
  const songTitle = (id: string) => songs.find((s) => s.id === id)?.title;

  const ticking = run.phase === 'playing' && run.runningSince !== null;
  useWakeLock(run.phase === 'playing');

  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [ticking]);

  const elapsed = run.elapsedMs + (run.runningSince !== null ? Math.max(0, now - run.runningSince) : 0);
  const duration = item ? item.minutes * 60_000 + run.extraMs : 0;
  const remaining = duration - elapsed;

  // 시간이 다 되면 알림음 + 다음 항목 기다리기 (메트로놈은 화면이 바뀌면서 멈춘다)
  const latestRun = useRef(run);
  useEffect(() => {
    latestRun.current = run;
  });
  useEffect(() => {
    if (run.phase !== 'playing' || remaining > 0) return;
    const r = latestRun.current;
    playChime();
    notePracticeInteraction();
    const last = r.index >= items.length - 1;
    onRunChange({
      ...r,
      phase: last ? 'done' : 'between',
      runningSince: null,
      elapsedMs: duration,
      doneMs: r.doneMs + duration,
    });
  }, [run.phase, remaining, duration, items.length, onRunChange]);

  const startItem = (index: number, doneMs = run.doneMs) => {
    unlockChime();
    noteRoutine(routine.name);
    const t = Date.now();
    setNow(t);
    onRunChange({ ...run, index, phase: 'playing', elapsedMs: 0, extraMs: 0, runningSince: t, doneMs });
  };

  const togglePause = () => {
    const t = Date.now();
    setNow(t);
    if (run.runningSince !== null) {
      onRunChange({ ...run, elapsedMs: elapsed, runningSince: null });
    } else {
      unlockChime();
      onRunChange({ ...run, runningSince: t });
    }
  };

  const oneMore = () => {
    unlockChime();
    const t = Date.now();
    setNow(t);
    const r = latestRun.current;
    onRunChange({ ...r, phase: 'playing', extraMs: r.extraMs + 60_000, runningSince: t, doneMs: r.doneMs - r.elapsedMs });
  };

  /** 지금 항목을 여기까지 하고 다른 항목으로 (건너뛰기·이전) */
  const goTo = (index: number) => {
    const spent = run.phase === 'playing' ? elapsed : 0;
    const doneMs = run.doneMs + spent;
    notePracticeInteraction();
    if (index >= items.length) {
      onRunChange({ ...run, phase: 'done', runningSince: null, doneMs });
    } else {
      const t = Date.now();
      setNow(t);
      onRunChange({ ...run, index, phase: 'ready', elapsedMs: 0, extraMs: 0, runningSince: null, doneMs });
    }
  };

  const stop = () => onRunChange(null);

  // ---------- 화면 ----------

  if (run.phase === 'done' || !item) {
    return (
      <section className="routine-run">
        <div className="routine-finish">
          <span className="routine-finish-icon" aria-hidden>
            ✓
          </span>
          <h2>{routine.name} 완료</h2>
          <p className="muted">연습한 시간 {fmtMinutes(run.doneMs)}</p>
          <button className="song-add" onClick={stop}>
            끝내기
          </button>
          <p className="drill-tip">연습 시간은 기록 탭에 &lsquo;루틴: {routine.name}&rsquo;으로 남아요.</p>
        </div>
      </section>
    );
  }

  const nextItem = items[run.index + 1];
  const header = (
    <div className="routine-head">
      <div className="routine-head-top">
        <span className="routine-step">
          {run.index + 1}/{items.length}
        </span>
        <span className="routine-head-label">{itemLabel(item, songTitle)}</span>
      </div>
      {run.phase === 'playing' && (
        <>
          <div className="routine-head-timer">
            <span className={`routine-remaining ${run.runningSince === null ? 'paused' : ''}`}>{fmt(remaining)}</span>
            <span className="routine-head-buttons">
              <button className="routine-ctrl" onClick={() => goTo(run.index - 1)} disabled={run.index === 0} aria-label="이전 항목">
                ⏮
              </button>
              <button className="routine-ctrl main" onClick={togglePause} aria-label={run.runningSince === null ? '계속' : '일시정지'}>
                {run.runningSince === null ? '▶' : '❚❚'}
              </button>
              <button className="routine-ctrl" onClick={() => goTo(run.index + 1)} aria-label="다음 항목으로 건너뛰기">
                ⏭
              </button>
            </span>
          </div>
          <span className="progress" aria-hidden>
            <span className="progress-fill" style={{ width: `${Math.min(1, elapsed / duration) * 100}%` }} />
          </span>
        </>
      )}
    </div>
  );

  if (run.phase === 'ready' || run.phase === 'between') {
    const upcoming = run.phase === 'ready' ? item : nextItem!;
    const upcomingIndex = run.phase === 'ready' ? run.index : run.index + 1;
    return (
      <section className="routine-run">
        <div className="routine-card">
          {run.phase === 'between' ? (
            <>
              <p className="routine-card-kicker">✓ {itemLabel(item, songTitle)} 끝</p>
              <p className="routine-card-next muted">다음</p>
            </>
          ) : (
            <p className="routine-card-kicker">
              {routine.name} · 총 {totalMinutes(routine)}분
            </p>
          )}
          <h2 className="routine-card-title">
            <span className="routine-step">
              {upcomingIndex + 1}/{items.length}
            </span>{' '}
            {itemLabel(upcoming, songTitle)}
          </h2>
          <p className="muted">{upcoming.minutes}분</p>
          <button className="song-add" onClick={() => startItem(upcomingIndex)}>
            시작
          </button>
          {run.phase === 'between' && (
            <button className="link-button" onClick={oneMore}>
              방금 것 1분 더
            </button>
          )}
        </div>

        <ol className="routine-overview">
          {items.map((it, i) => (
            <li
              key={it.id}
              className={i < upcomingIndex ? 'done' : i === upcomingIndex ? 'current' : ''}
            >
              <span>{itemLabel(it, songTitle)}</span>
              <span className="muted">{it.minutes}분</span>
            </li>
          ))}
        </ol>

        <div className="routine-run-footer">
          {run.phase === 'ready' && run.index < items.length - 1 && (
            <button className="link-button" onClick={() => goTo(run.index + 1)}>
              이 항목 건너뛰기
            </button>
          )}
          <StopButton confirm={confirmStop} setConfirm={setConfirmStop} onStop={stop} />
        </div>
      </section>
    );
  }

  // playing: 그 연습 화면을 그대로 띄운다
  const song = item.kind === 'song' ? songs.find((s) => s.id === item.songId) : undefined;
  return (
    <section className="routine-run playing">
      {header}
      <div className="routine-screen">
        {item.kind === 'chromatic' ? (
          <Chromatic key={item.id} initial={item.settings} onSettingsChange={(settings) => onItemChange({ ...item, settings })} />
        ) : item.kind === 'spider' ? (
          <Spider key={item.id} initial={item.settings} onSettingsChange={(settings) => onItemChange({ ...item, settings })} />
        ) : item.kind === 'picking' ? (
          <Picking key={item.id} initial={item.settings} onSettingsChange={(settings) => onItemChange({ ...item, settings })} />
        ) : item.kind === 'scale' ? (
          <Scales key={item.id} initial={item.settings} onSettingsChange={(settings) => onItemChange({ ...item, settings })} />
        ) : item.kind === 'song' ? (
          song ? (
            <SongDetail key={item.id} song={song} embedded onChange={onSongChange} />
          ) : (
            <p className="songs-empty">이 곡을 찾을 수 없어요. 지워졌다면 ⏭로 건너뛰어 주세요.</p>
          )
        ) : item.kind === 'metronome' ? (
          <Metronome key={item.id} />
        ) : (
          <p className="routine-free">
            자유롭게 연습하세요. 시간이 다 되면 알림음이 울려요.
            {nextItem && <span className="muted"> 다음: {itemLabel(nextItem, songTitle)}</span>}
          </p>
        )}
      </div>
      <div className="routine-run-footer">
        <StopButton confirm={confirmStop} setConfirm={setConfirmStop} onStop={stop} />
      </div>
    </section>
  );
}

function StopButton({ confirm, setConfirm, onStop }: { confirm: boolean; setConfirm: (v: boolean) => void; onStop: () => void }) {
  return confirm ? (
    <span className="routine-stop-confirm">
      루틴을 그만할까요?
      <button className="link-button" onClick={() => setConfirm(false)}>
        계속하기
      </button>
      <button className="link-button danger" onClick={onStop}>
        그만하기
      </button>
    </span>
  ) : (
    <button className="link-button muted-link" onClick={() => setConfirm(true)}>
      루틴 그만하기
    </button>
  );
}
