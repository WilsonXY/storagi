import path from 'node:path';
export type Config = {origin:string; clientId:string; clientSecret:string; ownerSub:string; dataDir:string; budgetBytes:number; diskReserveBytes:number; port:number};
export function loadConfig(env: Record<string,string|undefined>): Config {
  const required = (key:string) => { const value = env[key]?.trim(); if (!value) throw new Error(`Missing ${key}`); return value; };
  const origin = new URL(required('PUBLIC_ORIGIN'));
  if (origin.protocol !== 'https:' || origin.origin !== env.PUBLIC_ORIGIN || origin.username || origin.password) throw new Error('PUBLIC_ORIGIN must be an HTTPS origin without a path');
  const dataDir = required('DATA_DIR');
  if (!path.isAbsolute(dataDir)) throw new Error('DATA_DIR must be absolute');
  const number = (key:string, fallback:number, min:number) => { const value = env[key] === undefined ? fallback : Number(env[key]); if (!Number.isSafeInteger(value) || value < min || env[key] === '') throw new Error(`Invalid ${key}`); return value; };
  const ownerSub = required('OWNER_GOOGLE_SUB');
  if (!/^[0-9]{1,255}$/.test(ownerSub)) throw new Error('OWNER_GOOGLE_SUB must be the configured Google subject');
  const port = number('PORT',8787,1);
  if (port>65535) throw new Error('Invalid PORT');
  return {origin:origin.origin,clientId:required('GOOGLE_CLIENT_ID'),clientSecret:required('GOOGLE_CLIENT_SECRET'),ownerSub,dataDir,budgetBytes:number('BUDGET_BYTES',200*1024**3,1),diskReserveBytes:number('DISK_RESERVE_BYTES',1024**3,1),port};
}
