import { useState } from 'react';
import { useApp } from '../AppContext';
import { CATS, CAT_LABEL, CHATS, RANKING } from '../data';
import { Btn } from '../components/common';
import { cx } from '../utils';

function ChatRow({ c, smart, showTag }) {
  const { chat, openChat } = useApp();
  const sel = c.open && chat === c.open;
  const Tag = c.open ? 'button' : 'div';
  return (
    <Tag
      {...(c.open ? { type: 'button', onClick: () => openChat(c.open) } : {})}
      className={cx('row', !c.unread && 'read', c.dim && 'dim', c.open && 'click', sel && 'sel')}
    >
      <span className={cx('av', c.q && 'q')}>{c.av}</span>
      <span className="meta">
        <span className="top">
          <span>{c.name}</span>
          <span className={cx('time', c.unread > 0 && 'u')}>{c.time}</span>
        </span>
        <span className="sub">
          <span className="t">{c.last}</span>
          {c.unread > 0 && !sel && <span className="badge">{c.unread}</span>}
        </span>
        {smart && (
          <span className="why">
            {showTag && <span className="tag">{CAT_LABEL[c.cat]}</span>}
            {c.why}
            <b>{c.score}</b>
          </span>
        )}
      </span>
    </Tag>
  );
}

export function ChatsList() {
  const { cat, setCat, sort, setSort } = useApp();
  const [q, setQ] = useState('');

  const unreadIn = (id) => CHATS.filter((c) => c.unread > 0 && (id === 'all' || c.cat === id)).length;
  const visible = CHATS.filter((c) => (cat === 'all' || c.cat === cat) && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const smart = sort === 'smart';
  const showTag = cat === 'all';

  let body;
  if (smart) {
    const unread = visible.filter((c) => c.unread > 0).sort((a, b) => a.s - b.s);
    const read = visible.filter((c) => !c.unread).sort((a, b) => a.s - b.s);
    body = (
      <>
        <div className="gh"><span>Unread · {unread.length}</span><span>ranked by habit</span></div>
        {unread.map((c) => <ChatRow key={c.id} c={c} smart showTag={showTag} />)}
        <div className="gh"><span>Read · {read.length}</span></div>
        {read.map((c) => <ChatRow key={c.id} c={c} smart showTag={showTag} />)}
      </>
    );
  } else {
    body = [...visible].sort((a, b) => a.r - b.r).map((c) => <ChatRow key={c.id} c={c} />);
  }

  return (
    <aside className="list">
      <div className="list-h">
        <b>Chats</b>
        <span className="seg">
          <button type="button" className={cx(smart && 'on')} onClick={() => setSort('smart')}>Smart</button>
          <button type="button" className={cx(!smart && 'on')} onClick={() => setSort('recent')}>Recent</button>
        </span>
      </div>
      <input className="search" placeholder="⌕  Search or start a new chat" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {CATS.map((c) => (
          <button type="button" key={c.id} className={cx('chip', cat === c.id && 'on')} onClick={() => setCat(c.id)}>
            {c.label} <span className="n">{unreadIn(c.id)}</span>
          </button>
        ))}
      </div>
      <div className="clist">
        {body}
        {visible.length === 0 && <div className="empty note">No chats match “{q}”.</div>}
      </div>
      <div className="foot">
        {smart
          ? 'Smart order: unread first, then by your habit score (0–100). Computed on this device. No AI.'
          : 'Recent order: newest message first. Notice the unknown number and promo jump to the top.'}
      </div>
    </aside>
  );
}

export function ChatsHome() {
  const { openChat } = useApp();
  return (
    <main className="main">
      <div className="pad">
        <div className="h2">Why your chats are in this order</div>
        <div className="note" style={{ marginBottom: 14 }}>Feature 1 · behaviour-based ranking · last 14 days · no LLM</div>
        <div className="grid2" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
          <div className="card">
            <table className="sc">
              <thead>
                <tr><th>#</th><th>Contact</th><th>Avg read delay</th><th>Avg time / day</th><th>Score</th></tr>
              </thead>
              <tbody>
                {RANKING.map(([n, name, delay, time, score, bold]) => (
                  <tr key={n}>
                    <td>{n}</td>
                    <td>{bold ? <b>{name}</b> : name}</td>
                    <td className="num">{delay}</td>
                    <td className="num">{time}</td>
                    <td className="num">{bold ? <b>{score}</b> : score}</td>
                  </tr>
                ))}
                <tr style={{ color: '#888' }}>
                  <td>…</td><td>ShopDeals</td><td className="num">9 h</td><td className="num">0 min</td><td className="num">01</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <b style={{ fontSize: 13.5 }}>How the score works</b>
              <div className="formula" style={{ marginTop: 8 }}>
                read_delay = read_at − delivered_at<br />
                read_speed = 1 ÷ (1 + avg_delay_min ÷ 10)<br />
                time_score = min(avg_min_per_day ÷ 22, 1)<br />
                score = 100 × (0.5·read_speed + 0.5·time_score)
              </div>
              <div className="note" style={{ marginTop: 8 }}>22 min = your most-used chat. New contacts show “—” until 5 messages are tracked.</div>
            </div>
            <div className="card">
              <b style={{ fontSize: 13.5 }}>Example: Priya</b>
              <div className="note" style={{ marginTop: 6, color: '#333' }}>
                read_speed = 1 ÷ (1 + 0.2) = 0.83<br />
                time_score = 20 ÷ 22 = 0.91<br />
                score = 100 × (0.415 + 0.455) = <b>87</b>
              </div>
            </div>
            <Btn kind="pri" onClick={() => openChat('priya')}>Open Priya’s chat →</Btn>
          </div>
        </div>
      </div>
    </main>
  );
}
