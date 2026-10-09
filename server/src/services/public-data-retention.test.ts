import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createDb, startEmbeddedPostgresTestDatabase } from "@paperclipai/db";
import { sql } from "drizzle-orm";
import { it, expect } from "vitest";
import { retainPublicData } from "./public-data-retention.js";

it("dry-runs, protects contacts/accounts/holds, deletes copies, and reapplies deletion after restore", async () => {
  const pg = await startEmbeddedPostgresTestDatabase("sysdom-retention-test-");
  const db = createDb(pg.connectionString);
  const dir = await mkdtemp(path.join(tmpdir(), "retention-state-")), file = path.join(dir, "state.json");
  const now = new Date("2026-10-09T12:00:00Z"), ids = Array.from({ length: 7 }, () => randomUUID());
  try {
    const state = { version: 1, contacts: [{ id: ids[2], at: "2026-10-01T00:00:00Z" }], holds: [{ id: ids[3], until: "2026-11-01T00:00:00Z", owner: "test", reason: "fictional incident" }], deleted: [] };
    await writeFile(file, JSON.stringify(state));
    for (let i = 0; i < ids.length; i++) await db.execute(sql`INSERT INTO early_access_requests
      (id,request_key,founder_name,email,email_normalized,source,created_at,updated_at) VALUES
      (${ids[i]},${randomUUID()},'Fictional',${`case${i}@example.test`},${`case${i}@example.test`},${i === 5 ? "newsletter" : "product"},'2025-01-01','2026-10-09')`);
    await db.execute(sql`INSERT INTO "user" (id,name,email,created_at,updated_at) VALUES ('fictional','Fictional','case1@example.test',now(),now())`);
    const grant = randomUUID(), scan = randomUUID();
    await db.execute(sql`INSERT INTO early_access_grants (id,request_id,founder_name,email,email_normalized,token_hash,expires_at,created_at)
      VALUES (${grant},${ids[0]},'Fictional','case0@example.test','case0@example.test','fictional-hash','2025-03-01','2025-01-01'),
      (${randomUUID()},${ids[4]},'Fictional','case4@example.test','case4@example.test','active-hash','2027-03-01','2025-01-01')`);
    await db.execute(sql`INSERT INTO scanner_runs (id,access_request_id,algorithm_version,input_payload,result_payload,client_saved_at,expires_at)
      VALUES (${scan},${ids[0]},'fixture','{}','{}','2025-01-01','2027-01-01')`);
    await db.execute(sql`INSERT INTO early_access_requests (request_key,founder_name,email,email_normalized,created_at) VALUES
      (${randomUUID()},'Fictional','case6@example.test','case6@example.test','2026-10-01')`);
    await db.execute(sql`INSERT INTO public_funnel_events (event_key,visitor_id,session_id,event_name,path,created_at) VALUES
      (${randomUUID()},${randomUUID()},${randomUUID()},'venture_review_view','/venture-review','2026-01-01')`);
    const original = await readFile(file, "utf8");
    expect(await retainPublicData(db,file,false,now)).toEqual({ requests: 1, grants: 1, scans: 1, analytics: 1, apply: false });
    expect(await readFile(file,"utf8")).toBe(original);
    expect(await retainPublicData(db,file,true,now)).toEqual({ requests: 1, grants: 1, scans: 1, analytics: 1, apply: true });
    expect(await retainPublicData(db,file,true,now)).toMatchObject({ requests: 0, grants: 0, scans: 0, analytics: 0 });
    await db.execute(sql`INSERT INTO early_access_requests (id,request_key,founder_name,email,email_normalized,created_at) VALUES
      (${ids[0]},${randomUUID()},'Fictional','case0@example.test','case0@example.test','2026-10-08')`);
    expect(await retainPublicData(db,file,true,now)).toMatchObject({ requests: 1 });
    await writeFile(file, "{}");
    await expect(retainPublicData(db,file,true,now)).rejects.toThrow();
  } finally { await db.$client.end(); await pg.cleanup(); await rm(dir,{recursive:true,force:true}); }
}, 120000);
