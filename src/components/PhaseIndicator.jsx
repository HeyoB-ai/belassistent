import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n.js';

// Vaste volgorde van de 5 fasen. De weergave is puur gebaseerd op de HUIDIGE fase uit
// de poll — fasen mogen terugspringen (bijv. medewerker → doorverbonden → wachtrij).
const PHASES = ['connecting', 'menu', 'waiting', 'agent', 'done'];

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PhaseIndicator({ phase }) {
  const { t } = useLang();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Meelopende gesprekstimer, zodat zichtbaar is dat er iets gebeurt.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const current = PHASES.indexOf(phase);
  const activeIndex = current === -1 ? 0 : current;

  const titles = {
    connecting: t.phaseConnecting,
    menu: t.phaseMenu,
    waiting: t.phaseWaiting,
    agent: t.phaseAgent,
    done: t.phaseDone,
  };
  const subs = {
    connecting: t.phaseConnectingSub,
    menu: t.phaseMenuSub,
    waiting: t.phaseWaitingSub,
    agent: t.phaseAgentSub,
    done: t.phaseDoneSub,
  };

  return (
    <div className="phase-indicator">
      <div className="phase-timer" aria-label="tijd">
        {formatTime(elapsed)}
      </div>

      <ol className="phase-steps">
        {PHASES.map((p, i) => {
          const stepState = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo';
          return (
            <li key={p} className={`phase-step ${stepState}`}>
              <span className="phase-marker" aria-hidden="true">
                {stepState === 'done' ? '✓' : ''}
              </span>
              <span className="phase-text">
                <span className="phase-title">{titles[p]}</span>
                {stepState === 'active' && <span className="phase-sub">{subs[p]}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
