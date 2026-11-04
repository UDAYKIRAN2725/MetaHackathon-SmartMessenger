import { useApp } from '../AppContext';
import { useAuth } from '../AuthContext';
import { useChats } from '../ChatStore';
import { useTasks } from '../TaskStore';
import { initials } from '../auth';
import { ALARM } from '../data';
import { group } from '../paFormat';
import { cx } from '../utils';

export default function Rail() {
  const { view, go } = useApp();
  const { user } = useAuth();
  const { items } = useChats();
  const { tasks } = useTasks();
  const unreadChats = items.filter((c) => c.unread > 0).length;
  const todayReminders = tasks.filter((t) => t.status === 'open' && ['Overdue', 'Today'].includes(group(t))).length;

  const nav = [
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
      {nav.map((it) => <Item key={it.v} {...it} />)}
      <div className="fill" />
      <Item v="set" g={'⚙\uFE0E'} label="Settings" />
      <button type="button" className="me" title={`${user.name} · Settings`} onClick={() => go('set')}>{initials(user.name)}</button>
    </nav>
  );
}
