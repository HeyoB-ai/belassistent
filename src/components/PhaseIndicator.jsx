import { useLang } from '../i18n.js';
import Icon from './Icon.jsx';

// Vaste volgorde van de 5 fasen. Weergave puur op basis van de HUIDIGE fase uit de poll
// — fasen mogen terugspringen (bijv. medewerker → doorverbonden → wachtrij).
const PHASES = ['connecting', 'menu', 'waiting', 'agent', 'done'];
const ICONS = {
  connecting: 'link',
  menu: 'list',
  waiting: 'clock',
  agent: 'headphones',
  done: 'check-circle',
};

export default function PhaseIndicator({ phase }) {
  const { t } = useLang();

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
    <ol className="phase-steps">
      {PHASES.map((p, i) => {
        const stepState = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo';
        return (
          <li key={p} className={`phase-step ${stepState}`}>
            <span className="phase-marker">
              <Icon name={stepState === 'done' ? 'check' : ICONS[p]} size={17} strokeWidth={2} />
            </span>
            <span className="phase-text">
              <span className="phase-title">{titles[p]}</span>
              {stepState === 'active' && <span className="phase-sub">{subs[p]}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
