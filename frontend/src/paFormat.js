// Display helpers for tasks and reminders (all in the browser's local time).
const DAY = 86_400_000;
const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const dayOffset = (iso) => Math.round((sod(new Date(iso)) - sod(new Date())) / DAY);
// 24-hour, same as chat timestamps and the time inputs.
export const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export function whenLabel(iso) {
  if (!iso) return 'Anytime';
  const n = dayOffset(iso);
  const c = clock(iso);
  if (n === 0) return c;
  if (n === 1) return `Tomorrow ${c}`;
  if (n === -1) return `Yesterday ${c}`;
  const d = new Date(iso);
  if (n > 1 && n < 7) return `${d.toLocaleDateString([], { weekday: 'short' })} ${c}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${c}`;
}

// Draft dates come as "YYYY-MM-DD" + "HH:MM" (local).
export const draftIso = (d, t) => (d ? new Date(`${d}T${t || '09:00'}`).toISOString() : null);

export const longDay = (date = new Date()) =>
  date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });

export const isOverdue = (t) => t.status === 'open' && !!t.due_at && new Date(t.due_at) < new Date();
export const isSnoozed = (t) => t.status === 'open' && t.reminder?.status === 'pending' && t.reminder.snooze_count > 0;
export const isAlerting = (t) => t.status === 'open' && t.reminder?.status === 'sent';

export const REPEAT_LABEL = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
};
export const OFFSETS = [
  [0, 'At due time'],
  [10, '10 min before'],
  [30, '30 min before'],
  [60, '1 hour before'],
  [1440, '1 day before'],
];
export const offsetLabel = (m) => OFFSETS.find(([v]) => v === m)?.[1] || `${m} min before`;
export const ALERTS = [
  ['notification', 'Notification'],
  ['sound', 'Notification + sound'],
  ['alarm', 'Alarm until dismissed'],
];
export const SOURCE_TAG = { typed: 'Typed', voice: 'Voice', chat: 'From chat' };

// Assistant tabs: today (incl. overdue and no-date to-dos) | up | done
export function bucket(t) {
  if (t.status === 'done') return 'done';
  if (!t.due_at) return 'today';
  return dayOffset(t.due_at) <= 0 ? 'today' : 'up';
}

export const GROUPS = ['Overdue', 'Today', 'Tomorrow', 'This week', 'Later', 'No date'];
export function group(t) {
  if (!t.due_at) return 'No date';
  if (isOverdue(t)) return 'Overdue';
  const n = dayOffset(t.due_at);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return 'This week';
  return 'Later';
}

export const byDue = (a, b) =>
  (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity);

export function sourceLine(t) {
  const q = t.source_text ? `: “${t.source_text}”` : '';
  if (t.source === 'voice') return `Added by voice${q}`;
  if (t.source === 'chat') return `Suggested from ${t.chat_name ? `${t.chat_name}’s` : 'a'} chat${q} · approved by you`;
  return t.source_text ? `Typed by you${q}` : 'Typed by you';
}

// Minutes from now until a local wall-clock time today (or tomorrow if passed).
export function minutesUntil(hh, mm = 0, tomorrow = false) {
  const now = new Date();
  const t = new Date(now);
  t.setHours(hh, mm, 0, 0);
  if (tomorrow || t <= now) t.setDate(t.getDate() + 1);
  return Math.max(1, Math.round((t - now) / 60_000));
}

export const SNOOZES = () => [
  ['15 min', 15],
  ['1 hour', 60],
  ['Tonight 8 PM', minutesUntil(20)],
  ['Tomorrow 9 AM', minutesUntil(9, 0, true)],
];
