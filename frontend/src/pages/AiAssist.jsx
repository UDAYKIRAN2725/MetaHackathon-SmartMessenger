import { useState } from 'react';
import { useApp } from '../AppContext';
import { ASSIST } from '../data';
import { Btn } from '../components/common';
import { cx } from '../utils';

// Two-step AI assist: (1) user gives a goal + context, (2) user picks a reply that fills the composer.
// Replies are sample data for now; swap `goal.replies` for an API call later.
export default function AiAssist({ chatId, picked, onPick, onClose }) {
  const { aiAllowed, setAi } = useApp();
  const cfg = ASSIST[chatId];
  const [step, setStep] = useState('ask');
  const [goal, setGoal] = useState(0);
  const [contexts, setContexts] = useState(() => cfg.goals.map((g) => g.context || ''));
  const [showCtx, setShowCtx] = useState(false);

  if (!aiAllowed[chatId]) {
    return (
      <div className="banner">
        ⛉
        <span style={{ flex: 1 }}>
          <b>AI assist needs permission for this chat.</b>
          <br />
          <span className="note">Until you allow it, nothing from {cfg.name}’s chat is sent to the AI.</span>
        </span>
        <Btn kind="pri" onClick={() => setAi(chatId, true)}>Allow for this chat</Btn>
        <Btn kind="ghost" onClick={onClose}>Not now</Btn>
      </div>
    );
  }

  const g = cfg.goals[goal];
  const text = contexts[goal];
  const edited = text !== g.context;
  const closeBtn = <Btn kind="ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>✕ Close</Btn>;

  if (step === 'ask') {
    return (
      <div className="sugg">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ai">AI assist</span>
          <span className="steps"><i className="on">1</i>What do you want to say? <i>2</i>Pick a reply</span>
          {closeBtn}
        </div>
        <div className="lb" style={{ marginTop: 10 }}>Quick goals</div>
        <div className="chips" style={{ padding: 0 }}>
          {cfg.goals.map((x, i) =>
            x.replies ? (
              <button type="button" key={x.chip} className={cx('chip', i === goal && 'on')} onClick={() => setGoal(i)}>{x.chip}</button>
            ) : (
              <span key={x.chip} className="chip">{x.chip}</span>
            ),
          )}
        </div>
        <div className="lb" style={{ marginTop: 10 }}>Your context · click to type</div>
        <textarea
          className="v goalbox"
          rows={2}
          value={text}
          onChange={(e) => setContexts((c) => c.map((v, i) => (i === goal ? e.target.value : v)))}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <Btn kind="pri" onClick={() => setStep('res')}>✦ Suggest replies</Btn>
          <span className="note" style={{ flex: 1 }}>{cfg.note}</span>
          {cfg.revoke && <Btn kind="ghost" onClick={() => setAi(chatId, false)}>Revoke permission</Btn>}
        </div>
      </div>
    );
  }

  return (
    <div className="sugg">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="ai">AI assist</span>
        <span className="steps"><i>1</i>Context <i className="on">2</i>{cfg.step2 || 'Pick a reply'}</span>
        {closeBtn}
      </div>
      <div className="goalbar">
        <b>Your goal:</b>
        <span style={{ flex: 1 }}>{edited ? `“${text}”` : g.summary}</span>
        <Btn kind="ghost" onClick={() => setStep('ask')}>✎ Change</Btn>
        <Btn kind="ghost">↻ Regenerate</Btn>
      </div>
      <div className="sgrid">
        {g.replies.map((r, k) => {
          const key = `${goal}-${k}`;
          return (
            <button type="button" key={key} className={cx('sopt', picked === key && 'on')} onClick={() => onPick(key, r.text)}>
              <i>{r.label}</i>
              {r.text}
            </button>
          );
        })}
      </div>
      {cfg.context && (
        <div className="ctx">
          <button type="button" className="note" style={{ textDecoration: 'underline' }} onClick={() => setShowCtx((s) => !s)}>
            Context sent to AI for this suggestion {showCtx ? '▴' : '▾'}
          </button>
          {showCtx && (
            <div className="ctxb" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div><b>Your context (this reply)</b>{edited ? text : g.ctx}</div>
              {cfg.context.map((c) => (
                <div key={c.t}><b>{c.t}</b>{c.v}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
