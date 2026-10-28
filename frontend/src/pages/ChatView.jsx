import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { CHAT_INFO } from '../data';
import { Btn } from '../components/common';
import AiAssist from './AiAssist';
import { cx } from '../utils';

function PromiseCard() {
  const { taskAdded, addQ3Task, go, setRemSel, setRemTab } = useApp();
  return (
    <div className="sys">
      <span>✦ You promised to send the report.</span>
      {!taskAdded ? (
        <>
          <span>Add a reminder?</span>
          <Btn kind="pri" onClick={addQ3Task}>+ Add task · Today 4:00 PM</Btn>
        </>
      ) : (
        <>
          <span className="tag solid">✓ Added · reminder at 3:30 PM</span>
          <Btn onClick={() => { setRemTab('up'); setRemSel('q3'); go('rem'); }}>View reminder</Btn>
        </>
      )}
    </div>
  );
}

function Header({ id }) {
  const { aiAllowed, setDrawer } = useApp();
  const info = CHAT_INFO[id];
  const ai = aiAllowed[id];
  const avatar = <span className={cx('av sm', info.q && 'q')}>{info.av}</span>;
  const name = <span className="n">{info.name} <span className="tag">{info.cat}</span></span>;

  if (id === 'priya') {
    return (
      <div className="ch">
        {avatar}
        <button type="button" onClick={() => setDrawer((d) => !d)}>
          {name}
          <span className="s">{info.role} · AI assist {ai ? 'allowed' : 'not allowed'} · tap for info</span>
        </button>
        <div className="r"><Btn onClick={() => setDrawer(true)}>ⓘ Contact info</Btn></div>
      </div>
    );
  }
  const sub = id === 'ext' ? 'Not in your contacts' : id === 'mom' ? `${info.stats} · AI assist ${ai ? 'allowed' : 'not allowed yet'}` : info.stats;
  return (
    <div className="ch">
      {avatar}
      <div>{name}<span className="s">{sub}</span></div>
    </div>
  );
}

function ExternalBanner() {
  const [cat, setCat] = useState(null);
  return (
    <div className="banner" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <b style={{ flex: 1 }}>Unknown number</b>
        <span className="tag">AI off by default</span>
        <span className="tag">No ranking yet</span>
      </div>
      <div className="note">Save this contact and choose a category, or keep it in External.</div>
      <div className="acts">
        {['Friends', 'Professional', 'Family', 'Relatives'].map((c) => (
          <button type="button" key={c} className={cx('chip', cat === c && 'on')} onClick={() => setCat(c)}>{c}</button>
        ))}
        <span style={{ flex: 1 }} />
        <Btn>Save contact</Btn>
        <Btn kind="ghost">Block</Btn>
        <Btn kind="ghost">Report</Btn>
      </div>
    </div>
  );
}

export default function ChatView({ id }) {
  const app = useApp();
  const info = CHAT_INFO[id];
  const msgs = app.messages[id];
  const [draft, setDraft] = useState('');
  const [assistOpen, setAssistOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    app.sendMessage(id, text);
    setDraft('');
    setPicked(null);
    setAssistOpen(false);
  };

  return (
    <main className="main">
      <Header id={id} />

      <div className="msgs">
        {msgs.map((m, i) => {
          if (m.day) return <span key={i} className="day">{m.day}</span>;
          if (m.sys === 'promise') return <PromiseCard key={i} />;
          return (
            <div key={i} className={cx('b', m.out && 'out')}>
              {m.text}
              <small>{m.time}</small>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {assistOpen && !info.noAi && (
        <AiAssist
          chatId={id}
          picked={picked}
          onPick={(key, text) => { setPicked(key); setDraft(text); }}
          onClose={() => setAssistOpen(false)}
        />
      )}

      {id === 'priya' && !app.priyaSent && (
        <div className="banner" style={{ padding: '7px 12px' }}>
          <span className="tag">✦ Task found</span>
          <span style={{ flex: 1 }}>Send Q3 report to Priya · <b>Today 4:00 PM</b></span>
          {!app.taskAdded ? (
            <Btn onClick={app.addQ3Task}>+ Add task &amp; reminder</Btn>
          ) : (
            <span className="tag solid">✓ Added · reminder 3:30 PM</span>
          )}
        </div>
      )}
      {id === 'mom' && (
        <div className="banner">
          ◷
          <span style={{ flex: 1 }}>
            Scheduled: “Good morning Amma ☀️” · every day 7:00 AM{app.schPaused && ' · paused'}
          </span>
          <Btn onClick={() => app.go('sch')}>Manage</Btn>
        </div>
      )}
      {id === 'arjun' && (
        <div className="banner" style={{ padding: '7px 12px' }}>
          <span className="tag">✦ Task found</span>
          <span style={{ flex: 1 }}>Meet Arjun · <b>Sat 31 Oct, 6:00 PM</b> (if you confirm)</span>
          <Btn>+ Add task &amp; reminder</Btn>
        </div>
      )}
      {id === 'ext' && <ExternalBanner />}

      <div className="composer">
        <span>☺</span>
        <span>＋</span>
        <input
          className="input"
          placeholder={info.noAi ? 'Type a message' : 'Type a message, or tap ✦ AI assist for help'}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setPicked(null); }}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        {!info.noAi && (
          <button type="button" className={cx('aib', assistOpen && 'on')} onClick={() => setAssistOpen((o) => !o)}>✦ AI assist</button>
        )}
        {!info.noAi && (
          <button type="button" title="Schedule" onClick={() => app.openModal('schnew')}>◷</button>
        )}
        <button type="button" className="send" title="Send" onClick={send} disabled={!draft.trim()}>➤</button>
      </div>
    </main>
  );
}
