import { useApp } from '../AppContext';
import { Btn, Modal } from './common';

const ITEMS = [
  ['Q1', <>Unread chats first, then read. The habit score orders each group. A <b>Recent</b> toggle shows the plain newest-first order.</>],
  ['Q2', 'Read speed and time spent weigh 50 / 50.'],
  ['Q3', 'One category per contact.'],
  ['Q4', 'Groups go into the same categories (Product Team → Professional).'],
  ['Q5', <>AI assist is optional. It opens only when you tap <b>✦ AI assist</b>. It first asks what you want to say, then suggests replies.</>],
  ['Q6', 'Tasks can repeat, and tasks with no date are allowed.'],
  ['Q7', 'If a voice task is unclear, the PA asks a follow-up question.'],
  ['Q8', '“My rules” covers ethics (avoid), etiquette (tone), and culture and language.'],
  ['Q9', 'The AI can draft a scheduled message. You approve it once.'],
  ['Q10', 'Recurring messages send the same text every time.'],
];

export default function Assumptions() {
  const { setNotesOpen } = useApp();
  const close = () => setNotesOpen(false);
  return (
    <Modal width={620} style={{ zIndex: 9 }}>
      <div className="mh">
        Assumptions used in this app
        <button type="button" onClick={close} style={{ marginLeft: 'auto', fontWeight: 400 }}>✕</button>
      </div>
      <div className="mb" style={{ fontSize: 13, lineHeight: 1.65 }}>
        {ITEMS.map(([q, t]) => (
          <div key={q}><b>{q}</b> {t}</div>
        ))}
      </div>
      <div className="mf"><Btn kind="pri" onClick={close}>Got it</Btn></div>
    </Modal>
  );
}
