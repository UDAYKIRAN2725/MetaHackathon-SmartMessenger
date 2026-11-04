import { useCallback, useEffect, useState } from 'react';
import { api, del, patch, post } from '../api';
import { useApp } from '../AppContext';
import { initials } from '../auth';
import { Btn, ChipSelect } from '../components/common';
import { catLabel } from '../format';
import { cx } from '../utils';

const TAGS = ['Role', 'Preference', 'Fact', 'Language', 'Date', 'Note'];
const TYPES = [['tone', 'Tone'], ['language', 'Language'], ['avoid', 'Avoid'], ['culture', 'Culture & occasions']];
const TARGETS = [['all', 'Everyone'], ['fr', 'Friends'], ['pro', 'Professional'], ['fam', 'Family'], ['rel', 'Relatives']];
const TARGET_LABEL = Object.fromEntries(TARGETS);

// Memory page: notes about contacts + "My rules". Stored encrypted on the server.
// Approved notes and matching rules are added to ✦ AI assist replies; suggested notes are not, until you save them.
export function MemoryPage() {
  const { memTab, setMemTab, memPerson, setMemPerson } = useApp();
  const [people, setPeople] = useState(null);
  const [rules, setRules] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const loadPeople = useCallback(() => api('/api/memory/people').then((d) => setPeople(d.items)).catch((e) => setErr(e.message)), []);
  const loadRules = useCallback(() => api('/api/memory/rules').then((d) => setRules(d.items)).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    loadPeople();
    loadRules();
  }, [loadPeople, loadRules]);

  const term = q.trim().toLowerCase();
  const sel = memPerson && people?.some((p) => p.contact_id === memPerson) ? memPerson : people?.[0]?.contact_id;

  return (
    <>
      <aside className="list">
        <div className="list-h"><b>Memory</b></div>
        <input className="search" placeholder="⌕  Search memory" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button type="button" className={cx('chip', memTab === 'ppl' && 'on')} onClick={() => setMemTab('ppl')}>People</button>
          <button type="button" className={cx('chip', memTab === 'rules' && 'on')} onClick={() => setMemTab('rules')}>
            My rules {rules && <span className="n">{rules.length}</span>}
          </button>
        </div>
        {err && <div className="alert" style={{ margin: '0 16px 10px' }}>{err}</div>}
        {memTab === 'ppl' ? (
          !people ? <div className="empty note">Loading…</div> : (
            <div>
              {people.filter((p) => !term || p.name.toLowerCase().includes(term)).map((p) => (
                <button type="button" key={p.contact_id} onClick={() => setMemPerson(p.contact_id)} className={cx('row click', sel === p.contact_id && 'sel')}>
                  <span className="av">{initials(p.name)}</span>
                  <span className="meta">
                    <span className="top"><span>{p.name}</span><span className="time">{p.notes} {p.notes === 1 ? 'note' : 'notes'}</span></span>
                    <span className="why">
                      <span className="tag">{catLabel(p.category)}</span>
                      {p.suggested > 0 && <span>+{p.suggested} suggested</span>}
                    </span>
                  </span>
                </button>
              ))}
              {people.length === 0 && <div className="empty note">Save a contact in a category to add notes.</div>}
            </div>
          )
        ) : (
          !rules ? <div className="empty note">Loading…</div> : (
            <div>
              {TYPES.map(([t, label]) => {
                const rows = rules.filter((r) => r.type === t && (!term || r.text.toLowerCase().includes(term)));
                if (!rows.length) return null;
                return (
                  <div key={t}>
                    <div className="gh">{label}</div>
                    {rows.map((r) => (
                      <div key={r.id} className="row">
                        <span className="meta">
                          <span className="top" style={{ fontWeight: 500 }}><span>{r.text}</span></span>
                          <span className="why">{r.applies.map((a) => <span key={a} className="tag">{TARGET_LABEL[a]}</span>)}</span>
                        </span>
                        <Btn kind="ghost" title="Delete rule" onClick={() => del(`/api/memory/rules/${r.id}`).then(loadRules).catch((e) => setErr(e.message))}>✕</Btn>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )
        )}
        <div className="foot">Only approved memory is used in ✦ AI assist replies. Stored encrypted; only you can see it.</div>
      </aside>
      <main className="main">
        <div className="memwrap">
          <div className="pad">
            {memTab === 'ppl'
              ? sel ? <PersonPane key={sel} id={sel} onChanged={loadPeople} /> : <div className="empty">No contacts yet.</div>
              : <RulesPane onAdded={loadRules} />}
          </div>
        </div>
      </main>
    </>
  );
}

function NoteCard({ n, onSaved, onDelete }) {
  const [text, setText] = useState(n.text);
  const [tag, setTag] = useState(n.tag);
  const [err, setErr] = useState('');
  const save = (body) => patch(`/api/memory/notes/${n.id}`, body).then(onSaved).then(() => setErr('')).catch((e) => setErr(e.message));
  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <select className="tag" style={{ border: '1px solid #999' }} value={tag} onChange={(e) => { setTag(e.target.value); save({ tag: e.target.value }); }}>
        {TAGS.map((t) => <option key={t}>{t}</option>)}
      </select>
      <div style={{ flex: 1 }}>
        <input
          className="plain"
          style={{ fontSize: 14 }}
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text.trim() && text.trim() !== n.text && save({ text })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <div className="src">{n.src}{err && <span className="err"> · {err}</span>}</div>
      </div>
      <Btn kind="ghost" title="Delete" onClick={onDelete}>{'🗑\uFE0E'}</Btn>
    </div>
  );
}

function PersonPane({ id, onChanged }) {
  const { openChat } = useApp();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [newText, setNewText] = useState('');
  const [newTag, setNewTag] = useState('Note');

  const load = useCallback(() => api(`/api/memory/people/${id}`).then(setP).catch((e) => setErr(e.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);
  const after = () => Promise.all([load(), onChanged()]);
  const run = async (fn) => {
    setErr('');
    try {
      await fn();
      await after();
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!p) return err ? <div className="alert">{err}</div> : <div className="note">Loading…</div>;
  const first = p.name.split(' ')[0];
  const approved = p.notes.filter((n) => n.status === 'approved');
  const suggested = p.notes.filter((n) => n.status === 'suggested');

  const suggest = async () => {
    setBusy(true);
    setErr('');
    setInfo('');
    try {
      const r = await post(`/api/memory/people/${id}/suggest`);
      setInfo(r.items.length ? `Found ${r.items.length} new ${r.items.length === 1 ? 'note' : 'notes'}. Review them below.` : 'Nothing new worth remembering in the recent messages.');
      await after();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const add = (e) => {
    e.preventDefault();
    if (!newText.trim()) return;
    run(async () => {
      await post(`/api/memory/people/${id}/notes`, { tag: newTag, text: newText });
      setNewText('');
    });
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: 680 }}>
        <div style={{ flex: 1 }}>
          <div className="h2">{p.name}</div>
          <div className="note" style={{ marginBottom: 14 }}>
            {catLabel(p.category)} · {p.ai_allowed
              ? `used when ✦ AI assist suggests replies to ${first}`
              : `AI assist is off for ${first}, so this memory isn’t used until you turn it on`}
          </div>
        </div>
        <button
          type="button"
          className="aib"
          disabled={busy || !p.ai_allowed || !p.conversation_id}
          title={!p.ai_allowed ? `Turn on AI assist for ${first} in Settings first` : !p.conversation_id ? 'No chat yet' : 'AI reads the last 20 messages and proposes notes'}
          onClick={suggest}
        >
          ✦ {busy ? 'Reading chat…' : 'Suggest from chat'}
        </button>
      </div>
      {!p.ai_allowed && <div className="note" style={{ marginBottom: 10 }}>✦ Suggest from chat needs AI assist on for {first} (Settings → AI assist per chat).</div>}
      {info && <div className="note" style={{ marginBottom: 10, color: '#333' }}>✦ {info}</div>}
      {err && <div className="alert" style={{ maxWidth: 680 }}>{err}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 }}>
        {suggested.map((n) => (
          <div key={n.id} className="card ai-card">
            <span className="ai">Suggested from chat</span>
            <div style={{ fontSize: 14, marginTop: 6 }}><span className="tag" style={{ marginRight: 6 }}>{n.tag}</span>{n.text}</div>
            <div className="src">{n.src} · not used until you save it</div>
            <div className="acts" style={{ marginTop: 8 }}>
              <Btn kind="pri" onClick={() => run(() => post(`/api/memory/notes/${n.id}/approve`))}>Save</Btn>
              <Btn kind="ghost" onClick={() => run(() => del(`/api/memory/notes/${n.id}`))}>Not now</Btn>
            </div>
          </div>
        ))}
        {approved.map((n) => (
          <NoteCard key={n.id} n={n} onSaved={after} onDelete={() => run(() => del(`/api/memory/notes/${n.id}`))} />
        ))}
        {approved.length === 0 && suggested.length === 0 && <div className="note">No notes about {first} yet.</div>}

        <form className="card" onSubmit={add} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="v" style={{ width: 130 }} value={newTag} onChange={(e) => setNewTag(e.target.value)}>
            {TAGS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input className="v" style={{ flex: 1 }} maxLength={300} placeholder={`Add a note about ${first}…`} value={newText} onChange={(e) => setNewText(e.target.value)} />
          <button type="submit" className="btn pri" disabled={!newText.trim()}>+ Add</button>
        </form>

        <div className="acts">
          {p.conversation_id && <Btn kind="ghost" onClick={() => openChat(p.conversation_id)}>Open chat →</Btn>}
          {p.notes.length > 0 && (
            <Btn kind="ghost" onClick={() => window.confirm(`Delete all notes about ${first}?`) && run(() => del(`/api/memory/people/${id}/notes`))}>
              Delete all for {first}
            </Btn>
          )}
        </div>
      </div>
    </>
  );
}

function RulesPane({ onAdded }) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState('Relatives');
  const [type, setType] = useState('Culture & occasions');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const code = (pairs, label) => pairs.find(([, l]) => l === label)[0];

  const save = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await post('/api/memory/rules', { text, type: code(TYPES, type), applies: [code(TARGETS, target)] });
      setText('');
      setErr('');
      await onAdded();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="h2">My rules</div>
      <div className="note" style={{ marginBottom: 14 }}>How you want to come across. Added to every ✦ AI assist reply for the matching contacts.</div>
      <form className="card" style={{ maxWidth: 640 }} onSubmit={save}>
        <b style={{ fontSize: 14 }}>Add a rule</b>
        <div className="field" style={{ marginTop: 10 }}>
          <span className="lb">Rule</span>
          <input className="v" maxLength={200} placeholder="e.g. Wish relatives on festivals in Telugu" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="field">
          <span className="lb">Applies to</span>
          <ChipSelect options={TARGETS.map(([, l]) => l)} value={target} onChange={setTarget} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <span className="lb">Type</span>
          <ChipSelect options={TYPES.map(([, l]) => l)} value={type} onChange={setType} />
        </div>
        {err && <div className="alert" style={{ marginTop: 10 }}>{err}</div>}
        <div className="acts" style={{ marginTop: 12 }}>
          <button type="submit" className="btn pri" disabled={busy || !text.trim()}>Save rule</button>
          <span className="note">Saved rules appear on the left, grouped by type.</span>
        </div>
      </form>
    </>
  );
}
