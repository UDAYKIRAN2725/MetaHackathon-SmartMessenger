import { useState } from 'react';
import { useApp } from '../AppContext';
import { useChats } from '../ChatStore';
import { initials } from '../auth';
import { Btn, ToggleRow } from '../components/common';
import { fmtDelay, fmtMin, scoreText } from '../format';
import { cx } from '../utils';

const CATS = [['fr', 'Friends'], ['pro', 'Professional'], ['fam', 'Family'], ['rel', 'Relatives'], ['ext', 'External']];

export default function ContactDrawer({ chatKey }) {
  const { setDrawer, openModal, go, setMemTab, setMemPerson } = useApp();
  const { resolve, updateContact, items, meta } = useChats();
  const item = resolve(chatKey);
  const [err, setErr] = useState('');
  if (!item) return null;

  const s = item.stats;
  const rank = [...items].filter((i) => i.stats.score != null).sort((a, b) => b.stats.score - a.stats.score).findIndex((i) => i.id === item.id);
  const upd = (body) => updateContact(item.partner.id, body).then(() => setErr('')).catch((e) => setErr(e.message));

  return (
    <aside className="drawer">
      <div className="dh">
        Contact info
        <button type="button" className="x" onClick={() => setDrawer(false)}>✕</button>
      </div>
      <div className="sec" style={{ textAlign: 'center' }}>
        <div className={cx('av', item.category === 'ext' && 'q')} style={{ width: 72, height: 72, margin: '0 auto 8px', fontSize: 22 }}>
          {initials(item.partner.name)}
        </div>
        <b>{item.partner.name}</b>
        <div className="src">+{item.partner.phone} · {item.partner.email}</div>
      </div>
      <div className="sec">
        <h4>Category</h4>
        <div className="chips" style={{ padding: 0 }}>
          {CATS.map(([c, l]) => (
            <button type="button" key={c} className={cx('chip', item.category === c && 'on')} onClick={() => upd({ category: c, ...(c === 'ext' ? { ai_allowed: false } : {}) })}>
              {l}{item.category === c && ' ✓'}
            </button>
          ))}
        </div>
        <div className="note" style={{ marginTop: 6 }}>One category per contact. Only you see it.</div>
      </div>
      <div className="sec">
        <h4>Your behaviour · last {meta?.window_days ?? 14} days</h4>
        <div className="grid2" style={{ gap: 8, marginBottom: 10 }}>
          <div className="card" style={{ padding: '8px 10px' }}>
            <div className="src">Avg read delay</div><b style={{ fontSize: 18 }}>{fmtDelay(s.avg_delay_min)}</b>
            <div className="src">read speed {s.read_speed ?? '—'}</div>
          </div>
          <div className="card" style={{ padding: '8px 10px' }}>
            <div className="src">Avg time / day</div><b style={{ fontSize: 18 }}>{fmtMin(s.min_per_day)}</b>
            <div className="src">time score {s.time_score ?? '—'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ flex: 1 }}>Priority score</span>
          <span className="tag solid">{scoreText(s.score)}{rank >= 0 && ` · #${rank + 1}`}</span>
        </div>
        <div className="note" style={{ marginTop: 6 }}>
          {s.tracked} read messages tracked{s.score == null && ` · needs ${meta?.min_tracked ?? 5} for a score`}. Only timestamps are used.
        </div>
      </div>
      <ToggleRow
        className="sec"
        style={{ padding: '13px 18px' }}
        title="AI suggestions in this chat"
        desc={item.category === 'ext' ? 'Save the contact in a category first' : 'Reads this chat only when you tap ✦ AI assist'}
        checked={item.ai_allowed}
        onChange={(v) => upd({ ai_allowed: v })}
      />
      {err && <div className="alert" style={{ margin: '10px 18px' }}>{err}</div>}
      {item.category !== 'ext' && (
        <div className="sec">
          <h4>Memory about {item.partner.name.split(' ')[0]}</h4>
          <div className="note">Notes and your rules are used by ✦ AI assist. You can also let AI suggest notes from this chat.</div>
          <Btn style={{ marginTop: 8 }} onClick={() => { setMemTab('ppl'); setMemPerson(item.partner.id); go('mem'); }}>Open in Memory →</Btn>
        </div>
      )}
      <div className="sec" style={{ border: 0 }}>
        <h4>Scheduled messages</h4>
        <div className="note">Scheduling connects in a later step.</div>
        <Btn style={{ marginTop: 6 }} onClick={() => openModal('schnew')}>+ Schedule a message</Btn>
      </div>
    </aside>
  );
}
