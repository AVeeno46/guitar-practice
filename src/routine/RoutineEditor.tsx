import { useState } from 'react';
import type { Song } from '../songs/types';
import {
  ITEM_KINDS,
  KIND_NAME,
  MINUTES_MAX,
  MINUTES_MIN,
  itemLabel,
  newItem,
  totalMinutes,
  type ItemKind,
  type Routine,
  type RoutineItem,
} from './types';

interface Props {
  routine: Routine;
  songs: Song[];
  onChange: (routine: Routine) => void;
  onDelete: () => void;
  onDone: () => void;
}

export default function RoutineEditor({ routine, songs, onChange, onDelete, onDone }: Props) {
  const [adding, setAdding] = useState<ItemKind | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const songTitle = (id: string) => songs.find((s) => s.id === id)?.title;

  const update = (patch: Partial<Routine>) => onChange({ ...routine, ...patch, updatedAt: Date.now() });
  const setItems = (items: RoutineItem[]) => update({ items });

  const setMinutes = (id: string, minutes: number) =>
    setItems(
      routine.items.map((i) =>
        i.id === id ? { ...i, minutes: Math.min(MINUTES_MAX, Math.max(MINUTES_MIN, minutes)) } : i,
      ),
    );

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= routine.items.length) return;
    const items = [...routine.items];
    [items[index], items[to]] = [items[to], items[index]];
    setItems(items);
  };

  const add = (kind: ItemKind) => {
    if (kind === 'song') {
      setAdding('song');
      return;
    }
    setItems([...routine.items, newItem(kind)]);
    setAdding(null);
  };

  return (
    <section className="routine-editor">
      <div className="detail-bar">
        <button className="link-button" onClick={onDone}>
          ‹ 루틴 목록
        </button>
        <span className="muted">총 {totalMinutes(routine)}분</span>
      </div>

      <label className="field">
        <span>이름</span>
        <input
          value={routine.name}
          onChange={(e) => update({ name: e.target.value })}
          onBlur={() => !routine.name.trim() && update({ name: '이름 없는 루틴' })}
          maxLength={40}
        />
      </label>

      {routine.items.length === 0 ? (
        <p className="songs-empty small">아래에서 연습 항목을 추가해 주세요.</p>
      ) : (
        <ol className="routine-items">
          {routine.items.map((item, i) => (
            <li key={item.id} className="routine-item">
              <span className="routine-item-no">{i + 1}</span>
              <span className="routine-item-label">{itemLabel(item, songTitle)}</span>
              <span className="routine-minutes">
                <button
                  className="scale-chip"
                  onClick={() => setMinutes(item.id, item.minutes - 1)}
                  disabled={item.minutes <= MINUTES_MIN}
                  aria-label={`${i + 1}번 항목 1분 줄이기`}
                >
                  −
                </button>
                <span className="routine-minutes-value">
                  {item.minutes}
                  <small>분</small>
                </span>
                <button
                  className="scale-chip"
                  onClick={() => setMinutes(item.id, item.minutes + 1)}
                  disabled={item.minutes >= MINUTES_MAX}
                  aria-label={`${i + 1}번 항목 1분 늘리기`}
                >
                  +
                </button>
              </span>
              <span className="routine-item-actions">
                <button
                  className="icon-button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`${i + 1}번 항목 위로`}
                >
                  ↑
                </button>
                <button
                  className="icon-button"
                  onClick={() => move(i, 1)}
                  disabled={i === routine.items.length - 1}
                  aria-label={`${i + 1}번 항목 아래로`}
                >
                  ↓
                </button>
                <button
                  className="icon-button"
                  onClick={() => setItems(routine.items.filter((x) => x.id !== item.id))}
                  aria-label={`${i + 1}번 항목 빼기`}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="routine-add">
        <span className="routine-add-title">항목 추가</span>
        <div className="scale-chips">
          {ITEM_KINDS.map((k) => (
            <button
              key={k}
              className={`scale-chip wide ${adding === k ? 'selected' : ''}`}
              onClick={() => add(k)}
            >
              + {KIND_NAME[k]}
            </button>
          ))}
        </div>
        {adding === 'song' &&
          (songs.length === 0 ? (
            <p className="songs-empty small">곡 탭에서 곡을 먼저 추가해 주세요.</p>
          ) : (
            <div className="routine-song-pick">
              {songs.map((s) => (
                <button
                  key={s.id}
                  className="scale-chip wide"
                  onClick={() => {
                    setItems([...routine.items, newItem('song', 5, s.id)]);
                    setAdding(null);
                  }}
                >
                  {s.title}
                </button>
              ))}
            </div>
          ))}
      </div>

      <p className="drill-tip">
        크로매틱·스파이더·피킹·스케일은 지금 그 화면에서 쓰던 설정으로 들어가요. 루틴을 진행하다 패턴이나 줄을 바꾸면 이
        루틴에 저장돼요. BPM은 각 연습이 기억하는 값을 그대로 써요.
      </p>

      <div className="routine-danger">
        {confirmDelete ? (
          <>
            <span>이 루틴을 지울까요? (연습 기록은 남아요)</span>
            <button className="link-button" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
            <button className="link-button danger" onClick={onDelete}>
              지우기
            </button>
          </>
        ) : (
          <button className="link-button danger" onClick={() => setConfirmDelete(true)}>
            루틴 지우기
          </button>
        )}
      </div>
    </section>
  );
}
