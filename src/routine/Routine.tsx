import { useCallback, useEffect, useState } from 'react';
import { listSongs } from '../songs/db';
import { newId, type Song } from '../songs/types';
import RoutineEditor from './RoutineEditor';
import RoutineRun from './RoutineRun';
import {
  itemLabel,
  loadRoutines,
  loadRun,
  saveRoutines,
  saveRun,
  totalMinutes,
  type Routine as RoutineT,
  type RoutineItem,
  type RunState,
} from './types';
import './routine.css';

/** 루틴 탭: 목록 → 편집 / 진행 */
export default function Routine() {
  const [routines, setRoutines] = useState<RoutineT[]>(loadRoutines);
  const [songs, setSongs] = useState<Song[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [run, setRunState] = useState<RunState | null>(() => {
    const r = loadRun();
    // 루틴이 지워졌으면 진행 상태도 버린다
    return r && loadRoutines().some((x) => x.id === r.routineId) ? r : null;
  });

  useEffect(() => {
    listSongs().then(setSongs, () => setSongs([]));
  }, []);

  const commit = useCallback((next: RoutineT[]) => {
    setRoutines(next);
    saveRoutines(next);
  }, []);

  const setRun = useCallback((next: RunState | null) => {
    setRunState(next);
    saveRun(next);
  }, []);

  const updateRoutine = (r: RoutineT) => commit(routines.map((x) => (x.id === r.id ? r : x)));

  const updateItem = useCallback(
    (routineId: string, item: RoutineItem) => {
      setRoutines((prev) => {
        const next = prev.map((r) =>
          r.id === routineId ? { ...r, items: r.items.map((i) => (i.id === item.id ? item : i)), updatedAt: Date.now() } : r,
        );
        saveRoutines(next);
        return next;
      });
    },
    [],
  );

  const songTitle = (id: string) => songs.find((s) => s.id === id)?.title;

  // ---------- 진행 ----------
  const running = run ? routines.find((r) => r.id === run.routineId) : undefined;
  if (run && running) {
    return (
      <RoutineRun
        routine={running}
        songs={songs}
        run={run}
        onRunChange={setRun}
        onItemChange={(item) => updateItem(running.id, item)}
        onSongChange={(song) => setSongs((prev) => prev.map((s) => (s.id === song.id ? song : s)))}
      />
    );
  }

  // ---------- 편집 ----------
  const editing = routines.find((r) => r.id === editingId);
  if (editing) {
    return (
      <RoutineEditor
        routine={editing}
        songs={songs}
        onChange={updateRoutine}
        onDelete={() => {
          commit(routines.filter((r) => r.id !== editing.id));
          setEditingId(null);
        }}
        onDone={() => setEditingId(null)}
      />
    );
  }

  // ---------- 목록 ----------
  const create = () => {
    const r: RoutineT = { id: newId(), name: `루틴 ${routines.length + 1}`, items: [], updatedAt: Date.now() };
    commit([...routines, r]);
    setEditingId(r.id);
  };

  const start = (r: RoutineT) =>
    setRun({ routineId: r.id, index: 0, phase: 'ready', elapsedMs: 0, runningSince: null, extraMs: 0, doneMs: 0 });

  return (
    <section className="routine-list-screen">
      <p className="drill-tip">
        연습을 순서대로 묶어 두고 시간에 맞춰 진행해요. 항목 시간이 끝나면 알림음이 울리고, 다음 항목은 준비되면 눌러서
        시작해요.
      </p>

      {routines.length === 0 ? (
        <p className="songs-empty">아직 루틴이 없어요.</p>
      ) : (
        <ul className="song-list">
          {routines.map((r) => (
            <li key={r.id} className="routine-card-item">
              <div className="song-card routine-summary">
                <div className="song-card-head">
                  <span className="song-card-title">{r.name}</span>
                  <span className="song-card-bpm">
                    {r.items.length}개 · <strong>{totalMinutes(r)}</strong>분
                  </span>
                </div>
                {r.items.length > 0 && (
                  <ol className="routine-mini">
                    {r.items.map((i) => (
                      <li key={i.id}>
                        {itemLabel(i, songTitle)} <span className="muted">{i.minutes}분</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="routine-summary-actions">
                  <button className="link-button" onClick={() => setEditingId(r.id)}>
                    편집
                  </button>
                  <button className="routine-start" onClick={() => start(r)} disabled={r.items.length === 0}>
                    ▶ 시작
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button className="song-add" onClick={create}>
        + 새 루틴
      </button>
    </section>
  );
}
