import { useState } from 'react';
import Metronome from './metronome/Metronome';
import Songs from './songs/Songs';
import './app.css';

type TabId = 'metronome' | 'songs' | 'log' | 'routine' | 'chords';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'metronome', label: '메트로놈', icon: '◔' },
  { id: 'songs', label: '곡', icon: '♪' },
  { id: 'log', label: '기록', icon: '▤' },
  { id: 'routine', label: '루틴', icon: '↻' },
  { id: 'chords', label: '코드', icon: '⌗' },
];

const COMING_SOON: Record<Exclude<TabId, 'metronome' | 'songs'>, string> = {
  log: '연습 시간과 곡별 BPM 진행을 기록하는 화면이 들어올 예정이에요.',
  routine: '항목별 시간과 BPM을 정해 순서대로 진행하는 루틴 화면이 들어올 예정이에요.',
  chords: '코드 운지표와 스케일 지판 사전이 들어올 예정이에요.',
};

export default function App() {
  const [tab, setTab] = useState<TabId>('metronome');
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app">
      <header className="app-header">
        <h1>{current.label}</h1>
      </header>

      <main className="app-main">
        {tab === 'metronome' ? (
          <Metronome />
        ) : tab === 'songs' ? (
          <Songs />
        ) : (
          <div className="coming-soon">
            <span className="coming-icon">{current.icon}</span>
            <p>{COMING_SOON[tab]}</p>
          </div>
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
