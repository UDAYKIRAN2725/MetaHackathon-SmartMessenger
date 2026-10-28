import { ALARM, ALERT_OPTS, REMIND_MIN, REMIND_OPTS } from './data';

export const cx = (...c) => c.filter(Boolean).join(' ');

// "Fri, 30 Oct 2026" -> "Fri"
export const shortDay = (date) => (date || '').split(/[ ,]/)[0] || date;

// "11:00 AM" minus 30 -> "10:30 AM". Returns input unchanged if it can't be parsed.
export function minusMinutes(time, mins) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time || '').trim());
  if (!m) return time;
  const h24 = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  const total = (((h24 * 60 + Number(m[2]) - mins) % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60);
  const ap = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:${String(total % 60).padStart(2, '0')} ${ap}`;
}

let seq = 0;
export const newId = (p) => `${p}-${Date.now()}-${seq++}`;

// Builds the task + reminder pair created from the voice / manual task modals.
export function buildTaskAndReminder({ title, date, time, remind, tag, who, source, noDate, repeat }) {
  const id = newId(tag.toLowerCase());
  const day = shortDay(date);
  if (noDate) {
    return { task: { id, title, time: 'Anytime', tag, who: 'no date', bucket: 'today', order: 9 }, reminder: null };
  }
  const alertAt = minusMinutes(time, REMIND_MIN[remind] ?? 30);
  const task = { id, title, time: `${day} ${time}`, tag, who: who || 'just added', bucket: 'up', order: tag === 'Voice' ? 2 : 3 };
  const reminder = {
    id, group: 2, order: tag === 'Voice' ? 1 : 3, status: 'up', icon: repeat && repeat !== 'Never' && repeat !== 'Does not repeat' ? '↻' : ALARM,
    title, time: `${day} ${alertAt}`, sub: `Due ${day} ${time} · just added`, tag, who: who || '',
    detail: {
      source,
      dueDate: date, dueTime: time,
      remind: { options: REMIND_OPTS, on: Math.max(0, REMIND_OPTS.indexOf(remind)) },
      alert: { options: ALERT_OPTS, on: tag === 'Voice' ? 1 : 0 },
      actions: [
        { label: '✓ Mark done', kind: 'pri', act: 'done' },
        { label: 'Snooze ▾', kind: '' },
        { label: 'Delete', kind: 'ghost', act: 'delete' },
      ],
      preview: { at: `${day} ${alertAt}`, sub: `Due ${time}` },
    },
  };
  return { task, reminder };
}
