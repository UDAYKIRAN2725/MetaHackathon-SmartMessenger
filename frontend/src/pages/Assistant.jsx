import { useState } from 'react';
import { useApp } from '../AppContext';
import { REMIND_OPTS } from '../data';
import { Btn, ChipSelect, Modal } from '../components/common';
import { cx } from '../utils';

const MIC = '🎙\uFE0E';

function TaskRow({ t }) {
  const { toggleTask } = useApp();
  return (
    <label className="row">
      <input type="checkbox" className="lc" checked={!!t.done} onChange={() => toggleTask(t.id)} />
      <span className="chk" />
      <span className="meta">
        <span className="top">
          <span>{t.title}</span>
          <span className={cx('time', t.timeU && 'u')}>{t.time}</span>
        </span>
        <span className="why"><span className="tag">{t.tag}</span>{t.who}</span>
      </span>
    </label>
  );
}

export function AssistantList() {
  const { tasks, paTab, setPaTab, taskAdded, addQ3Task, openModal } = useApp();
  const [ignored, setIgnored] = useState(false);
  const shown = tasks
    .filter((t) => (paTab === 'done' ? t.done : t.bucket === paTab))
    .sort((a, b) => a.order - b.order);
  const tabs = [['today', 'Today'], ['up', 'Upcoming'], ['done', 'Completed']];

  return (
    <aside className="list">
      <div className="list-h"><b>Assistant</b><span className="note">Your PA</span></div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
        <Btn style={{ flex: 1, padding: 10 }} onClick={() => openModal('panew')}>✎ Type a task</Btn>
        <Btn kind="pri" style={{ flex: 1, padding: 10 }} onClick={() => openModal('voice')}>{MIC} Speak a task</Btn>
      </div>
      <div className="chips">
        {tabs.map(([id, label]) => (
          <button type="button" key={id} className={cx('chip', paTab === id && 'on')} onClick={() => setPaTab(id)}>{label}</button>
        ))}
      </div>

      {!taskAdded && !ignored && paTab !== 'done' && (
        <div className="card ai-card" style={{ margin: '4px 14px 8px', padding: '10px 12px' }}>
          <span className="ai">Suggested from chats</span>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>Send Q3 report to Priya</div>
          <div className="src">From Priya Sharma · “by 4 PM” · Today 4:00 PM</div>
          <div className="acts" style={{ marginTop: 8 }}>
            <Btn kind="pri" onClick={addQ3Task}>Add</Btn>
            <Btn kind="ghost" onClick={() => setIgnored(true)}>Ignore</Btn>
          </div>
        </div>
      )}

      {shown.map((t) => <TaskRow key={t.id} t={t} />)}
      <div className="foot">Tasks come from 3 places: typed, spoken, or suggested from chats. Every task needs your OK.</div>
    </aside>
  );
}

export function AssistantMain() {
  const { tasks, taskAdded, savedBanners, setPaTab, setToast, openModal, go } = useApp();
  const todayOpen = tasks.filter((t) => t.bucket === 'today' && !t.done).length;

  return (
    <main className="main">
      <div className="ch">
        <div>
          <span className="n">Today · Tuesday, 27 Oct</span>
          <span className="s">{todayOpen} tasks · next at {taskAdded ? '4:00 PM' : '6:30 PM'}</span>
        </div>
        <div className="r"><Btn onClick={() => setToast(true)}>▶ Preview 3:30 PM alert</Btn></div>
      </div>
      <div className="pad">
        {savedBanners.map((b) => (
          <div key={b.id} className="banner" style={{ margin: '0 0 12px' }}>
            ✓
            <span style={{ flex: 1 }}>
              Saved{b.tag === 'Voice' ? ' by voice' : ''}: <b>{b.title}</b> · {b.when}
            </span>
            <Btn onClick={() => setPaTab('up')}>See in Upcoming</Btn>
          </div>
        ))}
        <div className="grid2" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
          <div className="card">
            <b style={{ fontSize: 14 }}>Timeline</b>
            <div className="tl" style={{ marginTop: 6 }}>
              <div className="e done"><span className="hr">9:00 AM</span><span className="d" /><span style={{ flex: 1 }}>Team standup</span><span className="tag">Manual</span></div>
              <div className="e now"><span className="hr">10:45 AM</span><span className="d" style={{ background: '#111' }} /><span style={{ flex: 1 }}>Now</span></div>
              {taskAdded && (
                <div className="e"><span className="hr">4:00 PM</span><span className="d" /><span style={{ flex: 1 }}>Send Q3 report to Priya<div className="src">Reminder at 3:30 PM</div></span><span className="tag">From chat</span></div>
              )}
              <div className="e"><span className="hr">6:30 PM</span><span className="d" /><span style={{ flex: 1 }}>Pick up medicines for Dad</span><span className="tag">Voice</span></div>
              <div className="e"><span className="hr">7:00 PM</span><span className="d" /><span style={{ flex: 1 }}>Submit timesheet <span className="src">↻ weekly</span></span><span className="tag">Manual</span></div>
              <div className="e" style={{ border: 0 }}><span className="hr">Anytime</span><span className="d" style={{ borderStyle: 'dashed' }} /><span style={{ flex: 1 }}>Renew gym membership</span><span className="tag">Manual</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <b style={{ fontSize: 13.5 }}>Ask your PA</b>
              <div className="note" style={{ margin: '4px 0 10px' }}>Say or type things like:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                <div className="v">“Remind me to call the bank on Friday at 11 AM”</div>
                <div className="v">“Every Tuesday 7 PM, submit timesheet”</div>
                <div className="v">“What do I have tomorrow?”</div>
              </div>
              <Btn kind="pri" block style={{ marginTop: 10 }} onClick={() => openModal('voice')}>{MIC} Hold to speak</Btn>
            </div>
            <div className="card">
              <b style={{ fontSize: 13.5 }}>How reminders reach you</b>
              <div className="note" style={{ marginTop: 4 }}>A notification 30 min before (change per task), with Done, Snooze and Open chat.</div>
              <Btn style={{ marginTop: 8 }} onClick={() => go('rem')}>Open Reminders →</Btn>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const TRANSCRIPT = 'Remind me to call the bank on Friday at 11 AM about the loan papers';
const WAVE = [8, 18, 28, 14, 24, 10, 22, 30, 12, 20, 8];

export function VoiceModal() {
  const { setModal } = useApp();
  return (
    <Modal width={440}>
      <div style={{ textAlign: 'center' }}>
        <div className="mh" style={{ justifyContent: 'center' }}>Listening…</div>
        <div className="mb">
          <div className="mic">{MIC}</div>
          <div className="wave">{WAVE.map((h, i) => <i key={i} style={{ height: h }} />)}</div>
          <div className="v" style={{ textAlign: 'left', lineHeight: 1.5, marginTop: 10 }}>“{TRANSCRIPT}”</div>
          <div className="src" style={{ marginTop: 8 }}>Live transcript · audio is not saved</div>
        </div>
        <div className="mf" style={{ justifyContent: 'center' }}>
          <Btn kind="ghost" lg onClick={() => setModal(null)}>Cancel</Btn>
          <Btn kind="pri" lg onClick={() => setModal('voice2')}>Done</Btn>
        </div>
      </div>
    </Modal>
  );
}

const Field = ({ label, children, style }) => (
  <div className="field" style={style}><span className="lb">{label}</span>{children}</div>
);

export function VoiceConfirmModal() {
  const { setModal, saveTask } = useApp();
  const [f, setF] = useState({ title: 'Call the bank about loan papers', date: 'Fri, 30 Oct 2026', time: '11:00 AM', repeat: 'Does not repeat', remind: '30 min before' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = () => {
    if (!f.title.trim()) return;
    saveTask({ ...f, title: f.title.trim(), tag: 'Voice', source: `Added by voice just now: “${TRANSCRIPT}”` });
    setModal(null);
  };

  return (
    <Modal>
      <div className="mh"><span className="ai">Here’s what I understood</span></div>
      <div className="mb">
        <div className="src" style={{ marginBottom: 12 }}>You said: “{TRANSCRIPT}”</div>
        <Field label="Task · click to edit"><input className="v" value={f.title} onChange={set('title')} /></Field>
        <div className="grid2">
          <Field label="Date"><input className="v" value={f.date} onChange={set('date')} /></Field>
          <Field label="Time"><input className="v" value={f.time} onChange={set('time')} /></Field>
        </div>
        <div className="grid2">
          <Field label="Repeat">
            <select className="v" value={f.repeat} onChange={set('repeat')}>
              {['Does not repeat', 'Daily', 'Weekly', 'Monthly'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Remind me">
            <select className="v" value={f.remind} onChange={set('remind')}>
              {REMIND_OPTS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
        </div>
        <div className="card" style={{ background: '#f6f6f6', fontSize: 12.5, lineHeight: 1.5 }}>
          <b>If something is unclear, the PA asks.</b><br />
          You: “Remind me to pay rent next week.”<br />
          PA: “Which day next week? <span className="tag">Mon</span> <span className="tag">Tue</span> <span className="tag">Wed</span> …”
        </div>
      </div>
      <div className="mf">
        <Btn kind="ghost" lg onClick={() => setModal(null)}>Cancel</Btn>
        <Btn onClick={() => setModal('voice')}>{MIC} Say again</Btn>
        <Btn kind="pri" lg onClick={save}>Save task</Btn>
      </div>
    </Modal>
  );
}

const REPEATS = ['Never', 'Daily', 'Weekly', 'Monthly', 'No date (to-do)'];
const CONTACTS = ['None', 'Kiran (Brother)', 'Priya Sharma', 'Mom', 'Dad', 'Arjun', 'Ravi Kumar'];

export function NewTaskModal() {
  const { setModal, saveTask } = useApp();
  const [f, setF] = useState({
    title: 'Book flight to Hyderabad', date: 'Sat, 31 Oct 2026', time: '10:00 AM', repeat: 'Never',
    contact: 'Kiran (Brother)', remind: '30 min before', notes: 'Check Indigo and Air India fares',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const noDate = f.repeat === 'No date (to-do)';

  const save = () => {
    if (!f.title.trim()) return;
    saveTask({
      title: f.title.trim(), date: f.date, time: f.time, remind: f.remind, repeat: f.repeat, noDate,
      tag: 'Manual', who: f.contact === 'None' ? '' : f.contact, source: 'Typed by you · just now',
    });
    setModal(null);
  };

  return (
    <Modal>
      <div className="mh">New task</div>
      <div className="mb">
        <Field label="Task · click to edit"><input className="v" value={f.title} onChange={set('title')} /></Field>
        {!noDate && (
          <div className="grid2">
            <Field label="Date"><input className="v" value={f.date} onChange={set('date')} /></Field>
            <Field label="Time"><input className="v" value={f.time} onChange={set('time')} /></Field>
          </div>
        )}
        <Field label="Repeat"><ChipSelect options={REPEATS} value={f.repeat} onChange={(v) => setF({ ...f, repeat: v })} /></Field>
        <div className="grid2">
          <Field label="Link to contact (optional)">
            <select className="v" value={f.contact} onChange={set('contact')}>
              {CONTACTS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Remind me">
            <select className="v" value={f.remind} onChange={set('remind')} disabled={noDate}>
              {REMIND_OPTS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes" style={{ margin: 0 }}>
          <textarea className="v" rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </div>
      <div className="mf">
        <Btn kind="ghost" lg onClick={() => setModal(null)}>Cancel</Btn>
        <Btn kind="pri" lg onClick={save}>Save task</Btn>
      </div>
    </Modal>
  );
}

export function ReminderToast() {
  const { setToast, openChat } = useApp();
  return (
    <div className="toast">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 20 }}>⏰</span>
        <div style={{ flex: 1 }}>
          <b>Reminder · due 4:00 PM</b>
          <div style={{ fontSize: 12, color: '#bbb' }}>Send Q3 report to Priya · from her chat</div>
        </div>
        <span style={{ fontSize: 11, color: '#999' }}>3:30 PM</span>
      </div>
      <div className="acts">
        <Btn kind="pri" onClick={() => setToast(false)}>✓ Done</Btn>
        <Btn onClick={() => setToast(false)}>Snooze 15 min</Btn>
        <Btn onClick={() => openChat('priya')}>Open chat</Btn>
      </div>
    </div>
  );
}
