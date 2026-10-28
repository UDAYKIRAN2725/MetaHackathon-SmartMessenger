import { useApp } from '../AppContext';
import { useAuth } from '../AuthContext';
import { initials } from '../auth';
import { ALARM, SETTINGS_AI } from '../data';
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
  const { aiAllowed, setAi } = useApp();
  return (
    <main className="main">
      <div className="pad">
        <div className="h2" style={{ marginBottom: 14 }}>Privacy &amp; AI</div>
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <b style={{ fontSize: 14 }}>Behaviour ranking (Feature 1)</b>
              <ToggleRow defaultChecked title="Learn from my reading behaviour" desc="Tracks delivered time, read time, minutes per chat. On device only." />
              <div className="set"><div className="tx"><b>Window</b><span>Last 14 days</span></div><Btn kind="ghost">Change</Btn></div>
              <div className="set" style={{ border: 0 }}><div className="tx"><b>Reset all behaviour data</b><span>Rankings start fresh</span></div><Btn>Reset</Btn></div>
            </div>
            <div className="card">
              <b style={{ fontSize: 14 }}>Voice &amp; scheduling</b>
              <div className="set"><div className="tx"><b>Voice tasks</b><span>Speech → text → AI extracts task. Audio not stored.</span></div><span className="tag">On</span></div>
              <ToggleRow defaultChecked style={{ border: 0 }} title="Notify before scheduled sends" desc="Default for new schedules" />
            </div>
          </div>
          <div className="card">
            <b style={{ fontSize: 14 }}>AI suggestions per chat</b>
            <div className="note" style={{ margin: '4px 0' }}>Only chats turned on here are read by the AI.</div>
            {SETTINGS_AI.map((c) => (
              <ToggleRow key={c.id} title={c.name} desc={c.sub} checked={!!aiAllowed[c.id]} onChange={(v) => setAi(c.id, v)} />
            ))}
            <div className="set" style={{ border: 0 }}>
              <div className="tx"><b>External contacts</b><span>Always off until saved</span></div>
              <span className="tag solid">Off</span>
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              Sent to AI only when you tap ✦ AI assist: the context you type, contact memory, your rules, a short chat summary, the last ~10 messages. Never logged.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
