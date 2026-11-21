import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";
import { queryGraphAll } from "../apps/backend/src/lib/admin-query-all.ts";

dotenv.config({path:'apps/backend/.env',quiet:true});
process.env.ALLOW_DISPOSABLE_DB_WRITES='true';
assertDisposableDbTarget(process.env.DATABASE_URL);
const base=process.env.ADMIN_COUNT_BACKEND_URL || 'http://localhost:9000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
const evidence={capturedAt:new Date().toISOString(),checks:[],fixtures:[],failures:[]};
let token;
async function api(path,body){const res=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const data=await res.json();assert.ok(res.ok,JSON.stringify(data));return data;}
await db.connect();
try {
 evidence.database=(await assertDisposableDbConnection(db)).currentDb;
 token=(await api('/auth/user/emailpass',{email:process.env.ADMIN_COUNT_EMAIL || 'admin@sai-ajanta.com',password:process.env.ADMIN_COUNT_PASSWORD || 'Admin1234!'})).token;
 // Synthetic helper regression only; database/API assertions below provide real-data evidence.
 const fixture=Array.from({length:2101},(_,id)=>({id:String(id)}));
 const all=await queryGraphAll({graph:async({pagination})=>({data:fixture.slice(pagination.skip,pagination.skip+pagination.take)})},{entity:'product'});
 assert.equal(all.data.length,2101);assert.equal(new Set(all.data.map(r=>r.id)).size,2101);evidence.checks.push('Compatibility snapshot helper traverses beyond the old 2000-row cap (synthetic unit regression)');
 const id='count_qa_deleted_'+crypto.randomUUID();
 await db.query("INSERT INTO dms_trade_enquiry(id,name,phone,status,deleted_at) VALUES($1,$1,'9000000000','NEW',now())",[id]);
 evidence.fixtures.push({kind:'pre-deleted-enquiry',id});
 const data=await api('/admin/sai-ajanta/tab-data?'+new URLSearchParams({dataset:'enquiries',q:id}));
 assert.equal(data.total,0);assert.equal(data.counts.ALL,0);assert.equal(Number((await db.query('SELECT count(*) FROM dms_trade_enquiry WHERE id=$1',[id])).rows[0].count),1);
 evidence.checks.push('Actual soft-deleted enquiry excluded from API items and facets');
 const owned=JSON.parse(fs.readFileSync('docs/admin-tab-mutation-evidence.json','utf8')).fixtures.find(f=>f.kind==='DEALER');
 const deletedProfile='count_qa_profile_'+crypto.randomUUID();
 await db.query("INSERT INTO account_profile(id,customer_id,role,status,deleted_at) VALUES($1,$2,'DEALER','ACTIVE',now())",[deletedProfile,owned.id]);
 evidence.fixtures.push({kind:'pre-deleted-profile',id:deletedProfile});
 const joined=await api('/admin/sai-ajanta/tab-data?'+new URLSearchParams({dataset:'partners',role:'DEALER',q:'COUNTQA'}));
 assert.equal(joined.total,1);assert.equal(joined.counts.REJECTED,1);evidence.checks.push('Deleted historical profile does not duplicate joined customer or override rejection metadata');
 const intent='count_qa_import_'+crypto.randomUUID();
 const payload={intentId:intent,fileName:intent+'.csv',fileContentText:'sku,name,category,brand,billing_unit,customer_price_inr,dealer_price_inr,distributor_price_inr,gst_rate,stock_qty\n'+intent+',Count QA import,Hardware,Sai Ajantha,1 Unit,100,90,80,18,0\n'};
 const staged=await api('/admin/sai-ajanta/products/import/stage',payload);
 evidence.fixtures.push({kind:'staged-import-job',id:staged.jobId});
 assert.equal(staged.totalRows,1);assert.equal(staged.rows.length,1);
 const persisted=await api('/admin/sai-ajanta/products/import/jobs/'+staged.jobId);
 assert.equal(persisted.job.total_rows,persisted.rows.length);assert.equal(persisted.job.status,'STAGED');
 assert.equal(Number((await db.query('SELECT count(*) FROM dms_product_import_row WHERE job_id=$1 AND deleted_at IS NULL',[staged.jobId])).rows[0].count),persisted.rows.length);
 evidence.checks.push('Staged import API totals reconcile with persisted PostgreSQL rows');
 const replay=await api('/admin/sai-ajanta/products/import/stage',payload);assert.equal(replay.job.id,staged.jobId);assert.equal(replay.rows.length,1);
 assert.equal(Number((await db.query('SELECT count(*) FROM dms_product_import_job WHERE intent_id=$1 AND deleted_at IS NULL',[intent])).rows[0].count),1);
 evidence.checks.push('Import retry does not duplicate job or row counts');
 const portal=await api('/admin/sai-ajanta/portal');const overview=await api('/admin/sai-ajanta/overview');
 assert.equal(portal.products.length,overview.products.length);assert.equal(portal.reports.totalProducts,portal.products.length);assert.equal(portal.reports.totalOrders,portal.orders.length);assert.equal(portal.reports.totalUsers,portal.users.length);
 assert.equal(portal.reports.lowStockProducts,portal.products.filter(p=>p.stock_qty>0&&p.stock_qty<=10).length);
 evidence.checks.push('Dashboard snapshot, overview, inventory low-stock and module totals reconcile');
 const action=await api('/admin/sai-ajanta/tab-data?dataset=orders&tab=ACTION&pageSize=100');
 assert.ok(action.items.every(o=>!['CANCELLED','DELIVERED','COMPLETED'].includes(o.status)));evidence.checks.push('Payment action queue excludes terminal orders');
}catch(error){evidence.failures.push(error.message);}
finally{await db.end();fs.writeFileSync('docs/admin-tab-edge-case-evidence.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence,null,2));if(evidence.failures.length)process.exitCode=1;
