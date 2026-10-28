import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { EMAIL_RE, normPhone } from '../auth';
import { Btn } from '../components/common';
import { cx } from '../utils';

function Input({ label, error, hint, right, ...p }) {
  return (
    <div className="field">
      <span className="lb" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {right}
      </span>
      <input className={cx('v', error && 'bad')} {...p} />
      {error ? <div className="err">{error}</div> : hint && <div className="src" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function PasswordInput({ show, onToggle, ...p }) {
  return (
    <Input
      {...p}
      type={show ? 'text' : 'password'}
      right={
        <button type="button" className="link" onClick={onToggle} tabIndex={-1}>
          {show ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];

function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const [f, setF] = useState({ identifier: '', password: '', remember: true });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.identifier.trim()) er.identifier = 'Enter your email or phone number.';
    if (!f.password) er.password = 'Enter your password.';
    setErrors(er);
    setFormError('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await login(f);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="h2">Welcome back</div>
      <p className="note" style={{ margin: '0 0 16px' }}>Log in to your chats, tasks and reminders.</p>
      {formError && <div className="alert">{formError}</div>}
      <Input
        label="Email or phone"
        autoComplete="username"
        autoFocus
        placeholder="you@example.com or +91 90000 12345"
        value={f.identifier}
        onChange={set('identifier')}
        error={errors.identifier}
      />
      <PasswordInput
        label="Password"
        autoComplete="current-password"
        value={f.password}
        onChange={set('password')}
        error={errors.password}
        show={show}
        onToggle={() => setShow((s) => !s)}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '-2px 0 14px', fontSize: 13 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" className="lc" checked={f.remember} onChange={set('remember')} />
          <span className="chk" />
          Remember me
        </label>
        <button type="button" className="link" onClick={() => setForgot((x) => !x)}>Forgot password?</button>
      </div>
      {forgot && (
        <div className="card" style={{ background: '#f6f6f6', fontSize: 12.5, marginBottom: 14 }}>
          Password reset needs the backend (email or SMS code). It isn’t available in this demo yet.
        </div>
      )}
      <button type="submit" className="btn pri lg block" disabled={busy}>{busy ? 'Logging in…' : 'Log in →'}</button>
      <div className="note" style={{ textAlign: 'center', marginTop: 14 }}>
        New to Smart Messenger? <button type="button" className="link" onClick={onSwitch}>Create an account</button>
      </div>
    </form>
  );
}

function RegisterForm({ onSwitch }) {
  const { register } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '', agree: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const st = strength(f.password);

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.name.trim().length < 2) er.name = 'Enter your full name.';
    if (!EMAIL_RE.test(f.email.trim())) er.email = 'Enter a valid email address.';
    const digits = normPhone(f.phone).length;
    if (digits < 10 || digits > 15) er.phone = 'Enter a valid phone number (10–15 digits).';
    if (f.password.length < 8) er.password = 'Use at least 8 characters.';
    else if (st < 2) er.password = 'Add upper and lower case letters, a number or a symbol.';
    if (f.confirm !== f.password) er.confirm = 'Passwords don’t match.';
    if (!f.agree) er.agree = 'Please accept to continue.';
    setErrors(er);
    setFormError('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await register(f);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="h2">Create your account</div>
      <p className="note" style={{ margin: '0 0 16px' }}>Takes a minute. You choose AI and privacy settings next.</p>
      {formError && <div className="alert">{formError}</div>}
      <Input label="Full name" autoComplete="name" autoFocus placeholder="Uday Kiran" value={f.name} onChange={set('name')} error={errors.name} />
      <div className="grid2" style={{ gap: 12 }}>
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={f.email} onChange={set('email')} error={errors.email} />
        <Input label="Phone" type="tel" autoComplete="tel" placeholder="+91 90000 12345" value={f.phone} onChange={set('phone')} error={errors.phone} />
      </div>
      <PasswordInput
        label="Password"
        autoComplete="new-password"
        value={f.password}
        onChange={set('password')}
        error={errors.password}
        show={show}
        onToggle={() => setShow((s) => !s)}
      />
      {f.password && !errors.password && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '-6px 0 13px' }}>
          <span className="bar-s"><i style={{ width: `${(st / 4) * 100}%` }} /></span>
          <span className="src" style={{ width: 60 }}>{STRENGTH[st]}</span>
        </div>
      )}
      <Input
        label="Confirm password"
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        value={f.confirm}
        onChange={set('confirm')}
        error={errors.confirm}
      />
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#444', lineHeight: 1.5 }}>
        <input type="checkbox" className="lc" checked={f.agree} onChange={set('agree')} />
        <span className="chk" style={{ marginTop: 1 }} />
        <span>I agree to the Terms and Privacy Policy. Reading-behaviour data stays on my device.</span>
      </label>
      {errors.agree && <div className="err">{errors.agree}</div>}
      <button type="submit" className="btn pri lg block" style={{ marginTop: 14 }} disabled={busy}>
        {busy ? 'Creating account…' : 'Create account →'}
      </button>
      <div className="note" style={{ textAlign: 'center', marginTop: 14 }}>
        Already have an account? <button type="button" className="link" onClick={onSwitch}>Log in</button>
      </div>
    </form>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  return (
    <div className="app">
      <div className="strip">
        <b>Smart Messenger · v2</b>
        <span style={{ color: '#aaa' }}>solid = real data · dashed ✦ = AI generated</span>
      </div>
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
              <div>✦ &nbsp;Reply suggestions you approve before sending</div>
              <div>◉ &nbsp;Personal assistant for tasks and reminders</div>
              <div>⛉ &nbsp;AI never sends on its own</div>
            </div>
          </div>
          <div className="card" style={{ width: 460, padding: 24 }}>
            <div className="seg" style={{ display: 'flex', marginBottom: 18, textAlign: 'center', fontSize: 13 }}>
              <button type="button" style={{ flex: 1, padding: 8 }} className={cx(mode === 'login' && 'on')} onClick={() => setMode('login')}>Log in</button>
              <button type="button" style={{ flex: 1, padding: 8 }} className={cx(mode === 'register' && 'on')} onClick={() => setMode('register')}>Register</button>
            </div>
            {mode === 'login' ? <LoginForm onSwitch={() => setMode('register')} /> : <RegisterForm onSwitch={() => setMode('login')} />}
          </div>
        </div>
      </section>
    </div>
  );
}
