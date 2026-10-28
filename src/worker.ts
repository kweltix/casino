import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { getStore } from './server/db';
import { Queue } from './server/jobs';
import { processJob } from './server/pipeline';
import { getProviders } from './providers/config';
const store=getStore();const queue=new Queue(store);const owner=randomUUID();let stopping=false;
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
console.log('AI Agent worker запущен');
try{while(!stopping){const job=queue.claimJob(owner);if(!job){await delay(500);continue;}
 const heartbeat=setInterval(()=>queue.renew(job),30000);
 try{await processJob(job,getProviders(),store);}finally{clearInterval(heartbeat);}
}}finally{store.close();console.log('AI Agent worker остановлен');}
