import { useState } from 'react';
import { useApp } from '../AppContext';
import { SENT_HISTORY } from '../data';
import { Btn, Modal, ToggleRow } from '../components/common';
import { cx, newId } from '../utils';

function SchRow({ s, paused }) {
  const isPaused = s.pausable && paused;
  return (
    <div className={cx('row', s.dim && 'dim')} style={s.id === 'mom' ? { background: '#e6e6e6' } : undefined}>
      <span className="av">{s.av}</span>
      <span className="meta">
        <span className="top"><span>{s.name}</span><span className={cx('time', s.id === 'mom' && 'u')}>{s.time}</span></span>
        <span className="sub">
          <span className="t">{s.text}</span>
          {isPaused ? <span className="tag solid">Paused</span> : <span className={cx('tag', s.solid && 'solid')}>{s.tag}</span>}
        </span>
        <span className="why">{s.why}</span>
      </span>
    </div>
  );
}

export function ScheduledList() {
  const { scheduled, schPaused, schTab, setSchTab, openModal } = useApp();
  const rec = scheduled.filter((s) => s.kind === 'rec').sort((a, b) => a.order - b.order);
  const once = scheduled.filter((s) => s.kind === 'once').sort((a, b) => a.order - b.order);

  return (
    <aside className="list">
      <div className="list-h"><b>Scheduled</b><Btn kind="pri" onClick={() => openModal('schnew')}>+ New</Btn></div>
      <div className="chips">
        <button type="button" className={cx('chip', schTab === 'act' && 'on')} onClick={() => setSchTab('act')}>Active</button>
        <button type="button" className={cx('chip', schTab === 'hist' && 'on')} onClick={() => setSchTab('hist')}>Sent history</button>
      </div>
      {schTab === 'act' ? (
        <div>
          <div className="gh">Recurring</div>
          {rec.map((s) => <SchRow key={s.id} s={s} paused={schPaused} />)}
          <div className="gh">One-time</div>
          {once.map((s) => <SchRow key={s.id} s={s} paused={schPaused} />)}
        </div>
      ) : (
        <div>
          {SENT_HISTORY.map((h, i) => (
            <div key={i} className={cx('row', h.dim && 'dim')}>
              <span className="av">{h.av}</span>
              <span className="meta">
                <span className="top"><span>{h.name}</span><span className="time">{h.time}</span></span>
                <span className="sub"><span className="t">{h.text}</span><span className="tag">{h.tag}</span></span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="foot">You write every scheduled message. The AI never changes it before sending.</div>
    </aside>
  );
}

export function ScheduledDetail() {
  const { schPaused, setSchPaused } = useApp();
  return (
    <main className="main">
      <div className="ch">
        <span className="av sm">MO</span>
        <div><span className="n">Mom · daily good morning</span><span className="s">Created 12 Oct · sent 15 times</span></div>
        <div className="r"><Btn>✎ Edit</Btn><Btn>Skip next</Btn><Btn kind="ghost">Delete</Btn></div>
      </div>
      <div className="pad">
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <span className="lb">Message (sent exactly as written)</span>
              <div className="b out" style={{ maxWidth: '100%', display: 'inline-block' }}>Good morning Amma ☀️</div>
            </div>
            <div className="card">
              <div className="set"><div className="tx"><b>Repeats</b><span>Every day at 7:00 AM</span></div></div>
              <div className="set"><div className="tx"><b>Next sends</b><span>Wed 28 Oct · Thu 29 Oct · Fri 30 Oct, 7:00 AM</span></div></div>
              <ToggleRow style={{ border: 0 }} title="Pause this schedule" checked={schPaused} onChange={setSchPaused}>
                <span>{schPaused ? 'Paused · nothing will be sent' : 'Active'}</span>
              </ToggleRow>
            </div>
          </div>
          <div className="card">
            <b style={{ fontSize: 14 }}>Safeguards</b>
            <ToggleRow defaultChecked title="Notify me 5 min before sending" desc="“Sending ‘Good morning Amma ☀️’ to Mom at 7:00 · Cancel”" />
            <div className="set">
              <div className="tx"><b>Same text every time</b><span>The AI never rewrites a scheduled message</span></div>
              <span className="tag solid">Locked</span>
            </div>
            <ToggleRow defaultChecked style={{ border: 0 }} title="Skip if I already chatted today" desc="Don’t send if you messaged Mom since midnight" />
          </div>
        </div>
      </div>
    </main>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHORT = { Mon: 'M', Tue: 'Tu', Wed: 'W', Thu: 'Th', Fri: 'F', Sat: 'Sa', Sun: 'Su' };
const DRAFT = 'Hey Sneha! Gym at 6 today? Let’s not skip leg day 😄';

const listText = (d) => (d.length <= 1 ? d.join('') : `${d.slice(0, -1).join(', ')} and ${d[d.length - 1]}`);

export function NewScheduleModal() {
  const { setModal, setScheduled } = useApp();
  const [text, setText] = useState('Hey! Gym today at 6? 💪');
  const [helper, setHelper] = useState(false);
  const [repeat, setRepeat] = useState('Weekly');
  const [days, setDays] = useState(['Mon', 'Wed', 'Fri']);
  const [time, setTime] = useState('5:30 PM');
  const [starts, setStarts] = useState('Wed, 28 Oct 2026');

  const startShort = starts.replace(',', '').replace(/\s\d{4}$/, '');
  const ordered = WEEKDAYS.filter((d) => days.includes(d));
  const summary = {
    Once: `Sends once on ${startShort} at ${time}.`,
    Daily: `Sends every day at ${time}, starting ${startShort}.`,
    Weekly: `Sends every ${listText(ordered)} at ${time}, starting ${startShort}.`,
    Custom: `Sends every 2 weeks on ${listText(ordered)} at ${time}.`,
  }[repeat];
  const toggleDay = (d) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const save = () => {
    if (!text.trim()) return;
    if ((repeat === 'Weekly' || repeat === 'Custom') && !ordered.length) return;
    const dayTag = ordered.map((d) => SHORT[d]).join(' ');
    const tag = { Once: 'Once', Daily: '↻ Daily', Weekly: `↻ ${dayTag}`, Custom: `↻ 2 wk ${dayTag}` }[repeat];
    setScheduled((s) => [
      ...s,
      {
        id: newId('sch'), av: 'SN', name: 'Sneha', time, text: text.trim(), tag,
        why: repeat === 'Once' ? `${startShort} · just added` : `Next: ${startShort} · just added`,
        kind: repeat === 'Once' ? 'once' : 'rec', order: 3,
      },
    ]);
    setModal(null);
  };

  return (
    <Modal width={540}>
      <div className="mh">Schedule a message</div>
      <div className="mb">
        <div className="field">
          <span className="lb">To</span>
          <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="av sm">SN</span><b style={{ flex: 1 }}>Sneha</b><span className="tag">Friends</span><span className="src">change ▾</span>
          </div>
        </div>
        <div className="field">
          <span className="lb">Message · click to edit</span>
          <textarea className="v" rows={2} style={{ minHeight: 56 }} value={text} onChange={(e) => setText(e.target.value)} />
          <Btn style={{ marginTop: 8 }} onClick={() => setHelper((h) => !h)}>✦ Help me write</Btn>
          {helper && (
            <div className="card ai-card" style={{ marginTop: 8, padding: '10px 12px', fontSize: 13 }}>
              “{DRAFT}”
              <div className="acts" style={{ marginTop: 8 }}>
                <Btn kind="pri" onClick={() => { setText(DRAFT); setHelper(false); }}>Use this</Btn>
                <Btn kind="ghost" onClick={() => setHelper(false)}>Dismiss</Btn>
              </div>
              <div className="src" style={{ marginTop: 6 }}>You approve the draft once. After that the same text is sent every time.</div>
            </div>
          )}
        </div>
        <div className="field">
          <span className="lb">Repeat</span>
          <div className="chips" style={{ padding: 0 }}>
            {['Once', 'Daily', 'Weekly', 'Custom'].map((r) => (
              <button type="button" key={r} className={cx('chip', repeat === r && 'on')} onClick={() => setRepeat(r)}>{r}</button>
            ))}
          </div>
          {(repeat === 'Weekly' || repeat === 'Custom') && (
            <div className="chips" style={{ padding: '8px 0 0' }}>
              {WEEKDAYS.map((d) => (
                <button type="button" key={d} className={cx('chip', days.includes(d) && 'on')} onClick={() => toggleDay(d)}>{d}</button>
              ))}
            </div>
          )}
        </div>
        <div className="grid2">
          <div className="field"><span className="lb">Time</span><input className="v" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div className="field"><span className="lb">Starts</span><input className="v" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
        </div>
        <ToggleRow defaultChecked style={{ paddingTop: 0 }} title="Notify me 5 min before sending" desc="So you can cancel or edit" />
        <div className="card" style={{ background: '#f6f6f6', fontSize: 13, marginTop: 10 }}>◷ {summary}</div>
      </div>
      <div className="mf">
        <Btn kind="ghost" lg onClick={() => setModal(null)}>Cancel</Btn>
        <Btn kind="pri" lg onClick={save}>Schedule</Btn>
      </div>
    </Modal>
  );
}
