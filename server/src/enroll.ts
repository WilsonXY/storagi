import http from 'node:http';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import * as oidc from 'openid-client';
import {googleConfig,verifyIdentity} from './auth.js';

// Standalone local tool: it prints a verified subject; it never edits owner config.
export async function startEnrollment(config:oidc.Configuration,port=8989) {
 const state=oidc.randomState(),nonce=oidc.randomNonce(),verifier=oidc.randomPKCECodeVerifier();
 let resolve!:(sub:string)=>void,reject!:(error:Error)=>void,consumed=false;
 const done=new Promise<string>((yes,no)=>{resolve=yes;reject=no;});void done.catch(()=>{});
 const server=http.createServer((req,res)=>{
   if(req.method!=='GET'||req.url?.split('?')[0]!=='/callback'){res.writeHead(404);res.end();return;}
   if(req.headers.host!==new URL(callback).host||consumed){res.writeHead(400);res.end('Enrollment unavailable');return;}
   consumed=true;
   void verifyIdentity(config,new URL(req.url,callback),{state,nonce,verifier}).then(sub=>{
     res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end('Identity verified. Return to the terminal.');resolve(sub);
   },()=>{res.writeHead(400,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('Verification failed. Restart enrollment.');reject(new Error('Enrollment verification failed'));});
 });
 server.listen(port,'127.0.0.1');await once(server,'listening');
 const callback=`http://127.0.0.1:${(server.address() as {port:number}).port}/callback`;
 // Only this loopback CLI permits an HTTP callback. Google endpoints remain HTTPS.
 oidc.allowInsecureRequests(config);
 const url=oidc.buildAuthorizationUrl(config,{redirect_uri:callback,scope:'openid',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',prompt:'select_account'}).href;
 const timer=setTimeout(()=>{consumed=true;reject(new Error('Enrollment timed out'));void close();},10*60000);timer.unref();
 async function close(){clearTimeout(timer);if(server.listening)await new Promise<void>((yes,no)=>server.close(error=>error?no(error):yes()));}
 return {url,done,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 let enrollment:Awaited<ReturnType<typeof startEnrollment>>|undefined;
 try{
   const id=process.env.GOOGLE_CLIENT_ID?.trim(),secret=process.env.GOOGLE_CLIENT_SECRET?.trim();
   if(!id||!secret)throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
   enrollment=await startEnrollment(await googleConfig(id,secret));
   console.log('Open this URL in a browser on this machine (registered callback: http://127.0.0.1:8989/callback):\n'+enrollment.url);
   const sub=await enrollment.done;
   console.log('Verified Google subject; explicitly copy into your private configuration:\nOWNER_GOOGLE_SUB='+sub);
 }catch{console.error('Enrollment failed. Check OAuth credentials, registered callback, and retry.');process.exitCode=1;}
 finally{await enrollment?.close();}
}
