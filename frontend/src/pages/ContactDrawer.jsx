import { useApp } from '../AppContext';
import { Btn, ChipSelect, ToggleRow } from '../components/common';

const SPARK = [60, 85, 70, 95, 40, 15, 90];
const DAYS = ['W', 'T', 'F', 'S', 'S', 'M', 'T'];

export default function ContactDrawer() {
  const { setDrawer, aiAllowed, setAi, memory, go, setMemPerson, setMemTab, openModal } = useApp();
  const notes = memory.priya.notes;

  return (
    <aside className="drawer">
      <div className="dh">
        Contact info
        <button type="button" className="x" onClick={() => setDrawer(false)}>✕</button>
      </div>
      <div className="sec" style={{ textAlign: 'center' }}>
        <div className="av" style={{ width: 72, height: 72, margin: '0 auto 8px', fontSize: 22 }}>PS</div>
        <b>Priya Sharma</b>
        <div className="src">+91 90000 12345 · Project Manager</div>
      </div>
      <div className="sec">
        <h4>Category</h4>
        <ChipSelect options={['Friends', 'Professional', 'Family', 'Relatives']} initial={1} />
        <div className="note" style={{ marginTop: 6 }}>One category per contact. You can change it anytime.</div>
      </div>
      <div className="sec">
        <h4>Your behaviour · last 14 days · on device</h4>
        <div className="grid2" style={{ gap: 8, marginBottom: 10 }}>
          <div className="card" style={{ padding: '8px 10px' }}>
            <div className="src">Avg read delay</div><b style={{ fontSize: 18 }}>2 min</b><div className="src">read speed 0.83</div>
          </div>
          <div className="card" style={{ padding: '8px 10px' }}>
            <div className="src">Avg time / day</div><b style={{ fontSize: 18 }}>20 min</b><div className="src">time score 0.91</div>
          </div>
        </div>
        <div className="src" style={{ marginBottom: 4 }}>Minutes in this chat · last 7 days</div>
        <div className="spark">{SPARK.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        <div className="spark-l">{DAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}>
          <span style={{ flex: 1 }}>Priority score</span><span className="tag solid">87 · #1</span>
        </div>
        <div className="acts" style={{ marginTop: 8 }}><Btn kind="ghost">Reset behaviour data</Btn></div>
      </div>
      <ToggleRow
        className="sec"
        style={{ padding: '13px 18px' }}
        title="AI suggestions in this chat"
        desc="Reads this chat to suggest replies"
        checked={!!aiAllowed.priya}
        onChange={(v) => setAi('priya', v)}
      />
      <div className="sec">
        <h4>Memory about Priya · {notes.length}</h4>
        <div className="note" style={{ color: '#333' }}>
          {notes.map((n) => <div key={n.id}>• {n.text}</div>)}
        </div>
        <Btn style={{ marginTop: 8 }} onClick={() => { setMemTab('ppl'); setMemPerson('priya'); go('mem'); }}>Open in Memory →</Btn>
      </div>
      <div className="sec" style={{ border: 0 }}>
        <h4>Scheduled to Priya</h4>
        <div className="note">None</div>
        <Btn style={{ marginTop: 6 }} onClick={() => openModal('schnew')}>+ Schedule a message</Btn>
      </div>
    </aside>
  );
}
