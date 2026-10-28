import Database from "better-sqlite3";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  companyInputSchema,
  editSchema,
  runSchema,
  type CompanyInput,
  type RunInput,
} from "../domain/validation";
import type {
  Company,
  Run,
  Job,
  ContactStatus,
  Usage,
  UsageRecord,
} from "../domain/types";
export class Store {
  readonly db: Database.Database;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, data TEXT NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS run_companies(run_id TEXT NOT NULL REFERENCES runs(id), company_id TEXT NOT NULL REFERENCES companies(id), PRIMARY KEY(run_id,company_id));
   CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, runId TEXT NOT NULL REFERENCES runs(id), kind TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, leaseUntil INTEGER, leaseOwner TEXT, availableAt INTEGER NOT NULL, error TEXT, createdAt TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS jobs_pending ON jobs(status, availableAt);
   CREATE TABLE IF NOT EXISTS usage(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), data TEXT NOT NULL);`);
  }
  upsertCompany(input: CompanyInput): Company {
    const v = companyInputSchema.parse(input);
    const normalize = (s: string) =>
      s.toLocaleLowerCase("ru").normalize("NFKC").replace(/\s+/g, " ").trim();
    const identity =
      v.sourceId ||
      createHash("sha256")
        .update(normalize(v.name) + "|" + normalize(v.address))
        .digest("hex");
    return this.db.transaction(() => {
      const row = this.db
        .prepare("SELECT data FROM companies WHERE identity=?")
        .get(identity) as { data: string } | undefined;
      if (row) return JSON.parse(row.data) as Company;
      const now = new Date().toISOString();
      const c: Company = {
        ...v,
        id: randomUUID(),
        version: 1,
        contactStatus: "new",
        draftMessage: "",
        websiteStatus: v.website ? "found" : "unknown",
        createdAt: now,
        updatedAt: now,
      };
      this.db
        .prepare("INSERT INTO companies VALUES(?,?,?)")
        .run(c.id, identity, JSON.stringify(c));
      return c;
    })();
  }
  getCompany(id: string): Company | null {
    const r = this.db
      .prepare("SELECT data FROM companies WHERE id=?")
      .get(id) as { data: string } | undefined;
    return r ? JSON.parse(r.data) : null;
  }
  listCompanies(runId?: string): Company[] {
    const rows = (
      runId
        ? this.db
            .prepare(
              "SELECT c.data FROM companies c JOIN run_companies r ON c.id=r.company_id WHERE r.run_id=? ORDER BY c.rowid DESC",
            )
            .all(runId)
        : this.db
            .prepare("SELECT data FROM companies ORDER BY rowid DESC")
            .all()
    ) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }
  updateCompany(
    id: string,
    patch: { draftMessage?: string; contactStatus?: ContactStatus },
    version: number,
  ): Company {
    const v = editSchema.parse({ ...patch, version });
    const { version: _, ...fields } = v;
    return this.changeCompany(id, fields, version);
  }
  changeCompany(
    id: string,
    patch: Partial<
      Pick<
        Company,
        | "analysis"
        | "draftMessage"
        | "contactStatus"
        | "image"
        | "websiteStatus"
        | "website"
        | "websiteCheckedAt"
        | "websiteExplanation"
        | "sources"
      >
    >,
    version?: number,
  ): Company {
    return this.db.transaction(() => {
      const c = this.getCompany(id);
      if (!c) throw new Error("NOT_FOUND");
      if (version !== undefined && c.version !== version)
        throw new Error("VERSION_CONFLICT");
      const next = {
        ...c,
        ...patch,
        version: c.version + 1,
        updatedAt: new Date().toISOString(),
      };
      this.db
        .prepare("UPDATE companies SET data=? WHERE id=?")
        .run(JSON.stringify(next), id);
      return next;
    })();
  }
  createRun(input: RunInput): Run {
    const v = runSchema.parse(input);
    const r = {
      ...v,
      id: randomUUID(),
      cancelled: false,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare("INSERT INTO runs(id,data) VALUES(?,?)")
      .run(r.id, JSON.stringify(r));
    return { ...r, jobs: [] };
  }
  getRun(id: string): Run | null {
    const r = this.db
      .prepare("SELECT data,cancelled FROM runs WHERE id=?")
      .get(id) as { data: string; cancelled: number } | undefined;
    if (!r) return null;
    const jobs = this.db
      .prepare("SELECT * FROM jobs WHERE runId=? ORDER BY rowid")
      .all(id) as (Omit<Job, "payload"> & { payload: string })[];
    return {
      ...JSON.parse(r.data),
      cancelled: !!r.cancelled,
      jobs: jobs.map((j) => ({ ...j, payload: JSON.parse(j.payload) })),
    };
  }
  listRuns(): Run[] {
    return (
      this.db
        .prepare("SELECT id FROM runs ORDER BY rowid DESC LIMIT 100")
        .all() as { id: string }[]
    ).map((r) => this.getRun(r.id)!);
  }
  linkCompany(runId: string, companyId: string) {
    this.db
      .prepare("INSERT OR IGNORE INTO run_companies VALUES(?,?)")
      .run(runId, companyId);
  }
  addUsage(runId: string, v: UsageRecord): Usage {
    const u = {
      ...v,
      id: randomUUID(),
      runId,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare("INSERT INTO usage VALUES(?,?,?)")
      .run(u.id, runId, JSON.stringify(u));
    return u;
  }
  updateUsage(id: string, v: UsageRecord) {
    const row = this.db.prepare("SELECT data FROM usage WHERE id=?").get(id) as
      | { data: string }
      | undefined;
    if (row) {
      const old = JSON.parse(row.data);
      this.db
        .prepare("UPDATE usage SET data=? WHERE id=?")
        .run(JSON.stringify({ ...old, ...v }), id);
    }
  }
  getUsage(runId?: string): Usage[] {
    const rows = (
      runId
        ? this.db.prepare("SELECT data FROM usage WHERE run_id=?").all(runId)
        : this.db.prepare("SELECT data FROM usage").all()
    ) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }
  close() {
    this.db.close();
  }
}
export function createStore(path: string) {
  return new Store(path);
}
let instance: Store | undefined;
export function getStore() {
  return (instance ??= createStore(
    process.env.DATABASE_PATH || "data/agent.sqlite",
  ));
}
