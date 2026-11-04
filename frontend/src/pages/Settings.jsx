import { useEffect, useState } from 'react';
import { api, patch } from '../api';
import { useApp } from '../AppContext';
import { useAuth } from '../AuthContext';
import { initials } from '../auth';
import { useChats } from '../ChatStore';
import { ALARM } from '../data';
import { catLabel } from '../format';
import { Btn, ToggleRow } from '../components/common';

export function SettingsList() {
  const { go } = useApp();
  const { user, logout } = useAuth();
  const Link = ({ icon, label, to }) => (
    <button type="button" className="row click" onClick={() => go(to)}>
      <span style={{ width: 20 }}>{icon}</span>
      <span className="meta"><span className="top"><span>{label}</span><span className="time">→</span></span></span>
    </button>
  );
  return (
    <aside className="list">
      <div className="list-h"><b>Settings</b></div>
      <div className="row">
        <span className="av">{initials(user.name)}</span>
        <span className="meta">
          <span className="top"><span>{user.name}</span></span>
          <span className="why">{user.email} · +{user.phone}</span>
        </span>
      </div>
      <div className="row sel">
        <span style={{ width: 20 }}>⛉</span>
        <span className="meta"><span className="top"><span>Privacy &amp; AI</span></span></span>
      </div>
      <Link icon="◈" label="Memory" to="mem" />
      <Link icon={ALARM} label="Reminders" to="rem" />
      <Link icon="◷" label="Scheduled messages" to="sch" />
      <div className="row">
        <span style={{ width: 20 }}>◔</span>
        <span className="meta"><span className="top"><span>Notifications</span></span></span>
      </div>
      <button type="button" className="row click" onClick={() => go('onb')}>
        <span style={{ width: 20 }}>ⓘ</span>
        <span className="meta"><span className="top"><span>Show onboarding again</span></span></span>
      </button>
      <button type="button" className="row click" onClick={logout}>
        <span style={{ width: 20 }}>⎋</span>
        <span className="meta"><span className="top"><span>Log out</span></span></span>
      </button>
    </aside>
  );
}

export function SettingsMain() {
  const { items, updateContact } = useChats();
  const contacts = items.filter((i) => i.category !== 'ext');
  return (
    <main className="main">
      <div className="pad">
        <div className="h2" style={{ marginBottom: 14 }}>Privacy &amp; AI</div>
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <b style={{ fontSize: 14 }}>Behaviour ranking (Feature 1)</b>
              <ToggleRow defaultChecked title="Learn from my reading behaviour" desc="Tracks delivered time, read time and minutes per chat. Timestamps only, never message text." />
              <div className="set"><div className="tx"><b>Window</b><span>Last 14 days</span></div><Btn kind="ghost">Change</Btn></div>
              <div className="set" style={{ border: 0 }}><div className="tx"><b>Reset all behaviour data</b><span>Rankings start fresh</span></div><Btn>Reset</Btn></div>
            </div>
            <SmartPriorityCard />
            <div className="card">
              <b style={{ fontSize: 14 }}>Voice &amp; scheduling</b>
              <div className="set"><div className="tx"><b>Voice tasks</b><span>Speech → text → AI extracts task. Audio not stored.</span></div><span className="tag">On</span></div>
              <ToggleRow defaultChecked style={{ border: 0 }} title="Notify before scheduled sends" desc="Default for new schedules" />
            </div>
          </div>
          <div className="card">
            <b style={{ fontSize: 14 }}>AI assist per chat</b>
            <div className="note" style={{ margin: '4px 0' }}>Lets ✦ AI assist and ✦ Find tasks read a chat, only when you tap them.</div>
            {contacts.map((c) => (
              <ToggleRow
                key={c.id}
                title={c.partner.name}
                desc={catLabel(c.category)}
                checked={c.ai_allowed}
                onChange={(v) => updateContact(c.partner.id, { ai_allowed: v }).catch(() => {})}
              />
            ))}
            {contacts.length === 0 && <div className="note" style={{ padding: '10px 0' }}>No saved contacts yet.</div>}
            <div className="set" style={{ border: 0 }}>
              <div className="tx"><b>External contacts</b><span>Always off until saved</span></div>
              <span className="tag solid">Off</span>
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              Sent to AI only when you tap ✦ AI assist or ✦ Find tasks: the goal and context you type and the last 10–15 messages of that chat. Never logged.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Smart priority with AI: master switch + the contacts whose unread messages the AI may read automatically.
function SmartPriorityCard() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/settings/ai-rank').then(setS).catch((e) => setErr(e.message));
  }, []);

  const run = async (fn) => {
    setBusy(true);
    try {
      setS(await fn());
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const setEnabled = (enabled) => run(() => patch('/api/settings/ai-rank', { enabled }));
  const setContacts = (ids, allowed) => run(() => patch('/api/settings/ai-rank/contacts', { contact_ids: ids, allowed }));

  if (!s) return <div className="card"><b style={{ fontSize: 14 }}>Smart priority with AI</b>{err ? <div className="err">{err}</div> : <div className="note">Loading…</div>}</div>;
  const saved = s.contacts.filter((c) => c.category !== 'ext');
  const picked = saved.filter((c) => c.allowed).length;

  return (
    <div className="card">
      <b style={{ fontSize: 14 }}>Smart priority with AI</b>
      <ToggleRow
        title="Rank unread chats with AI"
        desc="Reads new unread messages from the contacts you pick below, to rank them and spot tasks. Messages from other contacts are never sent to the AI."
        checked={s.enabled}
        onChange={(v) => !busy && setEnabled(v)}
      />
      {s.enabled && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 2px' }}>
            <span className="lb" style={{ flex: 1, margin: 0 }}>Contacts allowed · {picked} of {saved.length}</span>
            <Btn kind="ghost" disabled={busy} onClick={() => setContacts(saved.map((c) => c.contact_id), true)}>Select all</Btn>
            <Btn kind="ghost" disabled={busy} onClick={() => setContacts(saved.map((c) => c.contact_id), false)}>Clear</Btn>
          </div>
          {saved.map((c) => (
            <label key={c.contact_id} className="set" style={{ padding: '8px 0' }}>
              <input type="checkbox" className="lc" checked={c.allowed} disabled={busy} onChange={(e) => setContacts([c.contact_id], e.target.checked)} />
              <span className="chk" />
              <span className="tx"><b>{c.name}</b><span>{catLabel(c.category)}</span></span>
            </label>
          ))}
          {saved.length === 0 && <div className="note" style={{ padding: '8px 0' }}>No saved contacts yet.</div>}
          <div className="set" style={{ border: 0 }}>
            <div className="tx"><b>External contacts</b><span>Never sent to the AI</span></div>
            <span className="tag solid">Off</span>
          </div>
        </>
      )}
      {err && <div className="err">{err}</div>}
      <div className="note" style={{ marginTop: 6 }}>
        Final score = habit + 0.4 × (AI urgency − habit), only while a chat is unread. Other chats keep their habit score.
        Turning this off, or unticking a contact, deletes the stored AI results. The other person sees that AI priority is on.
      </div>
    </div>
  );
}
