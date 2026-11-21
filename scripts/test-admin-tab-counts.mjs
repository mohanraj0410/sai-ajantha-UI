import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import { ADMIN_DATASETS, buildAdminDatasetQuery } from "../apps/backend/src/lib/admin-tab-datasets.ts";

dotenv.config({ path: "apps/backend/.env", quiet: true });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const evidence = { capturedAt: new Date().toISOString(), checks: [], failures: [] };
const check = (name, fn) => { try { fn(); evidence.checks.push(name); } catch(e) { evidence.failures.push({ name, message: e.message }); } };
const sql = (text, values=[]) => { let i=0; return db.query(text.replaceAll('?', () => '$'+(++i)), values); };
const dataset = async (name, params={}) => { const q=buildAdminDatasetQuery(name,params); return (await sql(q.sql,q.bindings)).rows[0]; };
await db.connect();
try {
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  evidence.database = (await db.query('SELECT current_database() AS name')).rows[0].name;
  for (const [name, definition] of Object.entries(ADMIN_DATASETS)) {
    const all = await dataset(name);
    const real = Number((await db.query(`SELECT count(*) FROM (${definition.sql}) b`)).rows[0].count);
    check(`${name}: All equals scoped database rows`, () => assert.equal(all.counts.ALL,real));
    const unique = (await db.query(`SELECT count(DISTINCT id)::int AS total FROM (${definition.sql}) b`)).rows[0].total;
    check(`${name}: no duplicate entities from joins`, () => assert.equal(real,unique));
    for (const [tab, condition] of Object.entries(definition.tabs)) {
      const filtered = await dataset(name,{tab,pageSize:2});
      const count = Number((await db.query(`SELECT count(*) FROM (${definition.sql}) b WHERE (${condition})`)).rows[0].count);
      check(`${name}/${tab}: facet, backend predicate and matching total reconcile`, () => { assert.equal(filtered.total,count); assert.equal(filtered.counts[tab],count); assert.ok(filtered.ids.length <= 2); });
      const next = await dataset(name,{tab,pageSize:2,page:9999});
      check(`${name}/${tab}: pagination preserves counts and clamps page`, () => { assert.deepEqual(next.counts,filtered.counts); assert.equal(next.total,count); assert.ok(next.page <= Math.max(1,Math.ceil(count/2))); });
    }
    const empty = await dataset(name,{q:'__NO_MATCH_COUNT_AUDIT__'});
    check(`${name}: empty search yields successful zero`, () => { assert.equal(empty.total,0); assert.deepEqual(empty.ids,[]); assert.ok(Object.values(empty.counts).every(n=>n===0)); });
    const date = await dataset(name,{from:'2100-01-01'});
    check(`${name}: date filter scopes both counts and items`, () => assert.equal(date.total,0));
    check(`${name}: unsupported tab is rejected`, () => assert.throws(()=>buildAdminDatasetQuery(name,{tab:'__INVALID__'})));
  }
  const dealers = await dataset('partners',{role:'DEALER'});
  evidence.dealers = dealers.counts;
  check('dealers: exhaustive canonical approval groups',()=>assert.equal(dealers.counts.ALL,dealers.counts.APPROVED+dealers.counts.PENDING_APPROVAL+dealers.counts.REJECTED));
  const suspended = Number((await db.query("SELECT count(*) FROM customer c JOIN account_profile p ON p.customer_id=c.id WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL AND p.role='DEALER' AND p.status='SUSPENDED' AND COALESCE(p.dynamic_attributes->>'rejection_status','') <> 'REJECTED' AND COALESCE(p.dynamic_attributes->>'trade_application_status','') <> 'REJECTED'")).rows[0].count);
  evidence.suspendedDealers = suspended;
  await db.query('ROLLBACK');

  const base = process.env.ADMIN_COUNT_BACKEND_URL || 'http://localhost:9000';
  const request = (url,options={})=>fetch(base+url,{...options,signal:AbortSignal.timeout(15000)});
  const anonymous = await request('/admin/sai-ajanta/tab-data?dataset=partners');
  check('API: anonymous access denied',()=>assert.equal(anonymous.status,401));
  const login = await request('/auth/user/emailpass',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_COUNT_EMAIL || 'admin@sai-ajanta.com',password:process.env.ADMIN_COUNT_PASSWORD || 'Admin1234!'})});
  assert.equal(login.status,200,'Existing test administrator login');
  const {token}=await login.json();
  for(const [name,definition] of Object.entries(ADMIN_DATASETS)) {
    for(const tab of Object.keys(definition.tabs)) {
      const res=await request('/admin/sai-ajanta/tab-data?'+new URLSearchParams({dataset:name,tab,pageSize:'2'}),{headers:{Authorization:'Bearer '+token}});
      const body=await res.json();
      const expected=await dataset(name,{tab,pageSize:2});
      check(`API ${name}/${tab}: authenticated rows and counts`,()=>{assert.equal(res.status,200,JSON.stringify(body));assert.equal(body.total,body.counts[tab]);assert.equal(body.items.length,Math.min(2,body.total));assert.equal(new Set(body.items.map(i=>i.medusa_id||i.id)).size,body.items.length);assert.deepEqual(body.items.map(i=>i.medusa_id||i.id),expected.ids);assert.deepEqual(body.counts,expected.counts);});
    }
  }
  for(const [name,sorts] of Object.entries({products:['customer_price_inr','stock_qty'],orders:['total_inr']})) {
    for(const sort of sorts) for(const direction of ['ascend','descend']) {
      const res=await request('/admin/sai-ajanta/tab-data?'+new URLSearchParams({dataset:name,sort,direction,pageSize:'100'}),{headers:{Authorization:'Bearer '+token}});
      const body=await res.json();
      check(`API ${name}/${sort}/${direction}: global sort matches displayed values`,()=>{assert.equal(res.status,200,JSON.stringify(body));const values=body.items.map(i=>i[sort] || 0);for(let i=1;i<values.length;i++)assert.ok(direction==='ascend'?values[i]>=values[i-1]:values[i]<=values[i-1],`${values[i-1]} then ${values[i]}`);});
    }
  }
  for(const name of Object.keys(ADMIN_DATASETS)) {
    const params={dataset:name,q:"' OR 1=1 -- %_",pageSize:'2'};
    const res=await request('/admin/sai-ajanta/tab-data?'+new URLSearchParams(params),{headers:{Authorization:'Bearer '+token}});
    const body=await res.json();
    check(`API ${name}: search treats SQL/wildcard text literally`,()=>{assert.equal(res.status,200);assert.equal(body.total,0);assert.equal(body.counts.ALL,0);});
  }
  const audit=await request('/admin/sai-ajanta/audit-log?page=99999&pageSize=2',{headers:{Authorization:'Bearer '+token}});
  const auditBody=await audit.json();
  const auditTotal=Number((await db.query('SELECT count(*) FROM dms_staff_audit_event WHERE deleted_at IS NULL')).rows[0].count);
  check('Audit Log: authoritative total and last-page clamp',()=>{assert.equal(audit.status,200,JSON.stringify(auditBody));assert.equal(auditBody.total,auditTotal);assert.equal(auditBody.page,Math.max(1,Math.ceil(auditTotal/2)));});
} catch(e) { evidence.failures.push({name:'Execution',message:e.message}); }
finally { await db.end(); fs.writeFileSync('docs/admin-tab-count-test-evidence.json',JSON.stringify(evidence,null,2)+'\n'); }
console.log(JSON.stringify(evidence,null,2));
if(evidence.failures.length) process.exitCode=1;
