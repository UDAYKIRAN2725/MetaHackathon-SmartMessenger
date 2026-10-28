import { useApp } from '../AppContext';
import { Btn, ToggleRow } from '../components/common';

export default function Onboarding() {
  const { go } = useApp();
  return (
    <section className="pg-onb">
      <div className="onb">
        <div style={{ flex: 1 }}>
          <div className="logo">S</div>
          <h1 style={{ fontSize: 32, margin: '18px 0 8px' }}>Smart Messenger</h1>
          <p style={{ fontSize: 15, color: '#555', lineHeight: 1.6, margin: '0 0 20px' }}>
            A messenger that learns who matters to you, helps you reply, remembers what you promised, and keeps in touch on your
            behalf, only in the ways you allow.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 14 }}>
            <div>▣ &nbsp;Chats ranked by how <i>you</i> read and spend time</div>
            <div>▤ &nbsp;Contacts grouped: Friends, Professional, Family, Relatives, External</div>
            <div>✦ &nbsp;Reply suggestions from memory and a chat summary</div>
            <div>◉ &nbsp;Personal assistant: type or speak your tasks</div>
            <div>◷ &nbsp;Schedule one-time and recurring messages</div>
            <div>◈ &nbsp;Memory you can see, edit and delete</div>
          </div>
        </div>
        <div className="card" style={{ width: 440, padding: 22 }}>
          <b style={{ fontSize: 16 }}>Permissions</b>
          <p className="note" style={{ margin: '4px 0 6px' }}>Change these anytime in Settings.</p>
          <ToggleRow defaultChecked title="Learn from my reading behaviour" desc="Delivered vs read time and time spent per chat. Stays on this device. No message content." />
          <ToggleRow defaultChecked title="AI assist (optional)" desc="Opens only when you tap ✦ AI assist, in chats you allow." />
          <ToggleRow defaultChecked title="Microphone for voice tasks" desc="Speech is turned into text. Audio is not stored." />
          <ToggleRow defaultChecked={false} title="Suggest memories" desc="Nothing is saved without your OK." />
          <div className="set" style={{ border: 0 }}>
            <div className="tx"><b>AI never sends on its own</b><span>Only messages you write or approve are sent.</span></div>
            <span className="tag solid">Always</span>
          </div>
          <Btn kind="pri" lg block style={{ marginTop: 12 }} onClick={() => go('chats')}>Get Started →</Btn>
        </div>
      </div>
    </section>
  );
}
