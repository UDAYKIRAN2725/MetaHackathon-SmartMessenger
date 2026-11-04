import { useState } from 'react';
import { ALERTS, OFFSETS, REPEAT_LABEL } from '../paFormat';
import { cx } from '../utils';
import { Btn } from './common';

const blank = { title: '', notes: '', due_date: '', due_time: '', repeat: 'none', remind_offset_min: 30, alert_style: 'notification' };

function fromTask(t = {}) {
  const f = { ...blank };
  for (const k of Object.keys(blank)) if (t[k] !== undefined && t[k] !== null) f[k] = t[k];
  return f;
}

// Confirm / edit form used for typed, spoken and chat-suggested tasks and in Reminders.
// Dates are local "YYYY-MM-DD" + "HH:MM"; the server turns them into a timezone-aware time.
export default function TaskForm({ initial, onSave, onCancel, saveLabel = 'Save task', warnings = [], extra }) {
  const [f, setF] = useState(() => fromTask(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const set = (k, v) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  const noDate = !f.due_date;

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return setErr('Give the task a title.');
    setBusy(true);
    setErr('');
    try {
      await onSave({
        title: f.title.trim(),
        notes: f.notes.trim(),
        due_date: f.due_date || null,
        due_time: f.due_date ? f.due_time || '09:00' : null,
        repeat: noDate ? 'none' : f.repeat,
        remind_offset_min: Number(f.remind_offset_min),
        alert_style: f.alert_style,
      });
      setSaved(true);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <span className="lb">Task · click to edit</span>
        <input className="v" maxLength={200} value={f.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="grid2" style={{ gap: 12 }}>
        <div className="field">
          <span className="lb" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Date</span>
            {!noDate && (
              <button type="button" className="link" onClick={() => set('due_date', '')}>No date (to-do)</button>
            )}
          </span>
          <input className="v" type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} />
        </div>
        <div className="field">
          <span className="lb">Time</span>
          <input className="v" type="time" value={f.due_time} disabled={noDate} onChange={(e) => set('due_time', e.target.value)} />
        </div>
      </div>
      {noDate ? (
        <div className="note" style={{ margin: '-4px 0 12px' }}>No date: saved as a to-do without a reminder.</div>
      ) : (
        <>
          <div className="field">
            <span className="lb">Repeat</span>
            <select className="v" value={f.repeat} onChange={(e) => set('repeat', e.target.value)}>
              {Object.entries(REPEAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="lb">Remind me</span>
            <div className="chips" style={{ padding: 0 }}>
              {OFFSETS.map(([v, l]) => (
                <button type="button" key={v} className={cx('chip', Number(f.remind_offset_min) === v && 'on')} onClick={() => set('remind_offset_min', v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="lb">Alert style</span>
            <div className="chips" style={{ padding: 0 }}>
              {ALERTS.map(([v, l]) => (
                <button type="button" key={v} className={cx('chip', f.alert_style === v && 'on')} onClick={() => set('alert_style', v)}>{l}</button>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="field">
        <span className="lb">Notes</span>
        <textarea className="v" rows={2} maxLength={1000} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      {warnings.map((w) => <div key={w} className="note" style={{ color: '#8a5a00' }}>⚠ {w}</div>)}
      {err && <div className="alert" style={{ marginTop: 8 }}>{err}</div>}
      <div className="acts" style={{ marginTop: 12 }}>
        {extra}
        <span style={{ flex: 1 }} />
        {saved && !onCancel && <span className="note">✓ Saved</span>}
        {onCancel && <Btn kind="ghost" lg onClick={onCancel}>Cancel</Btn>}
        <button type="submit" className="btn pri lg" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
      </div>
    </form>
  );
}
