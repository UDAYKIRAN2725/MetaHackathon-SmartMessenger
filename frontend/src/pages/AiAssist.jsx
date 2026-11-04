import { useState } from 'react';
import { post } from '../api';
import { useChats } from '../ChatStore';
import { Btn } from '../components/common';
import { cx } from '../utils';

const GOALS = [
  { chip: '✓ Agree / confirm', goal: 'Agree or confirm' },
  { chip: '⏱ Ask for more time', goal: 'Ask for more time' },
  { chip: '✕ Politely decline', goal: 'Politely decline' },
  { chip: '? Ask a question', goal: 'Ask a clarifying question' },
  { chip: '✎ Something else…', goal: '' },
];

// Two steps: (1) permission + what you want to say, (2) pick an AI reply. The reply only fills
// the message box; nothing is sent until you press send.
export default function AiAssist({ item, onClose, onUse }) {
  const { updateContact } = useChats();
  const [goal, setGoal] = useState(0);
  const [context, setContext] = useState('');
  const [step, setStep] = useState('ask');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const [picked, setPicked] = useState(null);
  const [showCtx, setShowCtx] = useState(false);
  const first = item.partner.name.split(' ')[0];
  const setAi = (on) => updateContact(item.partner.id, { ai_allowed: on }).catch((e) => setErr(e.message));

  if (!item.ai_allowed) {
    return (
      <div className="banner">
        ⛉
        <span style={{ flex: 1 }}>
          <b>AI assist needs permission for this chat.</b>
          <br />
          <span className="note">Until you allow it, nothing from {first}’s chat is sent to the AI.{err && ` ${err}`}</span>
        </span>
        <Btn kind="pri" onClick={() => setAi(true)}>Allow for this chat</Btn>
        <Btn kind="ghost" onClick={onClose}>Not now</Btn>
      </div>
    );
  }

  const g = GOALS[goal];
  const canAsk = g.goal || context.trim();

  const run = async () => {
    if (!canAsk || busy) return;
    setBusy(true);
    setErr('');
    try {
      const r = await post(`/api/conversations/${item.id}/assist`, { goal: g.goal, context: context.trim() });
      setRes(r);
      setPicked(null);
      setStep('res');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const head = (stepEl) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="ai">AI assist</span>
      {stepEl}
      <Btn kind="ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>✕ Close</Btn>
    </div>
  );

  if (step === 'ask') {
    return (
      <div className="sugg">
        {head(<span className="steps"><i className="on">1</i>What do you want to say? <i>2</i>Pick a reply</span>)}
        <div className="lb" style={{ marginTop: 10 }}>Quick goals</div>
        <div className="chips" style={{ padding: 0 }}>
          {GOALS.map((x, i) => (
            <button type="button" key={x.chip} className={cx('chip', i === goal && 'on')} onClick={() => setGoal(i)}>{x.chip}</button>
          ))}
        </div>
        <div className="lb" style={{ marginTop: 10 }}>Your context · click to type</div>
        <textarea
          className="v goalbox"
          rows={2}
          maxLength={1000}
          placeholder={g.goal ? `Optional details, e.g. times or reasons` : `What should the reply to ${first} say?`}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && run()}
        />
        {err && <div className="err">{err}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <Btn kind="pri" onClick={run} disabled={!canAsk || busy}>{busy ? '✦ Thinking…' : '✦ Suggest replies'}</Btn>
          <span className="note" style={{ flex: 1 }}>
            Sends your goal, context, the last 10 messages of this chat and your saved memory about {first} to the AI, for this reply only. Nothing is saved.
          </span>
          <Btn kind="ghost" onClick={() => setAi(false)}>Revoke permission</Btn>
        </div>
      </div>
    );
  }

  const s = res.sent;
  return (
    <div className="sugg">
      {head(<span className="steps"><i>1</i>Context <i className="on">2</i>Pick a reply · it goes into the message box, you still press send</span>)}
      <div className="goalbar">
        <b>Your goal:</b>
        <span style={{ flex: 1 }}>{[s.goal, s.context && `“${s.context}”`].filter(Boolean).join(' · ')}</span>
        <Btn kind="ghost" onClick={() => setStep('ask')}>✎ Change</Btn>
        <Btn kind="ghost" onClick={run} disabled={busy}>{busy ? 'Thinking…' : '↻ Regenerate'}</Btn>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="sgrid" style={busy ? { opacity: 0.5 } : undefined}>
        {res.replies.map((r, k) => (
          <button
            type="button"
            key={k}
            className={cx('sopt', picked === k && 'on')}
            onClick={() => { setPicked(k); onUse(r.text); }}
          >
            <i>{r.label}</i>
            {r.text}
          </button>
        ))}
      </div>
      <div className="ctx">
        <button type="button" className="note" style={{ textDecoration: 'underline' }} onClick={() => setShowCtx((x) => !x)}>
          Context sent to AI for this suggestion {showCtx ? '▴' : '▾'}
        </button>
        {showCtx && (
          <div className="ctxb">
            <div><b>Your goal &amp; context</b>{s.goal || '—'}{s.context && <> · {s.context}</>}</div>
            <div><b>Chat history</b>Last {s.messages} messages of this chat (decrypted only for this request)</div>
            <div><b>Tone (from category)</b>{s.tone}</div>
            <div><b>Memory · {first}</b>{s.notes?.length ? s.notes.join(' · ') : 'No saved notes'}</div>
            <div><b>Memory · My rules</b>{s.rules?.length ? s.rules.join(' · ') : 'No matching rules'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
