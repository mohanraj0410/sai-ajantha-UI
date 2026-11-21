import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from '../apps/backend/node_modules/pg/lib/index.js';
import dotenv from '../apps/backend/node_modules/dotenv/dist/index.cjs';
import { ADMIN_DATASETS, buildAdminDatasetQuery } from '../apps/backend/src/lib/admin-tab-datasets.ts';

dotenv.config({path:'apps/backend/.env',quiet:true});
const base=process.env.ADMIN_COUNT_BACKEND_URL || 'http://localhost:9000';
const login=await fetch(base+'/auth/user/emailpass',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_COUNT_EMAIL||'admin@sai-ajanta.com',password:process.env.ADMIN_COUNT_PASSWORD||'Admin1234!'})});
assert.equal(login.status,200);const {token}=await login.json();
const get=async path=>{const response=await fetch(base+'/admin/sai-ajanta/'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,path);return response.json();};
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const modules=[
 ['Customers','/customers','partners',{role:'CUSTOMER'},'PartnersPage'],
 ['Dealers','/dealers','partners',{role:'DEALER'},'PartnersPage'],
 ['Dealer approvals','/dealers/approvals','partners',{role:'DEALER'},'PartnersPage'],
 ['Distributors','/distributors','partners',{role:'DISTRIBUTOR'},'PartnersPage'],
 ['Distributor approvals','/distributors/approvals','partners',{role:'DISTRIBUTOR'},'PartnersPage'],
 ['Products','/products; /products/review','products',{},'ProductsPage'],
 ['Orders','/orders','orders',{},'OrdersPage'],
 ['Enquiries','/enquiries','enquiries',{},'EnquiriesPage'],
 ['Quotations','/quotes','quotes',{},'QuotesPage'],
 ['Returns','/returns','returns',{},'ReturnsPage'],
];
const rows=[];
const reconciliation=[];
try {
 await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 for(const [label,route,dataset,params,page] of modules){
   const data=await get('tab-data?'+new URLSearchParams({dataset,...params}));
   const query=buildAdminDatasetQuery(dataset,params);let index=0;
   const expected=(await db.query(query.sql.replaceAll('?',()=>'$'+(++index)),query.bindings)).rows[0];
   assert.deepEqual(data.counts,expected.counts,label);
   reconciliation.push({label,route,dataset,params,counts:data.counts});
   for(const [tab,predicate] of Object.entries(ADMIN_DATASETS[dataset].tabs)){
     let old='Not captured before changes';
     if(dataset==='partners'&&params.role==='DEALER') old=({ALL:44,APPROVED:25,PENDING_APPROVAL:3,REJECTED:8})[tab];
     const cause=dataset==='partners'?'Combined tab omitted SUSPENDED; global facets ignored search':dataset==='products'?'APPROVED had no tab; review overlaps drafts; fixed list cap':dataset==='orders'?'COMPLETED/PACKED omitted; terminal orders entered payment action queue; scoped counts missing':dataset==='enquiries'?'Counts and source filters used different predicates; search ignored by facets':dataset==='quotes'?'Missing Draft/Expired/Archived facets; search ignored by facets': 'Claims overlap inspected orders; All explicitly includes orders without claims';
     rows.push([label,route,tab,predicate,old,expected.counts[tab],data.counts[tab],`tab-data?dataset=${dataset}`,`admin/dataset/${dataset}/actor/{filters,sort,page,pageSize}`,cause,`apps/admin/src/pages/${page}.tsx; apps/backend/src/lib/admin-tab-datasets.ts`,'PASS: SQL + authenticated API']);
   }
 }
 const resources=await Promise.allSettled(['portal','overview','seller-coverage','inventory/ledger','staff','promotions','audit-log?pageSize=1'].map(get));
 for(const r of resources) if(r.status==='rejected') throw r.reason;
 const [portal,overview,coverage,ledger,staff,promotions,audit]=resources.map(r=>r.value);
 const categories=fs.readFileSync('apps/admin/src/pages/ProductsPage.tsx','utf8').match(/export const ELEVEN_CATEGORIES = \[([\s\S]*?)\] as const/)[1].match(/"[^"]+"/g).map(s=>JSON.parse(s));
 const categoryCounts={all:categories.length,direct:categories.filter(c=>!['Door Closer & Floor Spring','Kitchen Basket'].includes(c)).length,house:categories.filter(c=>['Door Closer & Floor Spring','Kitchen Basket'].includes(c)).length};
 const extra=[
  ['Dashboard','/dashboard','Category / Sales chart modes',JSON.stringify(portal.reports),'portal; analytics?fy=...','portal/actor; analytics/actor/{fy,flags}','Published KPI now uses PUBLISHED; review and low-stock predicates agree with queues. Financial-year analytics remains a distinct date scope.','DashboardPage; actionQueueCounts'],
  ['Product Categories','/categories','All / Direct / House',JSON.stringify(categoryCounts),'overview','overview/actor','Configured category policy groups, not persisted product_category records. Replaced literal badge values with derived group lengths.','CategoriesPage'],
  ['Inventory','/inventory','Stock Available',String(portal.products.length),'portal; overview','portal/actor; overview/actor','Stock and KPI use the same product source; low stock is 1–10, out of stock <=0. No fabricated warehouse count.','InventoryPage'],
  ['Inventory','/inventory/reservations','Order Reservations',String(ledger.reservations.length),'inventory/ledger','inventory-ledger/actor','Navigation tab has no badge; complete returned reservation array supplies table total.','InventoryPage'],
  ['Inventory','/inventory/adjustments','Movement History',String(ledger.movements.length),'inventory/ledger','inventory-ledger/actor','Navigation tab has no badge; complete returned movement array supplies table total.','InventoryPage'],
  ['Pricing','/pricing','3-Tier Pricing Matrix',String(portal.products.length),'portal','portal/actor','Global tier-coverage KPIs; searchable table total counts matching products. Navigation tab is not a status partition.','PricingPromotionsPage'],
  ['Promotions','/promotions','Promotions (Drafts)',`${promotions.promotions.length} governance rows; ${promotions.promotions.filter(p=>p.status==='DRAFT').length} DRAFT`,'promotions','promotions/actor','Draft KPI now counts only DRAFT, loads on Pricing too, and uses its own query loading/error state. Commerce remains locked.','PricingPromotionsPage'],
  ['Seller Coverage','/seller-coverage','Profile totals / PIN simulation',JSON.stringify(coverage.profileScope),'seller-coverage?pin=&category=','seller-coverage/actor/{pin,category}','Profile scope differs from current-customer directory. Visible scope notice explains orphan profiles. PIN/category controls run a preview, not a directory filter.','SellerCoveragePage'],
  ['Staff Management','/settings/staff','Staff Directory',String(staff.staff.length),'staff','staff/actor','Removed the 500-user cap; includes active and inactive non-deleted staff. Table header counts full directory.','SettingsPage'],
  ['Settings','/settings; /settings/roles','General / Role Permissions','Not a record count','settings','settings/actor','Navigation and permission matrix, not record status facets. No badge total to reconcile.','SettingsPage'],
  ['Audit Logs','/settings/audit-log','Audit Log / outcome filters',String(audit.total),'audit-log?page&pageSize&action&outcome&actor&resource&from&to','audit-logs/actor/{filters,page,pageSize}','Fixed page-1-only UI and local 50-row total. SQL aggregation shares filters with paged events; page clamps after filters.','SettingsPage; audit-log/route.ts'],
  ['Reports','/reports','All / Direct / Distributor seller segments',`${portal.orders.length} orders; ${portal.products.length} products`,'portal; analytics','portal/actor; analytics/actor/{fy,flags}','Seller scope applies to order KPIs. Catalogue charts explicitly describe catalogue scope; Published excludes merely approved products.','ReportsPage'],
  ['Product Import','/products/import','Upload / Review / Publish steps','0 current-session rows on a fresh upload; persisted jobs audited separately','products/import/stage; products/import/jobs/:id','Mutation response/local staged job; import-jobs invalidation namespace','Steps are workflow navigation. Current upload partitions Valid + Samples + Blocked = Total. Stage/replay verified against real job rows; no job-history tab exists.','ProductImportPage'],
  ['Details / editor','/products/:id; /products/new; /orders/:id; /customers/:id; /dealers/:id; /distributors/:id; /enquiries/:id','Single-record details','Not a list-status partition','products/:id; orders/:id; portal; enquiries','product-detail/actor/id; order/actor/id; portal/actor; enquiries/actor','No additional count tabs. Product reference lookup no longer caps legacy lookup at 2000; enquiry links preserve selection across pages.','ProductDetailPage; ProductEditorPage; OrderDetailPage; PartnerDetailPage; EnquiriesPage'],
  ['Authentication / fallbacks','/login; /forgot-password; /access-denied; unmatched route','No record tabs','Not applicable','auth; me','Authentication clears admin cache on sign-out/401','No dataset counts or status filters. Role-gated navigation remains enforced.','LoginPage; ForgotPasswordPage; AccessDeniedPage; NotFoundPage'],
 ];
 const clean=v=>String(v).replaceAll('|','\\|').replaceAll('\n',' ');
 const table=(head,body)=>'| '+head.join(' | ')+' |\n| '+head.map(()=>'---').join(' | ')+' |\n'+body.map(r=>'| '+r.map(clean).join(' | ')+' |').join('\n')+'\n';
 const captured=new Date().toISOString();
 fs.writeFileSync('docs/admin-tab-final-reconciliation.json',JSON.stringify({capturedAt:captured,database:(await db.query('SELECT current_database() AS name')).rows[0].name,modules:reconciliation,portalReports:portal.reports,coverageScope:coverage.profileScope,categoryCounts,inventory:{products:portal.products.length,low:portal.products.filter(p=>p.stock_qty>0&&p.stock_qty<=10).length,out:portal.products.filter(p=>p.stock_qty<=0).length,reservations:ledger.reservations.length,movements:ledger.movements.length},staff:staff.staff.length,audit:audit.total},null,2)+'\n');
 fs.writeFileSync('ADMIN_TAB_COUNT_ISSUE_MATRIX.md',`# Admin tab and count issue matrix\n\nCaptured ${captured}. Every /admin/sai-ajanta endpoint retains staff authentication and its existing operational permission. Counts below are from the configured disposable database, not a production attestation.\n\n## Record facets\n\nAll rows use policy B: search, role, category, seller, payment, explicit status and date filters scope facets where supported; the active tab, sort and page do not. Pagination is server-side (maximum 100/page), deterministic, resets on filters and clamps after deletions/transitions. The matching table header uses server total.\n\nOld values are recorded only when actually established; missing historical observations are not fabricated. Dealer old values refer to the original 44-account snapshot; current values include subsequent disposable test activity.\n\n${table(['Module','Route','Tab / KPI key','Backend predicate','Old displayed count','Actual DB count','Corrected API count','API suffix','React Query key','Root cause / semantics','Files','Verification'],rows)}\n## Navigation, custom filters, KPI and other screens\n\nNavigation tabs are not mutually exclusive record partitions. Sidebar badges use the global authorized snapshot and stay independent of a page search; module tables/facets show the current search scope. Inventory and pricing KPI cards describe the global warehouse/catalogue scope; their table headers describe filtered rows.\n\n${table(['Module','Route','Tabs / filters','Verified scope / total','API suffix','React Query key','Finding / behavior','Files'],extra)}\n\nShared changes: AdminStatusTabs, AdminTable, AdminPrimitives, adminQueries, admin-tab-datasets, admin-query-all, and portal serialization. Counts never use the current rendered page length for remote datasets. Loading uses skeletons; failed counts are unavailable with retry; a successful empty scope shows zero. Main facet routes were verified by SQL and authenticated API assertions. All navigation destinations were checked at six widths; see integration results for exact test limits.\n`);
 await db.query('ROLLBACK');
}finally{await db.end();}
console.log('Wrote issue matrix and final reconciliation evidence.');
