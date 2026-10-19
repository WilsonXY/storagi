import {createApp} from './app.js';
import {loadConfig} from './config.js';

try {
 const config=loadConfig(process.env);
 process.umask(0o077);
 const app=await createApp(config);
 app.server.once('error',()=>{console.error('Server failed to listen');void app.close().finally(()=>{process.exitCode=1;});});
 app.server.listen(config.port,'127.0.0.1',()=>console.log(`Storagi listening on 127.0.0.1:${config.port}`));
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;void app.close().catch(()=>{console.error('Graceful shutdown failed');process.exitCode=1;});};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
} catch(error) {
 // Environment validation messages contain names, never configured secret values.
 console.error(error instanceof Error&&/^(Missing |Invalid |PUBLIC_ORIGIN |DATA_DIR |OWNER_GOOGLE_SUB )/.test(error.message)?error.message:'Startup failed; check configuration and storage permissions');process.exitCode=1;
}
