import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { useChats } from '../ChatStore';
import { useTasks } from '../TaskStore';
import { Btn, Modal } from '../components/common';
import TaskForm from '../components/TaskForm';
import ChatTasks from './ChatTasks';
import {
  SOURCE_TAG, bucket, byDue, clock, dayOffset, isOverdue, longDay, offsetLabel, whenLabel,
} from '../paFormat';
import { cx } from '../utils';

const MIC = '🎙\uFE0E';
const EXAMPLES = [
  'Remind me to call the bank on Friday at 11 AM',
  'Every Tuesday 7 PM, submit timesheet',
  'What do I have tomorrow?',
];

function TaskRow({ t }) {
  const { done, reopen } = useTasks();
  const { go, setRemSel } = useApp();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await (t.status === 'done' ? reopen(t.id) : done(t.id));
    } finally {
      setBusy(false);
    }
  };
  const over = isOverdue(t);
  return (
    <div className="row">
      <input id={`tk-${t.id}`} type="checkbox" className="lc" checked={t.status === 'done'} disabled={busy} onChange={toggle} />
      <label htmlFor={`tk-${t.id}`} className="chk" title={t.repeat !== 'none' ? 'Done for this time' : 'Mark done'} />
      <button type="button" className="meta" style={{ textAlign: 'left' }} onClick={() => { setRemSel(t.id); go('rem'); }}>
        <span className="top">
          <span>{t.title}</span>
          <span className={cx('time', (over || dayOffset(t.due_at || 0) === 0) && t.due_at && 'u')}>
            {t.status === 'done' ? whenLabel(t.completed_at) : whenLabel(t.due_at)}
          </span>
        </span>
        <span className="why">
          {over && <span className="tag solid">Overdue</span>}
          <span className="tag">{SOURCE_TAG[t.source]}</span>
          {t.chat_name || (t.repeat !== 'none' ? `↻ ${t.repeat}` : !t.due_at ? 'no date' : t.notes)}
        </span>
      </button>
    </div>
  );
}

export function AssistantList() {
  const { tasks, loading, error } = useTasks();
  const { paTab, setPaTab, openModal } = useApp();
  const shown = tasks
    .filter((t) => bucket(t) === paTab)
    .sort(paTab === 'done' ? (a, b) => new Date(b.completed_at) - new Date(a.completed_at) : byDue);
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
          <button type="button" key={id} className={cx('chip', paTab === id && 'on')} onClick={() => setPaTab(id)}>
            {label} <span className="n">{tasks.filter((t) => bucket(t) === id).length}</span>
          </button>
        ))}
      </div>
      {error && <div className="alert" style={{ margin: '0 16px 10px' }}>{error}</div>}
      {loading ? <div className="empty note">Loading tasks…</div> : shown.map((t) => <TaskRow key={t.id} t={t} />)}
      {!loading && shown.length === 0 && <div className="empty note">Nothing here.</div>}
      <div className="foot">Tasks come from 3 places: typed, spoken, or found in chats. Nothing is saved without your OK.</div>
    </aside>
  );
}

const rangeLabel = (from, to) => {
  const f = (d) => new Date(`${d}T12:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
  return from === to ? f(from) : `${f(from)} – ${f(to)}`;
};

function ChatSuggestions() {
  const { allSuggestions } = useTasks();
  const { items } = useChats();
  const [sugs, setSugs] = useState([]);
  const key = items.map((i) => `${i.id}:${i.suggestions}`).join();
  useEffect(() => {
    allSuggestions().then((r) => setSugs(r.items)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!sugs.length) return null;
  return (
    <div className="card ai-card" style={{ marginBottom: 12, paddingBottom: 4 }}>
      <span className="ai">Suggested from chats</span>
      <div className="src" style={{ margin: '4px 0 8px' }}>Found by Smart priority in unread messages. Nothing is saved until you add it.</div>
      <div style={{ margin: '0 -18px' }}><ChatTasks key={key} state={{ items: sugs }} quietWhenEmpty /></div>
    </div>
  );
}

export function AssistantMain() {
  const { tasks, parse, create } = useTasks();
  const { modal, setModal, go, setRemSel } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState([]);
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const inputRef = useRef(null);

  useEffect(() => {
    if (modal === 'panew') {
      inputRef.current?.focus();
      setModal(null);
    }
  }, [modal, setModal]);

  const run = async (q, source = 'typed') => {
    const s = q.trim();
    if (!s || busy) return;
    setBusy(true);
    setErr('');
    setText(s);
    try {
      setResult({ ...(await parse(s, source)), source, text: s });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (body) => {
    const d = result.draft;
    const t = await create({ ...body, source: d.source, source_text: d.source_text });
    setSaved((b) => [t, ...b.filter((x) => x.id !== t.id)].slice(0, 3));
    setResult(null);
    setText('');
  };

  const open = tasks.filter((t) => t.status === 'open');
  const today = open.filter((t) => t.due_at && dayOffset(t.due_at) === 0).sort(byDue);
  const overdue = open.filter(isOverdue);
  const next = open.filter((t) => t.reminder && t.reminder.status === 'pending').sort((a, b) => new Date(a.reminder.fire_at) - new Date(b.reminder.fire_at))[0];
  const doneToday = tasks.filter((t) => t.status === 'done' && t.completed_at && dayOffset(t.completed_at) === 0);

  return (
    <main className="main">
      <div className="ch">
        <div>
          <span className="n">Today · {longDay()}</span>
          <span className="s">
            {today.length} due today{overdue.length ? ` · ${overdue.length} overdue` : ''}
            {next ? ` · next alert ${whenLabel(next.reminder.fire_at)}` : ''}
          </span>
        </div>
      </div>
      <div className="pad">
        <div className="card" style={{ marginBottom: 12 }}>
          <b style={{ fontSize: 13.5 }}>Ask your PA</b>
          <form
            onSubmit={(e) => { e.preventDefault(); run(text); }}
            style={{ display: 'flex', gap: 8, marginTop: 8 }}
          >
            <input
              ref={inputRef}
              className="v"
              style={{ flex: 1 }}
              maxLength={500}
              placeholder="e.g. Remind me to call the bank on Friday at 11 AM"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="btn pri" disabled={busy || !text.trim()}>{busy ? '✦ Thinking…' : '✦ Go'}</button>
            <Btn title="Speak" onClick={() => setModal('voice')}>{MIC}</Btn>
          </form>
          <div className="chips" style={{ padding: '8px 0 0' }}>
            {EXAMPLES.map((x) => <button type="button" key={x} className="chip" onClick={() => run(x)}>“{x}”</button>)}
          </div>
          {err && <div className="alert" style={{ marginTop: 10, marginBottom: 0 }}>{err}</div>}
        </div>

        {result?.action === 'create' && (
          <div className="card ai-card" style={{ marginBottom: 12 }}>
            <span className="ai">Here’s what I understood</span>
            <div className="src" style={{ margin: '4px 0 12px' }}>
              You {result.source === 'voice' ? 'said' : 'typed'}: “{result.text}”. Check it, then save. Nothing is saved yet.
            </div>
            <TaskForm
              initial={result.draft}
              warnings={result.assumed}
              onSave={save}
              onCancel={() => setResult(null)}
              extra={<Btn onClick={() => setModal('voice')}>{MIC} Say again</Btn>}
            />
          </div>
        )}

        {result?.action === 'ask' && (
          <div className="card ai-card" style={{ marginBottom: 12 }}>
            <span className="ai">Quick question</span>
            <div style={{ fontSize: 14, margin: '6px 0 10px' }}>{result.question}</div>
            <div className="chips" style={{ padding: 0 }}>
              {result.options.map((o) => (
                <button type="button" key={o} className="chip" disabled={busy} onClick={() => run(`${result.text} (${o})`, result.source)}>{o}</button>
              ))}
              <Btn kind="ghost" onClick={() => setResult(null)}>Cancel</Btn>
            </div>
            <div className="src" style={{ marginTop: 8 }}>Or type a more specific request above.</div>
          </div>
        )}

        {result?.action === 'list' && (
          <div className="card pa-list" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <b style={{ flex: 1, fontSize: 14 }}>{rangeLabel(result.from, result.to)}</b>
              <Btn kind="ghost" onClick={() => setResult(null)}>✕</Btn>
            </div>
            <div className="tl" style={{ marginTop: 6 }}>
              {result.tasks.map((t) => (
                <div key={t.id} className="e">
                  <span className="hr">{clock(t.due_at)}</span><span className="d" />
                  <span style={{ flex: 1 }}>{t.title}</span><span className="tag">{SOURCE_TAG[t.source]}</span>
                </div>
              ))}
              {result.tasks.length === 0 && <div className="note" style={{ padding: '8px 0' }}>Nothing planned. 🎉</div>}
            </div>
          </div>
        )}

        <ChatSuggestions />

        {saved.map((t) => (
          <div key={t.id} className="banner" style={{ margin: '0 0 12px' }}>
            ✓
            <span style={{ flex: 1 }}>
              Saved{t.source === 'voice' ? ' by voice' : ''}: <b>{t.title}</b> · {t.due_at ? whenLabel(t.due_at) : 'no date'}
              {t.reminder && ` · alert ${whenLabel(t.reminder.fire_at)}`}
            </span>
            <Btn onClick={() => { setRemSel(t.id); go('rem'); }}>View reminder</Btn>
            <Btn kind="ghost" onClick={() => setSaved((b) => b.filter((x) => x.id !== t.id))}>✕</Btn>
          </div>
        ))}

        <div className="grid2" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
          <div className="card">
            <b style={{ fontSize: 14 }}>Today’s timeline</b>
            <div className="tl" style={{ marginTop: 6 }}>
              {doneToday.map((t) => (
                <div key={t.id} className="e done"><span className="hr">{clock(t.completed_at)}</span><span className="d" /><span style={{ flex: 1 }}>{t.title}</span><span className="tag">Done</span></div>
              ))}
              {overdue.map((t) => (
                <div key={t.id} className="e"><span className="hr">{clock(t.due_at)}</span><span className="d" style={{ background: '#b00020', borderColor: '#b00020' }} /><span style={{ flex: 1 }}>{t.title}</span><span className="tag solid">Overdue</span></div>
              ))}
              <div className="e now"><span className="hr">{clock(new Date().toISOString())}</span><span className="d" style={{ background: '#111' }} /><span style={{ flex: 1 }}>Now</span></div>
              {today.filter((t) => !isOverdue(t)).map((t) => (
                <div key={t.id} className="e">
                  <span className="hr">{clock(t.due_at)}</span><span className="d" />
                  <span style={{ flex: 1 }}>{t.title}{t.reminder && <div className="src">Alert {clock(t.reminder.fire_at)} · {offsetLabel(t.remind_offset_min)}</div>}</span>
                  <span className="tag">{SOURCE_TAG[t.source]}</span>
                </div>
              ))}
              {open.filter((t) => !t.due_at).map((t) => (
                <div key={t.id} className="e" style={{ border: 0 }}><span className="hr">Anytime</span><span className="d" style={{ borderStyle: 'dashed' }} /><span style={{ flex: 1 }}>{t.title}</span><span className="tag">{SOURCE_TAG[t.source]}</span></div>
              ))}
            </div>
          </div>
          <div className="card">
            <b style={{ fontSize: 13.5 }}>How reminders reach you</b>
            <div className="note" style={{ marginTop: 4 }}>
              An alert in this app at the time you choose, with Done, Snooze and Open chat. If you’re offline, it’s waiting when you come back.
            </div>
            {perm === 'default' && (
              <Btn style={{ marginTop: 8 }} onClick={() => Notification.requestPermission().then(setPerm)}>Turn on desktop notifications</Btn>
            )}
            {perm === 'granted' && <div className="note" style={{ marginTop: 8 }}>✓ Desktop notifications are on (shown when this tab is in the background).</div>}
            {perm === 'denied' && <div className="note" style={{ marginTop: 8 }}>Desktop notifications are blocked in your browser settings.</div>}
            <div className="acts" style={{ marginTop: 8 }}><Btn onClick={() => go('rem')}>Open Reminders →</Btn></div>
          </div>
        </div>
      </div>
      {modal === 'voice' && (
        <VoiceModal onCancel={() => setModal(null)} onDone={(t) => { setModal(null); run(t, 'voice'); }} />
      )}
    </main>
  );
}

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export function VoiceModal({ onDone, onCancel }) {
  const [final, setFinal] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState(SR ? '' : 'Voice input isn’t supported in this browser. Use Chrome or Edge, or type the task.');
  const recRef = useRef(null);

  const start = () => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = navigator.language || 'en-IN';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      let f = '';
      let i = '';
      for (const r of e.results) (r.isFinal ? (f += r[0].transcript) : (i += r[0].transcript));
      setFinal(f);
      setInterim(i);
    };
    rec.onerror = (e) =>
      setErr(
        e.error === 'not-allowed' ? 'Microphone permission was denied.'
          : e.error === 'no-speech' ? 'I didn’t hear anything. Tap “Listen again”.'
            : `Voice error: ${e.error}`,
      );
    rec.onend = () => setListening(false);
    setErr('');
    rec.start();
    setListening(true);
    recRef.current = rec;
  };

  useEffect(() => {
    start();
    return () => {
      if (recRef.current) {
        recRef.current.onend = null;
        recRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = `${final} ${interim}`.trim();
  const finish = () => {
    recRef.current?.stop();
    if (text) onDone(text);
  };

  return (
    <Modal width={460}>
      <div style={{ textAlign: 'center' }}>
        <div className="mh" style={{ justifyContent: 'center' }}>{listening ? 'Listening…' : 'Voice task'}</div>
        <div className="mb">
          <div className="mic" style={listening ? undefined : { background: '#777' }}>{MIC}</div>
          <div className="v" style={{ textAlign: 'left', lineHeight: 1.5, marginTop: 18, minHeight: 48 }}>
            {text ? `“${text}”` : <span style={{ color: '#999' }}>Say something like “Remind me to call the bank on Friday at 11 AM”</span>}
          </div>
          {err && <div className="err" style={{ textAlign: 'left' }}>{err}</div>}
          <div className="src" style={{ marginTop: 8 }}>
            Your browser turns speech into text (Chrome uses Google’s speech service). Smart Messenger only receives the text, never audio.
          </div>
        </div>
        <div className="mf" style={{ justifyContent: 'center' }}>
          <Btn kind="ghost" lg onClick={onCancel}>Cancel</Btn>
          {!listening && SR && <Btn lg onClick={start}>{MIC} Listen again</Btn>}
          <Btn kind="pri" lg onClick={finish} disabled={!text}>Done</Btn>
        </div>
      </div>
    </Modal>
  );
}
