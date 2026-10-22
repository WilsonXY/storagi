// IEC units and labels from the approved prototype; dates always use the browser's zone.
export type DateValue = Date | string | number;
const DAY = 86_400_000;
export function bytes(value: number, digits = 1) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const unit = Math.max(0, Math.min(4, Math.floor(Math.log(value) / Math.log(1024))));
  return `${(value / 1024 ** unit).toFixed(unit ? digits : 0)} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][unit]}`;
}
export const rate = (value: number) => value > 0 ? `${bytes(value)}/s` : '—';
export function duration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.ceil(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m`;
}
export const clock = (date: DateValue) => new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const finishAt = (seconds: number, now = Date.now) => Number.isFinite(seconds) && seconds >= 0 ? clock(now() + seconds * 1000) : '—';
// Compare calendar dates, rather than elapsed 24-hour periods (DST days vary in length).
export function localDay(value: DateValue) {
  const d = new Date(value);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
}
export function relDay(value: DateValue, now: DateValue = Date.now()) {
  const days = localDay(now) - localDay(value), date = new Date(value);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return days > 1 && days < 7 ? date.toLocaleDateString('en-GB', { weekday: 'long' }) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export const daysLeft = (file: { expiresAt: DateValue }, now: DateValue = Date.now()) => Math.max(0, Math.floor((+new Date(file.expiresAt) - +new Date(now)) / DAY));
export const ext = (name: string) => name.includes('.') ? name.split('.').pop()!.slice(0, 4).toLowerCase() : 'file';
export const shortId = (id: string) => id.slice(-6);
