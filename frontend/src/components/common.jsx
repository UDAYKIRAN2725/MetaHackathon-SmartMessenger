import { useState } from 'react';
import { cx } from '../utils';

// Settings-style row with a switch. Controlled when `checked` is passed, otherwise uncontrolled.
export function ToggleRow({ title, desc, checked, defaultChecked, onChange, className, style, children }) {
  const ctl = checked !== undefined ? { checked, onChange: (e) => onChange?.(e.target.checked) } : { defaultChecked };
  return (
    <label className={cx('set', className)} style={style}>
      <span className="tx">
        <b>{title}</b>
        {children ?? <span>{desc}</span>}
      </span>
      <input type="checkbox" className="lc" {...ctl} />
      <span className="tog" />
    </label>
  );
}

// Single-select chip group. Pass `value`/`onChange` to control it, or `initial` for local state.
export function ChipSelect({ options, value, onChange, initial = 0, style }) {
  const [local, setLocal] = useState(options[initial]);
  const cur = value !== undefined ? value : local;
  const pick = (o) => (onChange ? onChange(o) : setLocal(o));
  return (
    <div className="chips" style={{ padding: 0, ...style }}>
      {options.map((o) => (
        <button type="button" key={o} className={cx('chip', cur === o && 'on')} onClick={() => pick(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Modal({ width, children, style }) {
  return (
    <div className="ov" style={style}>
      <div className="modal" style={width ? { width } : undefined}>
        {children}
      </div>
    </div>
  );
}

export const Btn = ({ kind, lg, block, className, ...p }) => (
  <button type="button" className={cx('btn', kind, lg && 'lg', block && 'block', className)} {...p} />
);
