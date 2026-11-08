import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { deleteSession, listSessions, saveSession } from './db';
import { formatDate, formatDuration, formatTime, loadGoals, saveGoals, type Goals } from './format';
import { usePractice } from './hooks';
import type { PracticeSession } from './types';
import { listSongs } from '../songs/db';
import { todayKey, type BpmEntry, type Song } from '../songs/types';
import { loadDrills } from '../basics/drillStore';
import './practice.css';

const DAY_MS = 24 * 60 * 60 * 1000;

const parts = (key: string) => key.split('-').map(Number);
/** 0 = 일요일 */
const weekdayOf = (key: string) => {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d).getDay();
};

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + n));
};

export default function Log() {
  const practice = usePractice();
  const [sessions, setSessions] = useState<PracticeSession[] | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [goals, setGoals] = useState<Goals>(loadGoals);
  const today = todayKey();
  const [selected, setSelected] = useState(today);

  // 연습이 저장될 때마다(savedCount) 다시 불러온다
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [practice.savedCount]);

  useEffect(() => {
    listSongs()
      .then(setSongs)
      .catch(() => {});
  }, []);

  const changeGoals = (patch: Partial<Goals>) => {
    const next = { ...goals, ...patch };
    setGoals(next);
    saveGoals(next);
  };

  // 날짜별 연습 초. 진행 중인 연습도 시작한 날에 더한다
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions ?? []) map.set(s.date, (map.get(s.date) ?? 0) + s.seconds);
    if (practice.running && practice.start !== null) {
      const d = todayKey(new Date(practice.start));
      map.set(d, (map.get(d) ?? 0) + practice.seconds);
    }
    return map;
  }, [sessions, practice.running, practice.start, practice.seconds]);

  if (!sessions) return null;

  const minSec = goals.minMinutes * 60;
  const todaySec = totals.get(today) ?? 0;

  // 최소 목표를 채운 날이 이어진 수. 오늘 아직 못 채웠으면 어제부터 센다
  let streak = 0;
  for (let d = todaySec >= minSec ? today : addDays(today, -1); (totals.get(d) ?? 0) >= minSec; d = addDays(d, -1)) {
    streak++;
  }

  const sumSince = (fromKey: string) =>
    [...totals.entries()].filter(([d]) => d >= fromKey && d <= today).reduce((t, [, s]) => t + s, 0);
  const weekStart = addDays(today, -weekdayOf(today)); // 일요일부터
  const monthStart = `${today.slice(0, 8)}01`;

  return (
    <section className="log">
      <TodayCard
        seconds={todaySec}
        goals={goals}
        streak={streak}
        running={practice.running}
        onGoals={changeGoals}
      />

      <div className="log-stats">
        <div>
          <span className="log-stat-label">이번 주</span>
          <span className="log-stat-value">{formatDuration(sumSince(weekStart))}</span>
        </div>
        <div>
          <span className="log-stat-label">이번 달</span>
          <span className="log-stat-value">{formatDuration(sumSince(monthStart))}</span>
        </div>
        <div>
          <span className="log-stat-label">전체</span>
          <span className="log-stat-value">
            {formatDuration([...totals.values()].reduce((a, b) => a + b, 0))}
          </span>
        </div>
      </div>

      <Heatmap totals={totals} goals={goals} today={today} selected={selected} onSelect={setSelected} />

      <DaySessions
        date={selected}
        sessions={sessions.filter((s) => s.date === selected)}
        onChange={(s) => setSessions((list) => (list ?? []).map((x) => (x.id === s.id ? s : x)))}
        onDelete={(id) => setSessions((list) => (list ?? []).filter((x) => x.id !== id))}
      />

      <BpmProgress songs={songs} refresh={practice.savedCount} />
    </section>
  );
}

// ---------- 오늘 ----------

function TodayCard({
  seconds,
  goals,
  streak,
  running,
  onGoals,
}: {
  seconds: number;
  goals: Goals;
  streak: number;
  running: boolean;
  onGoals: (g: Partial<Goals>) => void;
}) {
  const minutes = Math.floor(seconds / 60);
  const target = goals.targetMinutes;
  const ratio = Math.min(1, seconds / (target * 60));
  const minRatio = goals.minMinutes / target;

  const size = 132;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const c = size / 2;
  // 최소 목표 위치 눈금 (12시 방향에서 시계 방향)
  const angle = minRatio * 2 * Math.PI - Math.PI / 2;
  const tick = (r: number) => ({ x: c + r * Math.cos(angle), y: c + r * Math.sin(angle) });
  const t1 = tick(radius - stroke / 2 - 2);
  const t2 = tick(radius + stroke / 2 + 2);

  const status =
    minutes >= target
      ? '오늘 목표 달성!'
      : minutes >= goals.minMinutes
        ? `최소 목표 달성 · 목표까지 ${target - minutes}분`
        : `최소 목표까지 ${goals.minMinutes - minutes}분`;

  return (
    <div className="today-card">
      <div className="today-main">
        <svg className="today-ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
          <circle cx={c} cy={c} r={radius} className="ring-track" strokeWidth={stroke} fill="none" />
          <circle
            cx={c}
            cy={c}
            r={radius}
            className={`ring-fill ${minutes >= target ? 'done' : ''}`}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circ * ratio} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${c} ${c})`}
          />
          <line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} className="ring-min" />
        </svg>
        <div className="today-numbers">
          <span className="today-label">오늘{running && <span className="today-live"> · 연습 중</span>}</span>
          <span className="today-minutes">
            {minutes}
            <small>분 / {target}분</small>
          </span>
          <span className="today-status">{status}</span>
          <span className="today-streak">
            {streak > 0 ? `🔥 ${streak}일 연속` : `최소 ${goals.minMinutes}분을 채우면 연속 기록이 시작돼요`}
          </span>
        </div>
      </div>
      <div className="goal-row">
        <span className="goal-title">최소</span>
        {([10, 15] as const).map((m) => (
          <button
            key={m}
            className={`goal-chip ${goals.minMinutes === m ? 'selected' : ''}`}
            onClick={() => onGoals({ minMinutes: m })}
          >
            {m}분
          </button>
        ))}
        <span className="goal-title">목표</span>
        {([20, 30] as const).map((m) => (
          <button
            key={m}
            className={`goal-chip ${goals.targetMinutes === m ? 'selected' : ''}`}
            onClick={() => onGoals({ targetMinutes: m })}
          >
            {m}분
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- 달력 잔디 ----------

const WEEKS = 17;
const CELL = 15;
const GAP = 3;
const PITCH = CELL + GAP;

function Heatmap({
  totals,
  goals,
  today,
  selected,
  onSelect,
}: {
  totals: Map<string, number>;
  goals: Goals;
  today: string;
  selected: string;
  onSelect: (d: string) => void;
}) {
  const lastSunday = addDays(today, -weekdayOf(today));
  const firstSunday = addDays(lastSunday, -(WEEKS - 1) * 7);
  const left = 22;
  const top = 16;
  const width = left + WEEKS * PITCH;
  const height = top + 7 * PITCH;

  const level = (sec: number) =>
    sec <= 0 ? 0 : sec < goals.minMinutes * 60 ? 1 : sec < goals.targetMinutes * 60 ? 2 : 3;

  const cells: ReactElement[] = [];
  const months: ReactElement[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const weekStart = addDays(firstSunday, w * 7);
    const [, m, d] = weekStart.split('-').map(Number);
    if (w === 0 || d <= 7) {
      months.push(
        <text key={`m${w}`} x={left + w * PITCH} y={10} className="hm-label">
          {m}월
        </text>,
      );
    }
    for (let day = 0; day < 7; day++) {
      const key = addDays(weekStart, day);
      if (key > today) continue;
      const sec = totals.get(key) ?? 0;
      cells.push(
        <rect
          key={key}
          x={left + w * PITCH}
          y={top + day * PITCH}
          width={CELL}
          height={CELL}
          rx={3}
          className={`hm-cell l${level(sec)} ${key === selected ? 'selected' : ''}`}
          onClick={() => onSelect(key)}
        >
          <title>{`${formatDate(key)} · ${sec ? formatDuration(sec) : '연습 없음'}`}</title>
        </rect>,
      );
    }
  }

  return (
    <div className="log-block">
      <h3>연습한 날</h3>
      <svg className="heatmap" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`최근 ${WEEKS}주 연습 달력`}>
        {months}
        {['', '월', '', '수', '', '금', ''].map((t, i) =>
          t ? (
            <text key={i} x={0} y={top + i * PITCH + CELL - 3} className="hm-label">
              {t}
            </text>
          ) : null,
        )}
        {cells}
      </svg>
      <div className="hm-legend">
        <span>
          <i className="hm-swatch l1" /> 연습함
        </span>
        <span>
          <i className="hm-swatch l2" /> 최소 {goals.minMinutes}분
        </span>
        <span>
          <i className="hm-swatch l3" /> 목표 {goals.targetMinutes}분
        </span>
      </div>
    </div>
  );
}

// ---------- 날짜별 연습 ----------

function DaySessions({
  date,
  sessions,
  onChange,
  onDelete,
}: {
  date: string;
  sessions: PracticeSession[];
  onChange: (s: PracticeSession) => void;
  onDelete: (id: string) => void;
}) {
  const total = sessions.reduce((t, s) => t + s.seconds, 0);
  return (
    <div className="log-block">
      <h3>
        {formatDate(date)}
        {total > 0 && <span className="log-block-sub"> · {formatDuration(total)}</span>}
      </h3>
      {sessions.length === 0 ? (
        <p className="log-empty">
          {date === todayKey()
            ? '아직 기록이 없어요. 위의 "연습 시작"을 누르거나 메트로놈을 켜면 자동으로 기록돼요.'
            : '이날은 연습 기록이 없어요.'}
        </p>
      ) : (
        <ul className="session-list">
          {[...sessions]
            .sort((a, b) => a.start - b.start)
            .map((s) => (
              <SessionCard key={s.id} session={s} onChange={onChange} onDelete={onDelete} />
            ))}
        </ul>
      )}
    </div>
  );
}

function SessionCard({
  session,
  onChange,
  onDelete,
}: {
  session: PracticeSession;
  onChange: (s: PracticeSession) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState(session.memo);
  const [confirm, setConfirm] = useState(false);

  const saveMemo = async () => {
    setEditing(false);
    if (memo.trim() === session.memo) return;
    const next = { ...session, memo: memo.trim() };
    await saveSession(next).catch(() => {});
    onChange(next);
  };

  const remove = async () => {
    if (!confirm) return setConfirm(true);
    await deleteSession(session.id).catch(() => {});
    onDelete(session.id);
  };

  return (
    <li className="session-card">
      <div className="session-head">
        <span className="session-time">
          {formatTime(session.start)} – {formatTime(session.end)}
        </span>
        <span className="session-total">{formatDuration(session.seconds)}</span>
        {session.auto && <span className="session-tag">자동</span>}
      </div>
      <ul className="session-items">
        {session.items.map((i) => (
          <li key={i.key}>
            <span className="session-item-label">{i.label}</span>
            <span className="session-item-meta">
              {formatDuration(i.seconds)}
              {i.bpmEnd !== undefined &&
                (i.bpmStart !== i.bpmEnd ? ` · ${i.bpmStart}→${i.bpmEnd} BPM` : ` · ${i.bpmEnd} BPM`)}
            </span>
          </li>
        ))}
      </ul>
      {editing ? (
        <textarea
          className="session-memo-input"
          rows={2}
          autoFocus
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={saveMemo}
          placeholder="메모"
        />
      ) : (
        session.memo && <p className="session-memo">{session.memo}</p>
      )}
      <div className="session-actions">
        {!editing && (
          <button className="link-button small" onClick={() => setEditing(true)}>
            {session.memo ? '메모 수정' : '메모 추가'}
          </button>
        )}
        <button className={`link-button small danger ${confirm ? 'armed' : ''}`} onClick={remove} onBlur={() => setConfirm(false)}>
          {confirm ? '한 번 더 누르면 삭제' : '삭제'}
        </button>
      </div>
    </li>
  );
}

// ---------- 곡·기본기 BPM ----------

interface BpmSeries {
  id: string;
  title: string;
  log: BpmEntry[];
  current: number;
  target: number | null;
}

function BpmProgress({ songs, refresh }: { songs: Song[]; refresh: number }) {
  // 기본기 BPM은 localStorage에 있다. 연습이 저장될 때(refresh)마다 다시 읽는다
  const drills = useMemo(() => {
    void refresh;
    return loadDrills();
  }, [refresh]);
  const series: BpmSeries[] = [
    ...Object.entries(drills)
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .map(([id, d]) => ({ id, title: d.label, log: d.log, current: d.bpm, target: null })),
    ...songs.map((s) => ({ id: s.id, title: s.title, log: s.bpmLog, current: s.practiceBpm, target: s.targetBpm })),
  ].filter((x) => x.log.length >= 2);

  return (
    <div className="log-block">
      <h3>BPM 변화</h3>
      {series.length === 0 ? (
        <p className="log-empty">
          기본기나 곡 화면에서 BPM을 올리면 날짜별로 쌓여서, 이틀 이상 기록되면 여기에 그래프가 생겨요.
        </p>
      ) : (
        <ul className="bpm-list">
          {series.map((x) => (
            <li key={x.id} className="bpm-row">
              <div className="bpm-text">
                <span className="bpm-title">{x.title}</span>
                <span className="bpm-change">
                  {x.log[0].bpm} → {x.current} BPM
                  <Delta value={x.current - x.log[0].bpm} />
                  {x.target ? <span className="muted"> · 목표 {x.target}</span> : null}
                </span>
              </div>
              <Sparkline series={x} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const Delta = ({ value }: { value: number }) =>
  value === 0 ? null : <span className={value > 0 ? 'delta up' : 'delta down'}>{value > 0 ? ` +${value}` : ` ${value}`}</span>;

/** 날짜 간격을 살린 BPM 선. 목표 BPM이 있으면 점선으로 함께 그린다. */
function Sparkline({ series }: { series: BpmSeries }) {
  const w = 132;
  const h = 44;
  const pad = 5;
  const { log, target, title } = series;
  const times = log.map((e) => new Date(e.date).getTime());
  const t0 = times[0];
  const span = Math.max(DAY_MS, times[times.length - 1] - t0);
  const values = log.map((e) => e.bpm).concat(target ? [target] : []);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = Math.max(4, hi - lo);
  const x = (t: number) => pad + ((t - t0) / span) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - lo) / range) * (h - pad * 2);
  const points = log.map((e, i) => `${x(times[i]).toFixed(1)},${y(e.bpm).toFixed(1)}`).join(' ');
  const last = log[log.length - 1];

  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`${title} BPM 변화`}>
      {target && <line x1={pad} x2={w - pad} y1={y(target)} y2={y(target)} className="spark-target" />}
      <polyline points={points} className="spark-line" fill="none" />
      {log.map((e, i) => (
        // 마우스를 올리면 날짜별 값이 보이도록 투명한 큰 원을 깐다
        <circle key={e.date} cx={x(times[i])} cy={y(e.bpm)} r={8} className="spark-hit">
          <title>{`${formatDate(e.date)} · ${e.bpm} BPM`}</title>
        </circle>
      ))}
      <circle cx={x(times[times.length - 1])} cy={y(last.bpm)} r={4} className="spark-end" />
    </svg>
  );
}
