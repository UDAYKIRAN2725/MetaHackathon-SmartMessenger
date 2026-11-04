import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { useTasks } from '../TaskStore';
import { ALARM } from '../data';
import { Btn } from '../components/common';
import TaskForm from '../components/TaskForm';
import {
  GROUPS, REPEAT_LABEL, SNOOZES, SOURCE_TAG, byDue, group, isAlerting, isOverdue, isSnoozed, offsetLabel, sourceLine, whenLabel,
} from '../paFormat';
import { cx } from '../utils';

const icon = (t) => (t.status === 'done' ? '✓' : isOverdue(t) ? '!' : isSnoozed(t) ? 'z' : t.repeat !== 'none' ? '↻' : ALARM);

function RemRow({ t }) {
  const { remSel, setRemSel } = useApp();
  const r = t.reminder;
  const sub =
    t.status === 'done' ? `Marked done ${whenLabel(t.completed_at)}`
      : !t.due_at ? 'No date · no reminder'
        : isSnoozed(t) ? `Snoozed ${r.snooze_count}× · due ${whenLabel(t.due_at)}`
          : `Due ${whenLabel(t.due_at)} · ${offsetLabel(t.remind_offset_min)}${t.repeat !== 'none' ? ` · ${REPEAT_LABEL[t.repeat].toLowerCase()}` : ''}`;
  return (
    <button type="button" onClick={() => setRemSel(t.id)} className={cx('row click', t.status === 'done' && 'read', remSel === t.id && 'sel')}>
      <span className={cx('ric', isAlerting(t) && 'now')}>{icon(t)}</span>
      <span className="meta">
        <span className="top">
          <span>{t.title}</span>
          <span className={cx('time', r && 'u')}>{r ? whenLabel(r.fire_at) : t.due_at ? whenLabel(t.due_at) : ''}</span>
        </span>
        <span className="sub"><span className="t">{sub}</span></span>
        <span className="why">
          <span className="tag">{SOURCE_TAG[t.source]}</span>
          {t.chat_name}
        </span>
      </span>
    </button>
  );
}

export function RemindersList() {
  const { tasks, loading } = useTasks();
  const { remTab, setRemTab, remSel, setRemSel, openModal } = useApp();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const match = (t) => !term || t.title.toLowerCase().includes(term) || (t.notes || '').toLowerCase().includes(term);
  const open = tasks.filter((t) => t.status === 'open');
  const snoozed = open.filter(isSnoozed);
  const inTab = (remTab === 'up' ? open : remTab === 'sn' ? snoozed : tasks.filter((t) => t.status === 'done')).filter(match);

  useEffect(() => {
    if (!loading && inTab.length && !inTab.some((t) => t.id === remSel) && !tasks.some((t) => t.id === remSel)) setRemSel(inTab[0].id);
  }, [loading, inTab, remSel, tasks, setRemSel]);

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
        <button type="button" className={cx('chip', remTab === 'up' && 'on')} onClick={() => setRemTab('up')}>Upcoming <span className="n">{open.length}</span></button>
        <button type="button" className={cx('chip', remTab === 'sn' && 'on')} onClick={() => setRemTab('sn')}>Snoozed {snoozed.length > 0 && <span className="n">{snoozed.length}</span>}</button>
        <button type="button" className={cx('chip', remTab === 'done' && 'on')} onClick={() => setRemTab('done')}>Done</button>
      </div>
      {loading && <div className="empty note">Loading…</div>}
      {remTab === 'up'
        ? GROUPS.map((g) => {
            const rows = inTab.filter((t) => group(t) === g).sort(byDue);
            if (!rows.length) return null;
            return (
              <div key={g}>
                <div className="gh">{g}{g === 'Today' && <span>alert time</span>}</div>
                {rows.map((t) => <RemRow key={t.id} t={t} />)}
              </div>
            );
          })
        : inTab.map((t) => <RemRow key={t.id} t={t} />)}
      {!loading && inTab.length === 0 && <div className="empty note">Nothing here.</div>}
      <div className="foot">Every task with a time gets a reminder. Set when and how you’re alerted for each one.</div>
    </aside>
  );
}

const ACTION_LABEL = {
  created: 'Created', edited: 'Edited', alerted: 'Alert shown', snoozed: 'Snoozed', done: 'Marked done',
  reopened: 'Reopened', dismissed: 'Alert dismissed',
};

function History({ t }) {
  const { events } = useTasks();
  const [items, setItems] = useState(null);
  useEffect(() => {
    let live = true;
    events(t.id).then((d) => live && setItems(d.items)).catch(() => live && setItems([]));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id, t.due_at, t.status, t.reminder?.id, t.reminder?.status]);
  return (
    <div className="card">
      <div className="lb">History</div>
      {!items ? <div className="note">Loading…</div> : (
        <div className="tl">
          {items.map((e, i) => (
            <div key={i} className="e done" style={i === items.length - 1 ? { border: 0 } : undefined}>
              <span className="hr">{whenLabel(e.at)}</span><span className="d" />
              <span style={{ flex: 1 }}>{ACTION_LABEL[e.action] || e.action}{e.detail && <span className="src"> · {e.detail}</span>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ t }) {
  const { update, done, reopen, snooze, remove } = useTasks();
  const { openChat } = useApp();
  const [err, setErr] = useState('');
  const run = (fn) => fn().then(() => setErr('')).catch((e) => setErr(e.message));
  const r = t.reminder;
  const isOpen = t.status === 'open';

  return (
    <div className="grid2" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
      <div className="card">
        <div className="lb">{isSnoozed(t) ? 'Snoozed reminder' : isOverdue(t) ? 'Overdue' : 'Reminder · click to edit'}</div>
        <div className="src" style={{ marginBottom: 12 }}>{sourceLine(t)}</div>
        <TaskForm
          key={`${t.id}-${t.due_at}-${t.status}`}
          initial={t}
          saveLabel="Save changes"
          onSave={(body) => {
            // Send only what changed, so e.g. renaming an overdue task doesn't re-validate its past due time.
            const ch = {};
            for (const [k, v] of Object.entries(body)) if (String(t[k] ?? '') !== String(v ?? '')) ch[k] = v;
            if ('due_date' in ch || 'due_time' in ch) Object.assign(ch, { due_date: body.due_date, due_time: body.due_time });
            return Object.keys(ch).length ? update(t.id, ch) : Promise.resolve(t);
          }}
          extra={
            <>
              {isOpen
                ? <Btn kind="pri" lg onClick={() => run(() => done(t.id))}>✓ {t.repeat !== 'none' ? 'Done for this time' : 'Mark done'}</Btn>
                : <Btn lg onClick={() => run(() => reopen(t.id))}>↺ Reopen</Btn>}
              {t.conversation_id && <Btn lg onClick={() => openChat(t.conversation_id)}>Open chat</Btn>}
              <Btn kind="ghost" lg onClick={() => window.confirm('Delete this task and its reminders?') && run(() => remove(t.id))}>Delete</Btn>
            </>
          }
        />
        {err && <div className="alert" style={{ marginTop: 10 }}>{err}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isOpen && (
          <div className="card">
            <div className="lb">{r ? `Alert ${r.status === 'sent' ? 'showing now' : 'preview'} · ${whenLabel(r.fire_at)}` : 'No alert scheduled'}</div>
            {r ? (
              <div className="notif">
                <div style={{ display: 'flex', gap: 8 }}>
                  <span>⏰</span>
                  <div style={{ flex: 1 }}>
                    <b>{t.title}</b>
                    <div style={{ fontSize: 12, color: '#bbb' }}>{t.due_at ? `Due ${whenLabel(t.due_at)}` : ''}{t.chat_name && ` · from ${t.chat_name}’s chat`}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="note">{t.due_at ? 'The due time has passed. Pick a new date or time and save.' : 'Add a date to get a reminder.'}</div>
            )}
            <div className="lb" style={{ marginTop: 12 }}>Snooze</div>
            <div className="chips" style={{ padding: 0 }}>
              {SNOOZES().map(([l, m]) => <button type="button" key={l} className="chip" onClick={() => run(() => snooze(t.id, m))}>{l}</button>)}
            </div>
            {r?.snooze_count >= 2 && (
              <div className="note" style={{ marginTop: 8 }}>Snoozed {r.snooze_count} times. Maybe pick a fixed time above and save.</div>
            )}
          </div>
        )}
        <History t={t} />
      </div>
    </div>
  );
}

export function ReminderDetail() {
  const { tasks } = useTasks();
  const { remSel } = useApp();
  const open = tasks.filter((t) => t.status === 'open');
  const today = open.filter((t) => group(t) === 'Today').length;
  const t = tasks.find((x) => x.id === remSel);
  return (
    <main className="main">
      <div className="ch">
        <div><span className="n">Reminder details</span><span className="s">Pick a reminder on the left to edit it</span></div>
        <div className="r">
          <span className="tag">{today} today</span>
          <span className="tag">{open.filter(isOverdue).length} overdue</span>
          <span className="tag">{open.filter(isSnoozed).length} snoozed</span>
        </div>
      </div>
      <div className="pad">{t ? <Detail key={t.id} t={t} /> : <div className="empty">Select a reminder to see its details.</div>}</div>
    </main>
  );
}
