import { useState } from 'react';
import { useApp } from '../AppContext';
import { useTasks } from '../TaskStore';
import { Btn, Modal } from '../components/common';
import TaskForm from '../components/TaskForm';
import { draftIso, whenLabel } from '../paFormat';

// "✦ Task found" banners for one chat. Suggestions come from the LLM only when the user taps "Find tasks";
// each one is saved only after the user reviews it.
export default function ChatTasks({ state, onClose, quietWhenEmpty = false }) {
  const { create, dismissSuggestion } = useTasks();
  // Suggestions found automatically have an id; resolving them removes them on the server too.
  const resolve = (s) => s.id && dismissSuggestion(s.draft.conversation_id, s.id).catch(() => {});
  const { go, setRemSel } = useApp();
  const [editing, setEditing] = useState(null);
  const [added, setAdded] = useState({}); // index -> task
  const [hidden, setHidden] = useState({});

  if (state.loading) return <div className="banner" style={{ padding: '7px 12px' }}><span className="tag">✦</span>Looking for tasks in recent messages…</div>;
  if (state.error) {
    return (
      <div className="banner" style={{ padding: '7px 12px' }}>
        <span style={{ flex: 1 }} className="err">{state.error}</span><Btn kind="ghost" onClick={onClose}>✕</Btn>
      </div>
    );
  }
  const list = state.items.map((s, i) => ({ ...s, i })).filter((s) => !hidden[s.i]);
  if (!list.length) {
    if (quietWhenEmpty) return null;
    return (
      <div className="banner" style={{ padding: '7px 12px' }}>
        <span style={{ flex: 1 }}>
          ✦ No follow-ups found in the last {state.scanned || 'few'} messages. You can still add one in the Assistant.
        </span>
        <Btn kind="ghost" onClick={onClose}>✕</Btn>
      </div>
    );
  }

  return (
    <>
      {list.map((s) => {
        const t = added[s.i];
        return (
          <div key={s.i} className="banner" style={{ padding: '7px 12px' }}>
            <span className="tag">✦ Task found</span>
            <span style={{ flex: 1 }}>
              {s.chat_name && <span className="src">{s.chat_name} · </span>}
              {s.draft.title}
              {s.draft.due_date && <> · <b>{whenLabel(draftIso(s.draft.due_date, s.draft.due_time))}</b></>}
              {s.quote && <span className="src"> · “{s.quote}”</span>}
            </span>
            {t ? (
              <>
                <span className="tag solid">✓ Added{t.reminder ? ` · reminder ${whenLabel(t.reminder.fire_at)}` : ''}</span>
                <Btn onClick={() => { setRemSel(t.id); go('rem'); }}>View reminder</Btn>
              </>
            ) : (
              <>
                <Btn onClick={() => setEditing(s)}>+ Add task &amp; reminder</Btn>
                <Btn kind="ghost" onClick={() => { setHidden((h) => ({ ...h, [s.i]: true })); resolve(s); }}>Ignore</Btn>
              </>
            )}
          </div>
        );
      })}
      {editing && (
        <Modal width={520}>
          <div className="mh"><span className="ai">Add task from chat</span></div>
          <div className="mb">
            {editing.quote && <div className="card" style={{ background: '#f6f6f6', padding: '9px 12px', marginBottom: 12, fontSize: 13 }}>“{editing.quote}”</div>}
            <TaskForm
              initial={editing.draft}
              warnings={editing.assumed}
              onCancel={() => setEditing(null)}
              onSave={async (body) => {
                const t = await create({
                  ...body,
                  source: 'chat',
                  source_text: editing.quote,
                  conversation_id: editing.draft.conversation_id,
                });
                setAdded((a) => ({ ...a, [editing.i]: t }));
                resolve(editing);
                setEditing(null);
              }}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
