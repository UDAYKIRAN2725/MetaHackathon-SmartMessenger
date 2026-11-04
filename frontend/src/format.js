import { CAT_LABEL } from './data';

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const dayDiff = (d) => Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
const hm = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

// Chat list time: 10:42 · Yesterday · Mon · 12 Oct
export function listTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const n = dayDiff(d);
  if (n === 0) return hm(d);
  if (n === 1) return 'Yesterday';
  if (n < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function dayLabel(iso) {
  const d = new Date(iso);
  const n = dayDiff(d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export const msgTime = (iso) => hm(new Date(iso));

export const ticks = (m) => (m.read_at ? '✓✓ Read' : m.delivered_at ? '✓✓' : '✓');

export function fmtDelay(min) {
  if (min == null) return '—';
  if (min < 1) return '<1 min';
  if (min < 60) return `${Math.round(min)} min`;
  return `${Math.round(min / 60)} h`;
}

export const fmtMin = (m) => `${Math.round(m ?? 0)} min`;
export const catLabel = (c) => CAT_LABEL[c] || 'External';

export function whyLine(item, minTracked = 5) {
  const s = item.stats;
  if (s.score == null) {
    if (item.category === 'ext') return 'not in contacts · no history yet';
    return `learning · ${s.tracked}/${minTracked} messages tracked`;
  }
  return `reads in ${fmtDelay(s.avg_delay_min)} · ${fmtMin(s.min_per_day)}/day`;
}

export const scoreText = (s) => (s == null ? '—' : String(s).padStart(2, '0'));
