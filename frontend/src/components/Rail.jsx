import { useApp } from '../AppContext';
import { CHATS, ALARM } from '../data';
import { cx } from '../utils';

export default function Rail() {
  const { view, go, reminders } = useApp();
  const unreadChats = CHATS.filter((c) => c.unread > 0).length;
  const todayReminders = reminders.filter((r) => r.status === 'up' && r.group === 0).length;

  const items = [
    { v: 'chats', g: '▣', label: 'Chats', cnt: unreadChats },
    { v: 'pa', g: '◉', label: 'Assistant' },
    { v: 'rem', g: ALARM, label: 'Reminders', cnt: todayReminders },
    { v: 'sch', g: '◷', label: 'Scheduled' },
    { v: 'mem', g: '◈', label: 'Memory' },
  ];
  const Item = ({ v, g, label, cnt }) => (
    <button type="button" className={cx('i', view === v && 'on')} onClick={() => go(v)}>
      <span className="g">{g}</span>
      {label}
      {cnt > 0 && <span className="cnt">{cnt}</span>}
    </button>
  );

  return (
    <nav className="rail">
      {items.map((it) => <Item key={it.v} {...it} />)}
      <div className="fill" />
      <Item v="set" g={'⚙\uFE0E'} label="Settings" />
      <div className="me">UK</div>
    </nav>
  );
}
