// Owner preferences only. The OS reduced-motion setting is deliberately not consulted.
export type Motion = 'swim' | 'static';
export type Gestures = 'on' | 'off';
export function motionPref(): Motion { try { return localStorage.getItem('storagi.motion') === 'static' ? 'static' : 'swim'; } catch { return 'swim'; } }
export function setMotionPref(value: Motion) { try { localStorage.setItem('storagi.motion', value); } catch {} window.dispatchEvent(new Event('storagi:motion')); }
export const reduced = () => motionPref() === 'static';
export function onMotionChange(fn: () => void) { window.addEventListener('storagi:motion', fn); return () => window.removeEventListener('storagi:motion', fn); }
export function gesturePref(): Gestures { try { return localStorage.getItem('storagi.gestures') === 'off' ? 'off' : 'on'; } catch { return 'on'; } }
export function setGesturePref(value: Gestures) { try { localStorage.setItem('storagi.gestures', value); } catch {} }
