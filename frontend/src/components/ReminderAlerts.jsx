import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { useTasks } from '../TaskStore';
import { whenLabel } from '../paFormat';
import { Btn } from './common';

function beep() {
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    const ctx = new C();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.3);
    o.onended = () => ctx.close();
  } catch {
    /* audio blocked until the user interacts with the page */
  }
}

// Reminder alerts shown on every page. They stay until you act: Done, Snooze, Open chat or ✕ (dismiss).
export default function ReminderAlerts() {
  const { alerts, done, snooze, dismiss } = useTasks();
  const { openChat } = useApp();
  const [busy, setBusy] = useState(null);
  const seen = useRef(new Set());

  useEffect(() => {
    for (const t of alerts) {
      if (!seen.current.has(t.reminder.id)) {
        seen.current.add(t.reminder.id);
        if (t.alert_style !== 'notification') beep();
      }
    }
    if (!alerts.some((t) => t.alert_style === 'alarm')) return;
    const id = setInterval(beep, 15_000); // "Alarm until dismissed"
    return () => clearInterval(id);
  }, [alerts]);

  if (!alerts.length) return null;
  const run = async (t, fn) => {
    setBusy(t.id);
    try {
      await fn();
    } catch {
      /* the alert stays; the user can retry */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ position: 'absolute', top: 14, right: 18, zIndex: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {alerts.slice(0, 3).map((t) => (
        <div key={t.reminder.id} className="toast" style={{ position: 'static' }} role="alert">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>⏰</span>
            <div style={{ flex: 1 }}>
              <b>{t.title}</b>
              <div style={{ fontSize: 12, color: '#bbb' }}>
                {t.due_at ? `Due ${whenLabel(t.due_at)}` : 'Reminder'}
                {t.chat_name && ` · from ${t.chat_name}’s chat`}
                {t.reminder.snooze_count > 0 && ` · snoozed ${t.reminder.snooze_count}×`}
              </div>
            </div>
            <button type="button" title="Dismiss" style={{ color: '#999' }} onClick={() => run(t, () => dismiss(t.id))}>✕</button>
          </div>
          <div className="acts">
            <Btn kind="pri" disabled={busy === t.id} onClick={() => run(t, () => done(t.id))}>✓ Done</Btn>
            <Btn disabled={busy === t.id} onClick={() => run(t, () => snooze(t.id, 15))}>Snooze 15 min</Btn>
            <Btn disabled={busy === t.id} onClick={() => run(t, () => snooze(t.id, 60))}>1 hour</Btn>
            {t.conversation_id && <Btn onClick={() => openChat(t.conversation_id)}>Open chat</Btn>}
          </div>
        </div>
      ))}
      {alerts.length > 3 && <div className="toast" style={{ position: 'static', padding: '8px 14px' }}>+{alerts.length - 3} more reminders</div>}
    </div>
  );
}
