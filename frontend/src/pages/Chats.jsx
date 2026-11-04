import { useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { useChats } from '../ChatStore';
import { initials } from '../auth';
import { CATS } from '../data';
import { Btn, ChipSelect, Modal } from '../components/common';
import { catLabel, fmtDelay, fmtMin, listTime, scoreText, whyLine } from '../format';
import { cx } from '../utils';

export const isExt = (i) => i.category === 'ext';
const preview = (i) => (i.last ? `${i.last.from_me ? 'You: ' : ''}${i.last.text}` : 'No messages yet');

function ChatRow({ i, smart, showTag }) {
  const { openChat } = useApp();
  const { activeId, meta } = useChats();
  const sel = activeId === i.id;
  return (
    <button type="button" onClick={() => openChat(i.id)} className={cx('row click', !i.unread && 'read', sel && 'sel')}>
      <span className={cx('av', isExt(i) && 'q')}>{isExt(i) ? '?' : initials(i.partner.name)}</span>
      <span className="meta">
        <span className="top">
          <span>{isExt(i) ? `+${i.partner.phone}` : i.partner.name}</span>
          <span className={cx('time', i.unread > 0 && 'u')}>{listTime(i.last_message_at)}</span>
        </span>
        <span className="sub">
          <span className="t">{preview(i)}</span>
          {i.unread > 0 && !sel && <span className="badge">{i.unread}</span>}
        </span>
        {smart && (
          <span className="why" title={whyLine(i, meta?.min_tracked)}>
            {showTag && <span className="tag">{catLabel(i.category)}</span>}
            {i.llm ? (
              <>
                <span className="t" style={{ color: '#111' }}>✦ {i.llm.reason || 'AI priority'}</span>
                <b title={`Habit ${scoreText(i.stats.score)}, AI urgency ${i.llm.urgency}`}>
                  {i.stats.score != null && `${scoreText(i.stats.score)}→`}{scoreText(i.final)} ✦
                </b>
              </>
            ) : (
              <>
                {whyLine(i, meta?.min_tracked)}
                <b>{scoreText(i.stats.score)}</b>
              </>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

function NewChatModal({ onClose }) {
  const { startChat } = useChats();
  const { openChat } = useApp();
  const [ident, setIdent] = useState('');
  const [cat, setCat] = useState('Friends');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const code = { Friends: 'fr', Professional: 'pro', Family: 'fam', Relatives: 'rel' };

  const submit = async (e) => {
    e.preventDefault();
    if (!ident.trim()) return setErr('Enter their email or phone number.');
    setBusy(true);
    setErr('');
    try {
      const item = await startChat(ident.trim(), code[cat]);
      onClose();
      openChat(item.id);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal width={440}>
      <form onSubmit={submit}>
        <div className="mh">Start a new chat</div>
        <div className="mb">
          {err && <div className="alert">{err}</div>}
          <div className="field">
            <span className="lb">Email or phone</span>
            <input className="v" autoFocus placeholder="priya@demo.com or +91 90000 12345" value={ident} onChange={(e) => setIdent(e.target.value)} />
            <div className="src" style={{ marginTop: 4 }}>They must already have a Smart Messenger account.</div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <span className="lb">Category</span>
            <ChipSelect options={Object.keys(code)} value={cat} onChange={setCat} />
          </div>
        </div>
        <div className="mf">
          <Btn kind="ghost" lg onClick={onClose}>Cancel</Btn>
          <button type="submit" className="btn pri lg" disabled={busy}>{busy ? 'Starting…' : 'Start chat'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ChatsList() {
  const { cat, setCat, sort, setSort } = useApp();
  const { items: live, loading, error, online } = useChats();
  const [q, setQ] = useState('');
  const [newChat, setNewChat] = useState(false);
  // While the pointer is over the list, keep the current order so rows don't jump under the cursor
  // when AI scores arrive. New chats still appear (at the top); the order catches up on mouse-leave.
  const [hover, setHover] = useState(false);
  const frozen = useRef(null);
  let items = live;
  if (hover && frozen.current) {
    const idx = new Map(frozen.current.map((id, n) => [id, n]));
    items = [...live].sort((a, b) => (idx.get(a.id) ?? -1) - (idx.get(b.id) ?? -1));
  } else {
    frozen.current = live.map((i) => i.id);
  }

  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const matches = (i) =>
    !term || i.partner.name.toLowerCase().includes(term) || i.partner.email.includes(term) || (digits && i.partner.phone.includes(digits));
  const unreadIn = (id) => items.filter((i) => i.unread > 0 && (id === 'all' || i.category === id)).length;
  const visible = items.filter((i) => (cat === 'all' || i.category === cat) && matches(i));
  const smart = sort === 'smart';
  const showTag = cat === 'all';

  let body;
  if (smart) {
    const unread = visible.filter((i) => i.unread > 0);
    const read = visible.filter((i) => !i.unread);
    body = (
      <>
        <div className="gh"><span>Unread · {unread.length}</span><span>ranked by habit</span></div>
        {unread.map((i) => <ChatRow key={i.id} i={i} smart showTag={showTag} />)}
        <div className="gh"><span>Read · {read.length}</span></div>
        {read.map((i) => <ChatRow key={i.id} i={i} smart showTag={showTag} />)}
      </>
    );
  } else {
    body = visible.map((i) => <ChatRow key={i.id} i={i} />);
  }

  return (
    <aside className="list" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="list-h">
        <b>Chats</b>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="seg">
            <button type="button" className={cx(smart && 'on')} onClick={() => setSort('smart')}>Smart</button>
            <button type="button" className={cx(!smart && 'on')} onClick={() => setSort('recent')}>Recent</button>
          </span>
          <Btn kind="pri" title="New chat" onClick={() => setNewChat(true)}>＋</Btn>
        </span>
      </div>
      <input className="search" placeholder="⌕  Search chats" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {CATS.map((c) => (
          <button type="button" key={c.id} className={cx('chip', cat === c.id && 'on')} onClick={() => setCat(c.id)}>
            {c.label} <span className="n">{unreadIn(c.id)}</span>
          </button>
        ))}
      </div>
      {error && <div className="alert" style={{ margin: '0 16px 10px' }}>{error}</div>}
      <div className="clist">
        {loading ? <div className="empty note">Loading chats…</div> : body}
        {!loading && items.length === 0 && (
          <div className="empty note">No chats yet. Tap ＋ to message someone by email or phone.</div>
        )}
        {!loading && items.length > 0 && visible.length === 0 && <div className="empty note">No chats match.</div>}
      </div>
      <div className="foot">
        {smart
          ? items.some((i) => i.ai_rank)
            ? 'Smart order: unread first, then habit score. ✦ = AI also read the unread messages (only contacts you picked in Settings).'
            : 'Smart order: unread first, then by your habit score (0–100). Computed from timestamps only. No AI.'
          : 'Recent order: newest message first.'}
        <span style={{ float: 'right' }} title={online ? 'Live updates on' : 'Reconnecting…'}>{online ? '● live' : '○ offline'}</span>
      </div>
      {newChat && <NewChatModal onClose={() => setNewChat(false)} />}
    </aside>
  );
}

export function ChatsHome() {
  const { openChat } = useApp();
  const { items, meta } = useChats();
  const anyAi = items.some((i) => i.ai_rank);
  const scored = [...items].filter((i) => i.final != null).sort((a, b) => (b.unread > 0) - (a.unread > 0) || b.final - a.final);
  const unscored = items.filter((i) => i.final == null);
  const top = scored[0];
  const topMin = meta?.top_min_per_day || 0;

  return (
    <main className="main">
      <div className="pad">
        <div className="h2">Why your chats are in this order</div>
        <div className="note" style={{ marginBottom: 14 }}>
          Feature 1 · behaviour-based ranking · last {meta?.window_days ?? 14} days · no LLM · no message text used
        </div>
        <div className="grid2" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
          <div className="card">
            <table className="sc">
              <thead>
                <tr>
                  <th>#</th><th>Contact</th><th>Avg read delay</th><th>Avg time / day</th><th>Habit</th>
                  {anyAi && <><th>✦ AI urgency</th><th>Final</th></>}
                </tr>
              </thead>
              <tbody>
                {scored.map((i, n) => (
                  <tr key={i.id}>
                    <td>{n + 1}</td>
                    <td>{n < 2 ? <b>{i.partner.name}</b> : i.partner.name}{i.unread > 0 && <span className="src"> · {i.unread} unread</span>}</td>
                    <td className="num">{fmtDelay(i.stats.avg_delay_min)}</td>
                    <td className="num">{fmtMin(i.stats.min_per_day)}</td>
                    <td className="num">{scoreText(i.stats.score)}</td>
                    {anyAi && (
                      <>
                        <td className="num" title={i.llm?.reason}>{i.llm ? i.llm.urgency : i.ai_rank ? '·' : <span style={{ color: '#aaa' }}>off</span>}</td>
                        <td className="num"><b>{scoreText(i.final)}</b></td>
                      </>
                    )}
                  </tr>
                ))}
                {unscored.map((i) => (
                  <tr key={i.id} style={{ color: '#888' }}>
                    <td>–</td>
                    <td>{isExt(i) ? `+${i.partner.phone}` : i.partner.name}</td>
                    <td className="num">{fmtDelay(i.stats.avg_delay_min)}</td>
                    <td className="num">{fmtMin(i.stats.min_per_day)}</td>
                    <td className="num">—</td>
                    {anyAi && <><td className="num">—</td><td className="num">—</td></>}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={7} className="note">No chats yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <b style={{ fontSize: 13.5 }}>How the score works</b>
              <div className="formula" style={{ marginTop: 8 }}>
                read_delay = read_at − delivered_at<br />
                read_speed = 1 ÷ (1 + avg_delay_min ÷ 10)<br />
                time_score = min(avg_min_per_day ÷ {Math.round(topMin) || 'max'}, 1)<br />
                score = 100 × (0.5·read_speed + 0.5·time_score)
                {anyAi && <><br />final = habit + 0.4 × (ai_urgency − habit)<br /><span style={{ color: '#888' }}>  only unread chats you picked in Settings</span></>}
              </div>
              <div className="note" style={{ marginTop: 8 }}>
                {Math.round(topMin)} min = your most-used chat. Chats show “—” until {meta?.min_tracked ?? 5} read messages are tracked.
              </div>
            </div>
            {top && (
              <>
                <div className="card">
                  <b style={{ fontSize: 13.5 }}>Example: {top.partner.name}</b>
                  <div className="note" style={{ marginTop: 6, color: '#333' }}>
                    read_speed = 1 ÷ (1 + {(top.stats.avg_delay_min / 10).toFixed(2)}) = {top.stats.read_speed}<br />
                    time_score = {top.stats.min_per_day} ÷ {topMin} = {top.stats.time_score}<br />
                    score = 100 × (0.5·{top.stats.read_speed} + 0.5·{top.stats.time_score}) = <b>{top.stats.score}</b>
                  </div>
                </div>
                <Btn kind="pri" onClick={() => openChat(top.id)}>Open {top.partner.name.split(' ')[0]}’s chat →</Btn>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
