// Authenticated count synchronization checks against dedicated disposable fixtures.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";
import { buildAdminDatasetQuery } from "../apps/backend/src/lib/admin-tab-datasets.ts";

dotenv.config({path:'apps/backend/.env',quiet:true});
process.env.ALLOW_DISPOSABLE_DB_WRITES = 'true';
assertDisposableDbTarget(process.env.DATABASE_URL);
const base=process.env.ADMIN_COUNT_BACKEND_URL || 'http://localhost:9000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Mutation suite only runs on loopback');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
const result={capturedAt:new Date().toISOString(),checks:[],fixtures:[],failures:[]};
const marker='COUNTQA'+Date.now();
let token;
const api=async(path,method='GET',body,auth=token)=>{
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...(path.startsWith('/store')?{'x-publishable-api-key':JSON.parse(fs.readFileSync('local-nas/medusa-public-config.json','utf8')).publishableKey}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();assert.ok(response.ok,`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);return data;
};
const reconcile=async(dataset,filters,label)=>{
 const data=await api('/admin/sai-ajanta/tab-data?'+new URLSearchParams({dataset,...filters,pageSize:'100'}));
 const q=buildAdminDatasetQuery(dataset,filters);let index=0;
 const expected=(await db.query(q.sql.replaceAll('?',()=>'$'+(++index)),q.bindings)).rows[0];
 assert.deepEqual(data.counts,expected.counts,label+' facets');assert.equal(data.total,expected.total,label+' total');
 assert.deepEqual(data.items.map(i=>i.medusa_id||i.id),expected.ids,label+' ids');result.checks.push(label);return data;
};
await db.connect();
try {
 result.database=(await assertDisposableDbConnection(db)).currentDb;
 token=(await api('/auth/user/emailpass','POST',{email:process.env.ADMIN_COUNT_EMAIL || 'admin@sai-ajanta.com',password:process.env.ADMIN_COUNT_PASSWORD || 'Admin1234!'},null)).token;
 for(const role of ['DEALER','DISTRIBUTOR']){
   const customer=(await api('/admin/sai-ajanta/customers','POST',{name:marker+role,email:(marker+role).toLowerCase()+'@sai-ajanta-test.internal',phone:'9000000000',role,status:'PENDING_APPROVAL',credit_limit:0})).customer;
   result.fixtures.push({kind:role,id:customer.id});
   assert.equal((await db.query('SELECT status FROM account_profile WHERE customer_id=$1',[customer.id])).rows[0].status,'PENDING_APPROVAL');
   let data=await reconcile('partners',{role,q:marker},role+' creation increases Pending');assert.equal(data.counts.PENDING_APPROVAL,1);
   for(const [status,facet] of [['ACTIVE','APPROVED'],['SUSPENDED','REJECTED'],['ACTIVE','APPROVED'],['REJECTED','REJECTED']]){
     await api('/admin/sai-ajanta/customers/'+customer.id,'PATCH',{status,rejection_reason:'Disposable count synchronization QA'});
     data=await reconcile('partners',{role,q:marker},role+' '+status+' persists and reconciles');assert.equal(data.counts[facet],1);assert.equal(data.counts.ALL,1);
   }
 }
 const product=(await api('/admin/sai-ajanta/products','POST',{sku:marker,name:marker+' Count Lifecycle',category:'Hardware',cmsStatus:'DRAFT',approved:false,active:false,stockQty:0,customerPriceInr:100,dealerPriceInr:90,distributorPriceInr:80})).product;
 result.fixtures.push({kind:'product',id:product.medusa_id});
 let data=await reconcile('products',{q:marker},'Created draft increases Draft and Needs Review');assert.equal(data.counts.DRAFT,1);
 for(const cmsStatus of ['REVIEW','APPROVED','PUBLISHED','DRAFT']) {
   await api('/admin/sai-ajanta/products/'+product.medusa_id,'PATCH',{cmsStatus,approved:['APPROVED','PUBLISHED'].includes(cmsStatus),active:cmsStatus==='PUBLISHED'});
   assert.equal((await db.query('SELECT metadata FROM product WHERE id=$1',[product.medusa_id])).rows[0].metadata.cms_status,cmsStatus);
   data=await reconcile('products',{q:marker},'Product '+cmsStatus+' persists and reconciles');assert.equal(data.counts[cmsStatus==='REVIEW'?'NEEDS_APPROVAL':cmsStatus],1);
 }
 const enquiry=await api('/store/sai-ajanta/enquiries','POST',{name:marker,phone:'9000000000',notes:marker,source:'installation-request',division:'Hardware'});
 result.fixtures.push({kind:'enquiry',id:enquiry.id});
 data=await reconcile('enquiries',{q:marker},'New enquiry appears in All/Open/Installation');assert.equal(data.counts.OPEN,1);
 for(const status of ['IN_REVIEW','QUOTED','CLOSED']) {
   await api('/admin/sai-ajanta/enquiries/'+enquiry.id,'PATCH',{status});
   assert.equal((await db.query('SELECT status FROM dms_trade_enquiry WHERE id=$1',[enquiry.id])).rows[0].status,status);
   await reconcile('enquiries',{q:marker},'Enquiry '+status+' persists and reconciles');
 }
 const quote=(await api('/admin/sai-ajanta/quotes','POST',{customer_name:marker,division:'Hardware',items:[{sku:marker,name:marker,quantity:1,unitPriceInr:100}]})).quote;
 result.fixtures.push({kind:'quote',id:quote.id});
 for(const status of ['REVIEWED','SHARED_NONPAYABLE','ARCHIVED']) {
   await api('/admin/sai-ajanta/quotes/'+quote.id,'PATCH',{status,revision_note:'Disposable count QA'});
   assert.equal((await db.query('SELECT status FROM dms_trade_quote WHERE id=$1',[quote.id])).rows[0].status,status);
   await reconcile('quotes',{q:marker},'Quote '+status+' persists and reconciles');
 }
 const orderId='count_qa_'+crypto.randomUUID();
 await db.query(`INSERT INTO dms_trade_order (id,order_number,customer_id,role_at_order,price_tier_applied,status,payment_status,payment_method,customer_name,customer_email,customer_phone,shipping_address,subtotal_inr,gst_amount_inr,total_inr,items,events,fulfilment_status)
   VALUES ($1,$2,$3,'CUSTOMER','CUSTOMER','CONFIRMED','PAID','BANK_TRANSFER',$2,'count-qa@sai-ajanta-test.internal','9000000000','Disposable test fixture',0,0,0,'[]','[]','UNALLOCATED')`,[orderId,marker,result.fixtures[0].id]);
 result.fixtures.push({kind:'zero-value-order',id:orderId});
 for(const command of ['PACK_ORDER','DISPATCH_ORDER','MARK_DELIVERED']) {
   await api('/admin/sai-ajanta/orders/'+orderId+'/transition','POST',{command,carrierName:'Count QA',trackingNumber:marker});
   await reconcile('orders',{q:marker},'Order '+command+' persists and reconciles');
 }
 await api('/admin/sai-ajanta/returns/'+orderId,'PATCH',{return_status:'REQUESTED'});
 await reconcile('returns',{q:marker},'Return REQUESTED persists and reconciles');
 await api('/admin/sai-ajanta/returns/'+orderId,'PATCH',{return_status:'INSPECTED'});
 data=await reconcile('returns',{q:marker},'Return INSPECTED persists and reconciles');assert.equal(data.counts.INSPECTED,1);
 const password='CountQa!'+crypto.randomBytes(12).toString('hex');
 const email=marker.toLowerCase()+'@count-qa.internal';
 const created=await api('/admin/sai-ajanta/staff','POST',{email,first_name:'Count QA',password,role:'staff',permissions:['CATALOG_MANAGE']});
 const staff=(await api('/admin/sai-ajanta/staff')).staff.find(s=>s.email===email);assert.ok(staff);
 result.fixtures.push({kind:'scoped-staff',id:staff.id});
 const scopedToken=(await api('/auth/user/emailpass','POST',{email,password},null)).token;
 for(const dataset of ['partners','orders','enquiries','quotes','returns']) {
   const denied=await fetch(base+'/admin/sai-ajanta/tab-data?dataset='+dataset,{headers:{Authorization:'Bearer '+scopedToken}});
   assert.equal(denied.status,403);const body=await denied.json();assert.equal(body.items,undefined);assert.equal(body.counts,undefined);result.checks.push('Scoped catalog staff denied '+dataset+' rows and counts');
 }
 await api('/admin/sai-ajanta/staff/'+staff.id,'PATCH',{active:false});
 assert.equal((await db.query('SELECT metadata FROM "user" WHERE id=$1',[staff.id])).rows[0].metadata.active,false);
 result.checks.push('Staff suspension persisted; complete directory reconciles');
} catch(e) {result.failures.push(e.message);}
finally {await db.end();fs.writeFileSync('docs/admin-tab-mutation-evidence.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));if(result.failures.length)process.exitCode=1;
