import { useState } from 'react';
import { useApp } from '../AppContext';
import { RULE_TARGETS, RULE_TYPES } from '../data';
import { Btn, ChipSelect } from '../components/common';
import { cx } from '../utils';

export function MemoryList() {
  const { memory, rules, memTab, setMemTab, memPerson, setMemPerson } = useApp();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();

  return (
    <aside className="list">
      <div className="list-h"><b>Memory</b><Btn kind="pri">+ Add</Btn></div>
      <input className="search" placeholder="⌕  Search memory" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button type="button" className={cx('chip', memTab === 'ppl' && 'on')} onClick={() => setMemTab('ppl')}>People</button>
        <button type="button" className={cx('chip', memTab === 'rules' && 'on')} onClick={() => setMemTab('rules')}>My rules</button>
      </div>

      {memTab === 'ppl' ? (
        <div>
          {Object.entries(memory)
            .filter(([, p]) => p.name.toLowerCase().includes(term) || p.notes.some((n) => n.text.toLowerCase().includes(term)))
            .map(([id, p]) => {
              const clickable = !p.listOnly;
              const Tag = clickable ? 'button' : 'div';
              return (
                <Tag
                  key={id}
                  {...(clickable ? { type: 'button', onClick: () => setMemPerson(id) } : {})}
                  className={cx('row', clickable && 'click', clickable && memPerson === id && 'sel')}
                >
                  <span className="av">{p.av}</span>
                  <span className="meta">
                    <span className="top"><span>{p.name}</span><span className="time">{p.notes.length} notes</span></span>
                    <span className="why"><span className="tag">{p.cat}</span>{p.suggested && '+1 suggested'}</span>
                  </span>
                </Tag>
              );
            })}
        </div>
      ) : (
        <div>
          {RULE_TYPES.map((type) => {
            const rows = rules.filter((r) => r.type === type && r.text.toLowerCase().includes(term));
            if (!rows.length) return null;
            return (
              <div key={type}>
                <div className="gh">{type}</div>
                {rows.map((r) => (
                  <div key={r.id} className="row">
                    <span className="meta">
                      <span className="top" style={{ fontWeight: 500 }}><span>{r.text}</span></span>
                      <span className="why">{r.applies.map((a) => <span key={a} className="tag">{a}</span>)}</span>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <div className="foot">Only approved memory is used in reply suggestions.</div>
    </aside>
  );
}

function PersonMemory({ id }) {
  const { memory, setMemory, aiAllowed, openChat } = useApp();
  const p = memory[id];
  const patch = (fn) => setMemory((m) => ({ ...m, [id]: fn(m[id]) }));
  const editNote = (nid, text) => patch((x) => ({ ...x, notes: x.notes.map((n) => (n.id === nid ? { ...n, text } : n)) }));
  const delNote = (nid) => patch((x) => ({ ...x, notes: x.notes.filter((n) => n.id !== nid) }));
  const nextId = () => Math.max(0, ...p.notes.map((n) => n.id)) + 1;

  const saveSuggested = () =>
    patch((x) => ({ ...x, suggested: null, notes: [...x.notes, { id: nextId(), tag: x.suggested.tag, text: x.suggested.text, src: 'Suggested from chat · approved today' }] }));
  const dismissSuggested = () => patch((x) => ({ ...x, suggested: null }));
  const addNote = () => patch((x) => ({ ...x, notes: [...x.notes, { id: nextId(), tag: 'Note', text: '', src: 'Added by you · just now' }] }));

  let subtitle = p.cat;
  if (id === 'priya') subtitle = 'Professional · used when suggesting replies to Priya';
  if (p.aiKey && !aiAllowed[p.aiKey]) subtitle = `${p.cat} · AI suggestions are off for this chat, so this memory is only used if you turn them on`;
  else if (p.aiKey) subtitle = `${p.cat} · used when suggesting replies to ${p.name}`;

  return (
    <>
      <div className="h2">{p.name}</div>
      <div className="note" style={{ marginBottom: 14 }}>{subtitle}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
        {p.suggested && (
          <div className="card ai-card">
            <span className="ai">Suggested from chat</span>
            <div style={{ fontSize: 14, marginTop: 6 }}>{p.suggested.text}</div>
            <div className="src">{p.suggested.src}</div>
            <div className="acts" style={{ marginTop: 8 }}>
              <Btn kind="pri" onClick={saveSuggested}>Save</Btn>
              <Btn kind="ghost" onClick={dismissSuggested}>Not now</Btn>
            </div>
          </div>
        )}
        {p.notes.map((n) => (
          <div key={n.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="tag">{n.tag}</span>
            <div style={{ flex: 1 }}>
              <input
                className="plain"
                style={{ fontSize: 14 }}
                value={n.text}
                placeholder="Write a note…"
                autoFocus={!n.text}
                onChange={(e) => editNote(n.id, e.target.value)}
              />
              {n.src && <div className="src">{n.src}</div>}
            </div>
            <Btn kind="ghost" title="Delete" onClick={() => delNote(n.id)}>{'🗑\uFE0E'}</Btn>
          </div>
        ))}
        {p.notes.length === 0 && <div className="note">No notes yet.</div>}
        {p.manage && (
          <div className="acts">
            <Btn onClick={addNote}>+ Add note about {p.name.split(' ')[0]}</Btn>
            {p.chat && <Btn kind="ghost" onClick={() => openChat(p.chat)}>Open chat →</Btn>}
            <Btn kind="ghost" onClick={() => patch((x) => ({ ...x, notes: [] }))}>Delete all for {p.name.split(' ')[0]}</Btn>
          </div>
        )}
      </div>
    </>
  );
}

function RulesPane() {
  const { setRules } = useApp();
  const [text, setText] = useState('');
  const [target, setTarget] = useState('Relatives');
  const [type, setType] = useState('Culture & occasions');

  const save = () => {
    if (!text.trim()) return;
    setRules((r) => [...r, { id: Date.now(), type, text: text.trim(), applies: [target] }]);
    setText('');
  };

  return (
    <>
      <div className="h2">My rules</div>
      <div className="note" style={{ marginBottom: 14 }}>How you want to come across. Applied to every reply suggestion for the matching contacts.</div>
      <div className="card" style={{ maxWidth: 640 }}>
        <b style={{ fontSize: 14 }}>Add a rule</b>
        <div className="field" style={{ marginTop: 10 }}>
          <span className="lb">Rule</span>
          <input className="v" placeholder="e.g. Wish relatives on festivals in Telugu" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="field">
          <span className="lb">Applies to</span>
          <ChipSelect options={RULE_TARGETS} value={target} onChange={setTarget} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <span className="lb">Type</span>
          <ChipSelect options={RULE_TYPES} value={type} onChange={setType} />
        </div>
        <div className="acts" style={{ marginTop: 12 }}>
          <Btn kind="pri" onClick={save} disabled={!text.trim()}>Save rule</Btn>
          <Btn>{'🎙\uFE0E'} Say it</Btn>
        </div>
      </div>
    </>
  );
}

export function MemoryMain() {
  const { memTab, memPerson } = useApp();
  return (
    <main className="main">
      <div className="memwrap">
        <div className="pad">{memTab === 'ppl' ? <PersonMemory key={memPerson} id={memPerson} /> : <RulesPane />}</div>
      </div>
    </main>
  );
}
