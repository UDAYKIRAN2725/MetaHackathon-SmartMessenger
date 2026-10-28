import { useApp } from '../AppContext';
import { useAuth } from '../AuthContext';

export default function Strip() {
  const { go, setNotesOpen } = useApp();
  const { user, logout } = useAuth();
  return (
    <div className="strip">
      <b>Smart Messenger · v2</b>
      <span style={{ color: '#aaa' }}>solid = real data · dashed ✦ = AI generated</span>
      <span className="sp" />
      <button type="button" onClick={() => setNotesOpen(true)}>Assumptions</button>
      <button type="button" onClick={() => go('chats')}>Chats</button>
      <button type="button" onClick={() => go('onb')}>↺ Restart</button>
      <span style={{ color: '#aaa' }}>{user.name}</span>
      <button type="button" onClick={logout}>Log out</button>
    </div>
  );
}
