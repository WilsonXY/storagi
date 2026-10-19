import {createHash,randomBytes} from 'node:crypto';
import * as oidc from 'openid-client';
import {Storage,HttpError,DAY} from './storage.js';
const random=()=>randomBytes(32).toString('base64url');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export type Session={csrf:string;expiresAt:number;sub:string};
export class Auth {
 constructor(readonly storage:Storage,readonly origin:string,readonly ownerSub:string,readonly config:oidc.Configuration) {oidc.enableNonRepudiationChecks(config);}
 async begin() {
   this.prune();
   const token=random(),state=oidc.randomState(),nonce=oidc.randomNonce(),verifier=oidc.randomPKCECodeVerifier();
   // Bound abandoned flows; a public visitor cannot grow the table indefinitely.
   this.storage.db.prepare('DELETE FROM flows WHERE hash IN (SELECT hash FROM flows ORDER BY expiresAt ASC LIMIT MAX(0,(SELECT COUNT(*) FROM flows)-99))').run();
   this.storage.db.prepare('INSERT INTO flows VALUES (?,?,?,?,?)').run(hash(token),state,nonce,verifier,this.storage.now()+10*60000);
   const url=oidc.buildAuthorizationUrl(this.config,{redirect_uri:this.origin+'/auth/callback',scope:'openid',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'});
   return {url:url.href,token};
 }
 async callback(token:string,url:URL) {
   const flow=this.storage.db.prepare('DELETE FROM flows WHERE hash=? RETURNING *').get(hash(token)) as {state:string;nonce:string;verifier:string;expiresAt:number}|undefined;
   if(!flow||flow.expiresAt<=this.storage.now()) throw new HttpError(401,'Login expired; try again');
   const sub=await verifyIdentity(this.config,url,flow);
   if(sub!==this.ownerSub) throw new HttpError(403,'Account is not authorized');
   const sessionToken=random(),csrf=random();
   this.storage.db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(hash(sessionToken),csrf,this.storage.now()+7*DAY,this.ownerSub);
   return {token:sessionToken,csrf};
 }
 session(token:string):Session|undefined {
   if(!/^[\w-]{43}$/.test(token)) return;
   return this.storage.db.prepare('SELECT csrf,expiresAt,sub FROM sessions WHERE hash=? AND expiresAt>? AND sub=?').get(hash(token),this.storage.now(),this.ownerSub) as Session|undefined;
 }
 revoke(token:string):void {this.storage.db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(token));}
 prune():void {const now=this.storage.now();this.storage.db.prepare('DELETE FROM sessions WHERE expiresAt<=? OR sub<>?').run(now,this.ownerSub);this.storage.db.prepare('DELETE FROM flows WHERE expiresAt<=?').run(now);}
}
export async function googleConfig(clientId:string,clientSecret:string) {
 return oidc.discovery(new URL('https://accounts.google.com'),clientId,{client_secret:clientSecret,id_token_signed_response_alg:'RS256'});
}

export async function verifyIdentity(config:oidc.Configuration,url:URL,flow:{state:string;nonce:string;verifier:string}):Promise<string> {
 oidc.enableNonRepudiationChecks(config);
 const tokens=await oidc.authorizationCodeGrant(config,url,{pkceCodeVerifier:flow.verifier,expectedState:flow.state,expectedNonce:flow.nonce,idTokenExpected:true});
 const sub=tokens.claims()?.sub;if(!sub)throw new HttpError(401,'Missing verified identity');return sub;
}
