import { useState } from 'react';
import Metronome from './metronome/Metronome';
import Songs from './songs/Songs';
import Scales from './scales/Scales';
import Log from './practice/Log';
import PracticeBar from './practice/PracticeBar';
import { usePracticeInteractionListener } from './practice/hooks';
import './app.css';

type TabId = 'metronome' | 'songs' | 'log' | 'routine' | 'scales';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'metronome', label: '메트로놈', icon: '◔' },
  { id: 'songs', label: '곡', icon: '♪' },
  { id: 'log', label: '기록', icon: '▤' },
  { id: 'routine', label: '루틴', icon: '↻' },
  { id: 'scales', label: '스케일', icon: '⌗' },
];

const COMING_SOON: Record<Exclude<TabId, 'metronome' | 'songs' | 'scales' | 'log'>, string> = {
  routine: '항목별 시간과 BPM을 정해 순서대로 진행하는 루틴 화면이 들어올 예정이에요.',
};

export default function App() {
  const [tab, setTab] = useState<TabId>('metronome');
  const current = TABS.find((t) => t.id === tab)!;
  usePracticeInteractionListener();

  return (
    <div className="app">
      <header className="app-header">
        <h1>{current.label}</h1>
        <PracticeBar />
      </header>

      <main className="app-main">
        {tab === 'metronome' ? (
          <Metronome />
        ) : tab === 'songs' ? (
          <Songs />
        ) : tab === 'scales' ? (
          <Scales />
        ) : tab === 'log' ? (
          <Log />
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
