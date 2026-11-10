import { useState } from 'react';
import { loadLocal, saveLocal } from '../storage';
import Scales from '../scales/Scales';
import Chromatic from './Chromatic';
import Spider from './Spider';
import './basics.css';

type Section = 'chromatic' | 'spider' | 'scales';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'chromatic', label: '크로매틱' },
  { id: 'spider', label: '스파이더' },
  { id: 'scales', label: '스케일' },
];

const KEY = 'gp.basicsSection';

/** 기본기 탭: 크로매틱·스파이더(손가락 연습)와 스케일을 오간다. 앞으로 다른 기본기도 여기에 추가 */
export default function Basics() {
  const [section, setSection] = useState<Section>(() => loadLocal<{ id: Section }>(KEY, { id: 'chromatic' }).id);

  const choose = (id: Section) => {
    setSection(id);
    saveLocal(KEY, { id });
  };

  return (
    <div className="basics">
      <div className="segmented" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            className={section === s.id ? 'active' : ''}
            onClick={() => choose(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === 'chromatic' ? <Chromatic /> : section === 'spider' ? <Spider /> : <Scales />}
    </div>
  );
}
