export const cx = (...c) => c.filter(Boolean).join(' ');

let seq = 0;
export const newId = (p) => `${p}-${Date.now()}-${seq++}`;
