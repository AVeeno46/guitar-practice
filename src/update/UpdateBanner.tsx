import { useState } from 'react';
import { useUpdateCheck } from './useUpdateCheck';
import './update.css';

/** 새 버전이 배포되면 화면 위에 새로고침 안내를 띄운다. 닫으면 이번 실행 동안은 다시 안 띄운다 */
export default function UpdateBanner() {
  const available = useUpdateCheck();
  const [dismissed, setDismissed] = useState(false);
  if (!available || dismissed) return null;

  return (
    <div className="update-banner" role="status">
      <span className="update-text">새 버전이 있어요</span>
      <button className="update-reload" onClick={() => location.reload()}>
        새로고침
      </button>
      <button className="update-close" onClick={() => setDismissed(true)} aria-label="나중에">
        ✕
      </button>
    </div>
  );
}
