import { useState } from 'react';
import { useApp } from '../AppContext';
import { REM_GROUPS } from '../data';
import { Btn, ChipSelect } from '../components/common';
import { cx } from '../utils';

function RemRow({ r }) {
  const { remSel, setRemSel } = useApp();
  const clickable = !!r.detail;
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      {...(clickable ? { type: 'button', onClick: () => setRemSel(r.id) } : {})}
      className={cx('row', r.read && 'read', r.dim && 'dim', clickable && 'click', clickable && remSel === r.id && 'sel')}
    >
      <span className={cx('ric', r.now && r.status === 'up' && 'now')}>{r.icon}</span>
      <span className="meta">
        <span className="top">
          <span>{r.title}</span>
          <span className={cx('time', r.timeU && 'u')}>{r.time}</span>
        </span>
        <span className="sub"><span className="t">{r.sub}</span></span>
        <span className="why">
          {r.missed ? <Btn kind="ghost" style={{ padding: '2px 8px' }}>Reschedule</Btn> : <><span className="tag">{r.tag}</span>{r.who}</>}
        </span>
      </span>
    </Tag>
  );
}

export function RemindersList() {
  const { reminders, remTab, setRemTab, openModal } = useApp();
  const [q, setQ] = useState('');
  const match = (r) => r.title.toLowerCase().includes(q.trim().toLowerCase());
  const snoozed = reminders.filter((r) => r.status === 'sn').length;
  const inTab = reminders.filter((r) => r.status === remTab && match(r));

  let body;
  if (remTab === 'up') {
    body = REM_GROUPS.map((g, gi) => {
      const rows = inTab.filter((r) => r.group === gi).sort((a, b) => a.order - b.order);
      if (!rows.length) return null;
      return (
        <div key={g}>
          <div className="gh">{g}{gi === 0 && <span>alert time</span>}</div>
          {rows.map((r) => <RemRow key={r.id} r={r} />)}
        </div>
      );
    });
  } else {
    body = inTab.map((r) => <RemRow key={r.id} r={r} />);
  }

  return (
    <aside className="list">
      <div className="list-h">
        <b>Reminders</b>
        <span style={{ display: 'flex', gap: 6 }}>
          <Btn title="Speak a reminder" onClick={() => openModal('voice')}>◉ Speak</Btn>
          <Btn kind="pri" onClick={() => openModal('panew')}>+ New</Btn>
        </span>
      </div>
      <input className="search" placeholder="⌕  Search reminders" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button type="button" className={cx('chip', remTab === 'up' && 'on')} onClick={() => setRemTab('up')}>Upcoming</button>
        <button type="button" className={cx('chip', remTab === 'sn' && 'on')} onClick={() => setRemTab('sn')}>
          Snoozed {snoozed > 0 && <span className="n">{snoozed}</span>}
        </button>
        <button type="button" className={cx('chip', remTab === 'done' && 'on')} onClick={() => setRemTab('done')}>Done</button>
      </div>
      {body}
      {inTab.length === 0 && <div className="empty note">Nothing here.</div>}
      <div className="foot">Every task with a time gets a reminder. Set when and how you’re alerted for each one. Add tasks here or in Assistant.</div>
    </aside>
  );
}

const Field = ({ label, children }) => (
  <div className="field"><span className="lb">{label}</span>{children}</div>
);

function Detail({ r }) {
  const { updateReminder, markReminderDone, deleteReminder, openChat } = useApp();
  const d = r.detail;

  const run = (a) => {
    if (!a) return;
    if (a === 'done') markReminderDone(r.id);
    else if (a === 'delete') deleteReminder(r.id);
    else if (a.startsWith('chat:')) openChat(a.slice(5));
  };

  return (
    <div className="grid2" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
      <div className="card">
        <div className="lb">{d.label || 'Reminder · click to edit'}</div>
        <input className="h2" value={r.title} onChange={(e) => updateReminder(r.id, { title: e.target.value })} />
        <div className="src" style={{ marginBottom: 12 }}>{d.source}</div>
        {d.quote && (
          <div className="card" style={{ background: '#f6f6f6', padding: '9px 12px', marginBottom: 12, fontSize: 13 }}>
            {d.quote.text} <span className="src">{d.quote.by}</span>
          </div>
        )}

        {d.snoozedUntil ? (
          <>
            <Field label="Snoozed until"><input className="v" defaultValue={d.snoozedUntil} /></Field>
            <Field label="Snooze history"><div className="note" style={{ color: '#333' }}>{d.snoozeHistory}</div></Field>
          </>
        ) : (
          <div className="grid2">
            <Field label={d.dueLabel || 'Due date'}>
              {d.dueDateFixed ? <div className="v">{d.dueDate}</div> : <input className="v" defaultValue={d.dueDate} />}
            </Field>
            <Field label="Due time"><input className="v" defaultValue={d.dueTime} /></Field>
          </div>
        )}

        {d.repeatChips && <Field label="Repeat"><ChipSelect options={d.repeatChips.options} initial={d.repeatChips.on} /></Field>}
        {d.remind && <Field label="Remind me"><ChipSelect options={d.remind.options} initial={d.remind.on} /></Field>}
        {d.alert && <Field label="Alert style"><ChipSelect options={d.alert.options} initial={d.alert.on} /></Field>}
        {(d.repeat || d.location) && (
          <div className="grid2">
            <Field label="Repeat">
              <select className="v" defaultValue={d.repeat}>
                {['Does not repeat', 'Daily', 'Weekly', 'Monthly'].map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Location note"><input className="v" defaultValue={d.location} /></Field>
          </div>
        )}
        {d.nextAlerts && <Field label="Next 3 alerts"><div className="note" style={{ color: '#333' }}>{d.nextAlerts}</div></Field>}

        <div className="acts">
          {d.actions.map((a) => (
            <Btn key={a.label} kind={a.kind} onClick={() => run(a.act)} disabled={a.act === 'done' && r.status === 'done'}>
              {a.label}
            </Btn>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {d.preview && (
          <div className="card">
            <div className="lb">Alert preview · {d.preview.at}</div>
            <div className="notif">
              <div style={{ display: 'flex', gap: 8 }}>
                <span>⏰</span>
                <div style={{ flex: 1 }}>
                  <b>{r.title}</b>
                  <div style={{ fontSize: 12, color: '#bbb' }}>{d.preview.sub}</div>
                </div>
              </div>
              <div className="acts" style={{ marginTop: 8 }}>
                <Btn kind="pri" onClick={() => markReminderDone(r.id)}>✓ Done</Btn>
                <Btn>Snooze</Btn>
                {d.preview.chat && <Btn onClick={() => openChat(d.preview.chat)}>Open chat</Btn>}
              </div>
            </div>
          </div>
        )}
        {d.snoozeOptions && (
          <div className="card">
            <div className="lb">Snooze options</div>
            <div className="chips" style={{ padding: 0 }}>{d.snoozeOptions.map((o) => <span key={o} className="chip">{o}</span>)}</div>
          </div>
        )}
        {d.history && (
          <div className="card">
            <div className="lb">History</div>
            <div className="tl">
              {d.history.map(([day, text], i) => (
                <div key={day} className="e done" style={i === d.history.length - 1 ? { border: 0 } : undefined}>
                  <span className="hr">{day}</span><span className="d" /><span style={{ flex: 1 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {d.tip && (
          <div className="card">
            <div className="lb">Tip</div>
            <div className="note">Snoozed twice. Want to pick a fixed time? {d.tip.map((t) => <span key={t} className="chip" style={{ marginRight: 4 }}>{t}</span>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReminderDetail() {
  const { reminders, remSel } = useApp();
  const today = reminders.filter((r) => r.status === 'up' && r.group === 0).length;
  const snoozed = reminders.filter((r) => r.status === 'sn').length;
  const r = reminders.find((x) => x.id === remSel && x.detail);

  return (
    <main className="main">
      <div className="ch">
        <div><span className="n">Reminder details</span><span className="s">Pick a reminder on the left to edit it</span></div>
        <div className="r"><span className="tag">{today} today</span><span className="tag">{snoozed} snoozed</span></div>
      </div>
      <div className="pad">
        {r ? <Detail key={r.id} r={r} /> : <div className="empty">Select a reminder to see its details.</div>}
      </div>
    </main>
  );
}
