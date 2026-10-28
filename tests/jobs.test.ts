import { describe,it,expect } from 'vitest';
import { createStore } from '../src/server/db';
import { Queue } from '../src/server/jobs';
const setup=()=>{const s=createStore(':memory:');const r=s.createRun({limit:1});return {s,r,q:new Queue(s)};};
describe('durable jobs',()=>{
 it('only one worker can claim a pending job',()=>{const {s,r,q}=setup();q.enqueueJob(r.id,'discover',{});const first=q.claimJob('a',100);expect(first?.leaseOwner).toBe('a');expect(q.claimJob('b',101)).toBeNull();s.close();});
 it('recovers an expired lease and fences out the old owner',()=>{const {s,r,q}=setup();q.enqueueJob(r.id,'discover',{});const old=q.claimJob('a',100)!;const next=q.claimJob('b',120101)!;expect(next.id).toBe(old.id);expect(next.attempts).toBe(2);expect(q.finishJob(old)).toBe(false);expect(q.finishJob(next)).toBe(true);s.close();});
 it('bounds attempts and never retries blocked provider access',()=>{const {s,r,q}=setup();q.enqueueJob(r.id,'discover',{});
  let j=q.claimJob('a',1)!;q.failJob(j,{message:'временно',retryable:true},1);expect(q.claimJob('a',5000)).toBeNull();j=q.claimJob('a',5001)!;q.failJob(j,{message:'временно',retryable:true},5001);j=q.claimJob('a',35001)!;q.failJob(j,{message:'временно',retryable:true},35001);expect(q.claimJob('a',999999)).toBeNull();expect(s.getRun(r.id)?.jobs[0].status).toBe('failed');
  q.enqueueJob(r.id,'image',{companyId:'c'});j=q.claimJob('a',1000000)!;q.failJob(j,{message:'Нужен ключ',blocked:true},1000000);expect(q.claimJob('a',2000000)).toBeNull();expect(s.getRun(r.id)?.jobs[1].status).toBe('blocked');s.close();
 });
 it('cancels running jobs and prevents more work in that run',()=>{const {s,r,q}=setup();q.enqueueJob(r.id,'discover',{});const j=q.claimJob('a',1)!;q.cancelRun(r.id);expect(q.finishJob(j)).toBe(false);expect(()=>q.enqueueJob(r.id,'analyze',{companyId:'x'})).toThrow('RUN_CANCELLED');expect(q.claimJob('b',999999)).toBeNull();s.close();});
 it('does not duplicate active image tasks',()=>{const {s,r,q}=setup();const a=q.enqueueJob(r.id,'image',{companyId:'c'});const b=q.enqueueJob(r.id,'image',{companyId:'c'});expect(a.id).toBe(b.id);s.close();});
 it('fails a repeatedly crashed job on its third expired lease',()=>{const {s,r,q}=setup();q.enqueueJob(r.id,'discover',{});q.claimJob('a',1);q.claimJob('b',120002);q.claimJob('c',240003);expect(q.claimJob('d',360004)).toBeNull();expect(s.getRun(r.id)?.jobs[0].status).toBe('failed');s.close();});
});
