import { useState } from 'react';
import Metronome from './metronome/Metronome';
import Songs from './songs/Songs';
import Basics from './basics/Basics';
import Log from './practice/Log';
import Routine from './routine/Routine';
import PracticeBar from './practice/PracticeBar';
import UpdateBanner from './update/UpdateBanner';
import { usePracticeInteractionListener } from './practice/hooks';
import './app.css';

type TabId = 'metronome' | 'basics' | 'songs' | 'routine' | 'log';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'metronome', label: '메트로놈', icon: '◷' },
  { id: 'basics', label: '기본기', icon: '⌗' },
  { id: 'songs', label: '곡', icon: '♪' },
  { id: 'routine', label: '루틴', icon: '↻' },
  { id: 'log', label: '기록', icon: '▤' },
];

export default function App() {
  const [tab, setTab] = useState<TabId>('metronome');
  const current = TABS.find((t) => t.id === tab)!;
  usePracticeInteractionListener();

  return (
    <div className="app">
      <UpdateBanner />
      <header className="app-header">
        <h1>{current.label}</h1>
        <PracticeBar />
      </header>

      <main className="app-main">
        {tab === 'metronome' ? (
          <Metronome />
        ) : tab === 'songs' ? (
          <Songs />
        ) : tab === 'basics' ? (
          <Basics />
        ) : tab === 'log' ? (
          <Log />
        ) : (
          <Routine />
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
