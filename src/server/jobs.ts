import { randomUUID } from "node:crypto";
import type { Store } from "./db";
import type { Job, JobKind } from "../domain/types";
export type JobError = {
  message: string;
  blocked?: boolean;
  retryable?: boolean;
};
type Row = Omit<Job, "payload"> & { payload: string };
const decode = (r: Row): Job => ({ ...r, payload: JSON.parse(r.payload) });
export class Queue {
  constructor(readonly store: Store) {}
  enqueueJob(runId: string, kind: JobKind, payload: Job["payload"]): Job {
    return this.store.db.transaction(() => {
      const run = this.store.getRun(runId);
      if (!run) throw new Error("NOT_FOUND");
      if (run.cancelled) throw new Error("RUN_CANCELLED");
      const json = JSON.stringify(payload);
      const old = this.store.db
        .prepare(
          "SELECT * FROM jobs WHERE runId=? AND kind=? AND payload=? AND status IN ('pending','running')",
        )
        .get(runId, kind, json) as Row | undefined;
      if (old) return decode(old);
      const id = randomUUID();
      this.store.db
        .prepare(
          "INSERT INTO jobs(id,runId,kind,payload,status,availableAt,createdAt) VALUES(?,?,?,?,'pending',0,?)",
        )
        .run(id, runId, kind, json, new Date().toISOString());
      return this.getJob(id)!;
    })();
  }
  getJob(id: string): Job | null {
    const r = this.store.db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as
      | Row
      | undefined;
    return r ? decode(r) : null;
  }
  claimJob(owner: string, now = Date.now()): Job | null {
    return this.store.db.transaction(() => {
      this.store.db
        .prepare(
          "UPDATE jobs SET status='failed',error='Обработка прервалась три раза',leaseOwner=NULL,leaseUntil=NULL WHERE status='running' AND leaseUntil<=? AND attempts>=3",
        )
        .run(now);
      const row = this.store.db
        .prepare(
          `SELECT j.* FROM jobs j JOIN runs r ON r.id=j.runId WHERE r.cancelled=0 AND attempts<3 AND ((status='pending' AND availableAt<=?) OR (status='running' AND leaseUntil<=?)) ORDER BY j.rowid LIMIT 1`,
        )
        .get(now, now) as Row | undefined;
      if (!row) return null;
      this.store.db
        .prepare(
          "UPDATE jobs SET status='running',attempts=attempts+1,leaseUntil=?,leaseOwner=?,error=NULL WHERE id=?",
        )
        .run(now + 120000, owner, row.id);
      return this.getJob(row.id);
    })();
  }
  isActive(job: Job): boolean {
    const j = this.getJob(job.id);
    return (
      !!j &&
      j.status === "running" &&
      j.leaseOwner === job.leaseOwner &&
      j.attempts === job.attempts &&
      !this.store.getRun(j.runId)?.cancelled
    );
  }
  renew(job: Job, now = Date.now()): boolean {
    return (
      this.store.db
        .prepare(
          "UPDATE jobs SET leaseUntil=? WHERE id=? AND status='running' AND leaseOwner=? AND attempts=?",
        )
        .run(now + 120000, job.id, job.leaseOwner, job.attempts).changes === 1
    );
  }
  finishJob(job: Job, write?: () => void): boolean {
    return this.store.db.transaction(() => {
      if (!this.isActive(job)) return false;
      write?.();
      this.store.db
        .prepare(
          "UPDATE jobs SET status='completed',leaseOwner=NULL,leaseUntil=NULL WHERE id=?",
        )
        .run(job.id);
      return true;
    })();
  }
  failJob(job: Job, error: JobError, now = Date.now()): boolean {
    return this.store.db.transaction(() => {
      if (!this.isActive(job)) return false;
      const status = error.blocked
        ? "blocked"
        : error.retryable && job.attempts < 3
          ? "pending"
          : "failed";
      this.store.db
        .prepare(
          "UPDATE jobs SET status=?,error=?,availableAt=?,leaseOwner=NULL,leaseUntil=NULL WHERE id=?",
        )
        .run(
          status,
          error.message.slice(0, 500),
          now + (job.attempts === 1 ? 5000 : 30000),
          job.id,
        );
      return true;
    })();
  }
  cancelRun(id: string) {
    this.store.db.transaction(() => {
      if (!this.store.getRun(id)) throw new Error("NOT_FOUND");
      this.store.db.prepare("UPDATE runs SET cancelled=1 WHERE id=?").run(id);
      this.store.db
        .prepare(
          "UPDATE jobs SET status='cancelled',leaseOwner=NULL,leaseUntil=NULL WHERE runId=? AND status IN ('pending','running','blocked')",
        )
        .run(id);
    })();
  }
}
