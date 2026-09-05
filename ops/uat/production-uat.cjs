/* eslint-disable @typescript-eslint/no-require-imports */
// Run from repository root using: node_modules/.bin/tsx ops/uat/production-uat.cjs --run-production-uat
// This writes real production records. Requires explicit approval of docs/production-uat-plan.md.
const fs = require('node:fs');
const { randomBytes, randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
if (!process.argv.includes('--run-production-uat') || process.cwd() !== '/opt/apps/ma-next') {
  throw new Error('Requires /opt/apps/ma-next and --run-production-uat; review the plan first.');
}
process.env.NODE_ENV = 'production';
require('@next/env').loadEnvConfig(process.cwd());
const { prisma } = require('../../lib/prisma');
const { rolePermissions } = require('../../lib/auth/permissions');
const { createUser } = require('../../lib/users/service');
const RUN = 'UAT-20260905-A';
const dir = 'storage/uat/' + RUN;
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const stateFile = dir + '/state.json';
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { users: {}, steps: {}, checks: [] };
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
const password = () => randomBytes(24).toString('base64url') + '!9aA';
const cookies = {};
async function http(role, path, body, method = body === undefined ? 'GET' : 'POST', expected) {
  const response = await fetch('https://ma.rattanan.dev' + path, { method, headers: { 'content-type': 'application/json', origin: 'https://ma.rattanan.dev', 'user-agent': RUN, ...(cookies[role] ? { cookie: cookies[role] } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(45000) });
  const cookie = response.headers.get('set-cookie'); if (cookie) cookies[role] = cookie.split(';')[0];
  const raw = await response.text(); let result; try { result = JSON.parse(raw); } catch { result = { error: 'Non-JSON response' }; }
  if (expected ? response.status !== expected : !response.ok) throw new Error(`${role} ${method} ${path}: HTTP ${response.status} ${JSON.stringify(result).slice(0,900)}`);
  return result;
}
async function step(key, run) {
  if (state.steps[key]) return state.steps[key];
  if (state.pending) throw new Error(`Reconcile uncertain step ${state.pending} against production before retrying; no automatic duplicate writes.`);
  state.pending = key; save();
  const result = await run(); state.steps[key] = result || { ok: true }; state.pending = null; save();
  console.log('PASS', key, result?.status || result?.code || result?.id || ''); return result;
}
async function login(role) { const u=state.users[role]; await http(role, '/api/auth/login', {identifier:u.username,password:u.password}); console.log('LOGIN',role); }
async function approval(role, type, number, id) {
 const result=await http(role,`/api/approvals?type=${type}&search=${encodeURIComponent(number)}&tab=pending&pageSize=100`);
 const found=result.items.filter(x=>x.referenceId===id); assert.equal(found.length,1,'Expected one approval for the exact UAT document'); return found[0];
}
async function inventoryApprovals(document) {
 for(const role of ['MAINTENANCE_MANAGER','WAREHOUSE_MANAGER']) await step(document.id+'-'+role,async()=>{
   const detail=await http(role,`/api/inventory/documents/${document.id}`);
   const next=detail.approvals.filter(x=>x.status==='PENDING' && x.step===role); assert.equal(next.length,1);
   return http(role,`/api/inventory/approvals/${next[0].id}/actions`,{action:'APPROVE',comment:RUN+' simulated approval'});
 });
 const detail=await http('WAREHOUSE_MANAGER',`/api/inventory/documents/${document.id}`); assert.equal(detail.status,'POSTED'); return detail;
}
async function main() {
 if(state.complete) { console.log('Already complete; inspect the saved report.'); return; }
 if(state.pending) throw new Error('Reconcile pending step before retry: '+state.pending);
 const owner=await prisma.user.findFirstOrThrow({where:{legacyRole:'ADMIN',status:'ACTIVE',username:{not:{startsWith:'uat.'}}},select:{id:true,fullName:true}});
 const meta={requestId:randomUUID(),ipAddress:'127.0.0.1',userAgent:RUN+' authorized SSH bootstrap',browser:'UAT',operatingSystem:'server',deviceType:'script'};
 if(!state.users.ADMIN) await step('bootstrap-admin',async()=>{
   const input={fullName:RUN+' ADMIN',username:'uat.20260905.admin',email:'uat.20260905.admin@example.test',role:'ADMIN',status:'ACTIVE',password:password(),mustChangePassword:false,adminNotes:RUN+' isolated workflow test; authorized via SSH'};
   state.users.ADMIN={username:input.username,password:input.password};save();
   const u=await createUser(input,owner,meta);state.users.ADMIN.id=u.id;save();return {id:u.id};
 });
 await login('ADMIN');
 const org=await step('organization',async()=> (await http('ADMIN','/api/organizations',{code:RUN,name:RUN+' TEST ONLY',description:'Synthetic acceptance data; not real operations'})).organization);
 const site=await step('site',async()=> (await http('ADMIN','/api/sites',{organizationId:org.id,code:'UAT',name:RUN+' test site'})).site);
 const dept=await step('department',async()=> (await http('ADMIN','/api/departments',{organizationId:org.id,siteId:site.id,code:'UAT',name:RUN+' test department'})).department);
 for(const role of Object.keys(rolePermissions)) {
   if(!state.users[role]) await step('user-'+role,async()=>{
     const input={fullName:RUN+' '+role,username:'uat.20260905.'+role.toLowerCase(),email:'uat.20260905.'+role.toLowerCase()+'@example.test',role,status:'ACTIVE',password:password(),mustChangePassword:true,adminNotes:RUN};
     state.users[role]={username:input.username,password:input.password,needsChange:true};save();
     const r=await http('ADMIN','/api/admin/users',input);state.users[role].id=r.user.id;save();return {id:r.user.id};
   });
   await step('scope-'+role,async()=>prisma.$transaction(async tx=>{
     let rr=await tx.role.findUnique({where:{code:role}});
     if(!rr){rr=await tx.role.create({data:{code:role,name:role,system:true,active:true,description:'Application role provisioned during '+RUN}});
       for(const code of rolePermissions[role]) {const permission=await tx.permission.upsert({where:{code},update:{},create:{code,name:code,category:'APPLICATION'}});await tx.rolePermission.create({data:{roleId:rr.id,permissionId:permission.id}});}
     }
     assert(rr.active,'Existing role is inactive; do not change it automatically');
     for(const scopeType of ['ORGANIZATION','DEPARTMENT']) await tx.userRole.create({data:{userId:state.users[role].id,roleId:rr.id,scopeType,organizationId:org.id,...(scopeType==='DEPARTMENT'?{siteId:site.id,departmentId:dept.id}:{})}});
     await tx.auditLog.create({data:{actorUserId:owner.id,actorName:owner.fullName,action:'UAT_ROLE_ASSIGNED',category:'USER_MANAGEMENT',targetType:'USER',targetId:state.users[role].id,result:'SUCCESS',requestId:randomUUID(),description:RUN+' scoped role '+role,newValues:JSON.stringify({role,organizationId:org.id,departmentId:dept.id})}});
     return {role};
   },{timeout:30000}));
   if(role!=='ADMIN') await login(role);
   if(state.users[role].needsChange) await step('password-change-'+role,async()=>{
     const next=password();state.users[role].pendingPassword=next;save();
     await http(role,'/api/auth/change-password',{currentPassword:state.users[role].password,newPassword:next,confirmPassword:next});state.users[role].password=next;delete state.users[role].pendingPassword;state.users[role].needsChange=false;save();return {ok:true};
   });
   await step('identity-'+role,async()=>{const me=await http(role,'/api/auth/me'); assert.equal(me.user.id,state.users[role].id);assert.equal(me.user.role,role);return {id:me.user.id,role};});
 }
 const locA=await step('location-A',()=>http('WAREHOUSE_MANAGER','/api/inventory/locations',{code:RUN+'-A',name:RUN+' test warehouse A'}));
 const locB=await step('location-B',()=>http('WAREHOUSE_MANAGER','/api/inventory/locations',{code:RUN+'-B',name:RUN+' test warehouse B'}));
 const item=await step('stock-item',()=>http('WAREHOUSE_MANAGER','/api/inventory/items',{code:RUN+'-PART',name:RUN+' synthetic bearing',unit:'EA',defaultUnitCost:'1',mainLocationId:locA.id,remark:RUN+' no physical inventory'}));
 const vendor=await step('vendor',()=>http('WAREHOUSE_MANAGER','/api/inventory/vendors',{code:RUN+'-VENDOR',name:RUN+' TEST VENDOR - DO NOT ORDER',remark:'Synthetic test only; no external purchase'}));
 const assetType=await prisma.assetType.findFirstOrThrow({where:{active:true},select:{id:true}});
 const asset=await step('asset',()=>http('DATA_SOURCE_CREATOR','/api/assets',{code:RUN+'-ASSET',name:RUN+' simulated pump',assetTypeId:assetType.id,location:RUN+' virtual test bay',ownerUserId:state.users.OPERATOR.id,description:'Synthetic acceptance asset, not physical equipment'}));
 for(const type of ['PURCHASE_REQUEST','PURCHASE_ORDER']) {
   const wf=await step('workflow-'+type,async()=> (await http('ADMIN','/api/approval-workflows',{workflowName:RUN+' '+type,documentType:type,departmentId:dept.id,effectiveFrom:'2026-09-01T00:00:00Z',priority:100,isActive:false,steps:[{stepNumber:1,stepName:'UAT independent manager approval',approverType:'SPECIFIC_USER',approverUserId:state.users.MAINTENANCE_MANAGER.id,allowSelfApproval:false}]})).workflow);
   await step('activate-'+type,()=>http('ADMIN',`/api/approval-workflows/${wf.id}/activate`,{active:true}));
 }
 const prBody={departmentId:dept.id,remark:RUN+' TEST ONLY',candidateVendorIds:[vendor.id],lines:[{stockItemId:item.id,quantity:'10',estimatedUnitPrice:'1'}]};
 const pr=await step('PR-create',()=>http('MAINTENANCE','/api/purchase-requests',prBody));
 await step('PR-deny-operator',()=>http('OPERATOR','/api/purchase-requests',prBody,'POST',403));
 await step('PR-submit',()=>http('MAINTENANCE',`/api/purchase-requests/${pr.id}/actions`,{action:'SUBMIT'}));
 await step('PR-approve',async()=>{const task=await approval('MAINTENANCE_MANAGER','PURCHASE_REQUEST',pr.requestNumber,pr.id);return http('MAINTENANCE_MANAGER',`/api/approvals/${task.id}/actions`,{action:'APPROVE',comment:RUN+' independent approval'});});
 const approvedPr=await http('MAINTENANCE',`/api/purchase-requests/${pr.id}`);assert.equal(approvedPr.request.status,'APPROVED');
 const po=await step('PO-create',()=>http('WAREHOUSE_MANAGER','/api/purchase-orders',{purchaseRequestId:pr.id,vendorId:vendor.id,departmentId:dept.id,remark:RUN+' TEST ONLY - DO NOT SEND',lines:[{stockItemId:item.id,quantity:'10',unitPrice:'1'}]}));
 await step('PO-submit',()=>http('WAREHOUSE_MANAGER',`/api/purchase-orders/${po.id}/actions`,{action:'SUBMIT'}));
 await step('PO-approve',async()=>{const task=await approval('MAINTENANCE_MANAGER','PURCHASE_ORDER',po.orderNumber,po.id);return http('MAINTENANCE_MANAGER',`/api/approvals/${task.id}/actions`,{action:'APPROVE',comment:RUN+' independent approval'});});
 await step('PO-issue',()=>http('WAREHOUSE_MANAGER',`/api/purchase-orders/${po.id}/actions`,{action:'ISSUE'}));
 const poDetail=(await http('WAREHOUSE_MANAGER',`/api/purchase-orders/${po.id}`)).order;
 const receipt=await step('receipt-create',()=>http('WAREHOUSE_MANAGER','/api/inventory/po-receipts',{purchaseOrderId:po.id,documentDate:'2026-09-05',deliveryNoteNumber:RUN,remark:RUN+' simulated receipt',lines:[{purchaseOrderLineId:poDetail.lines[0].id,destinationLocationId:locA.id,receivedQuantity:'10'}]}));
 await step('receipt-confirm',()=>http('WAREHOUSE_MANAGER',`/api/inventory/po-receipts/${receipt.id}/actions`,{action:'CONFIRM'}));
 const receiptDetail=await http('WAREHOUSE_MANAGER',`/api/inventory/documents/${receipt.id}`);assert.equal(receiptDetail.status,'POSTED');
 const notification=await step('notification-create',async()=> (await http('OPERATOR','/api/maintenance/workflow/notifications',{organizationId:org.id,siteId:site.id,departmentId:dept.id,assetId:asset.id,title:RUN+' simulated pump fault',description:RUN+' simulated bearing noise; no real equipment fault'})).notification);
 const npath=`/api/maintenance/workflow/notifications/${notification.id}/commands/`;
 await step('notification-submit',()=>http('OPERATOR',npath+'submit',{comment:RUN}));
 await step('notification-review',()=>http('MAINTENANCE_MANAGER',npath+'review',{action:'START_REVIEW',comment:RUN}));
 await step('notification-approve',()=>http('MAINTENANCE_MANAGER',npath+'review',{action:'APPROVE',comment:RUN}));
 const wo=await step('work-order-create',()=>http('MAINTENANCE_MANAGER',npath+'create-work-order',{technicianId:state.users.TECHNICIAN.id,instructions:RUN+' simulated replace bearing and test',title:RUN+' simulated maintenance'}));
 const wpath=`/api/maintenance/workflow/work-orders/${wo.id}/commands/`;
 await step('work-order-deny-other-technician',()=>http('MAINTENANCE',wpath+'accept-assignment',{note:RUN},'POST',403));
 await step('work-order-accept',()=>http('TECHNICIAN',wpath+'accept-assignment',{note:RUN}));
 await step('work-order-start',()=>http('TECHNICIAN',wpath+'start',{note:RUN}));
 const issue=await step('issue-create',()=>http('MAINTENANCE','/api/inventory/documents',{documentType:'ISSUE',documentDate:'2026-09-05',siteId:site.id,departmentId:dept.id,purpose:RUN+' simulated parts usage',referenceWorkOrderId:wo.id,referenceNotificationId:notification.id,lines:[{stockItemId:item.id,sourceLocationId:locA.id,sourceReceiptLineId:receiptDetail.lines[0].id,requestedQuantity:'2',workOrderId:wo.id}]}));
 await step('issue-submit',()=>http('MAINTENANCE',`/api/inventory/documents/${issue.id}/actions`,{action:'SUBMIT'}));
 await inventoryApprovals(issue);
 const transfer=await step('transfer-create',()=>http('MAINTENANCE','/api/inventory/documents',{documentType:'TRANSFER',documentDate:'2026-09-05',siteId:site.id,departmentId:dept.id,purpose:RUN+' simulated stock transfer',lines:[{stockItemId:item.id,sourceLocationId:locA.id,destinationLocationId:locB.id,requestedQuantity:'3'}]}));
 await step('transfer-submit',()=>http('MAINTENANCE',`/api/inventory/documents/${transfer.id}/actions`,{action:'SUBMIT'}));
 await inventoryApprovals(transfer);
 await step('work-order-deny-early-close',()=>http('MAINTENANCE_MANAGER',wpath+'close',{note:RUN},'POST',409));
 await step('work-order-submit-completion',()=>http('TECHNICIAN',wpath+'submit-completion',{diagnosis:RUN+' simulated worn bearing',rootCause:'Simulated wear',correctiveAction:'Simulated replacement of two units',workSummary:RUN+' simulated repair completed',laborMinutes:15,partsFinalized:true,noPartsUsed:false,testProcedure:'Simulated functional run',testResult:'PASS - simulated',recommendation:'UAT only; not actual maintenance evidence'}));
 await step('work-order-manager-approve',()=>http('MAINTENANCE_MANAGER',wpath+'manager-decision',{decision:'APPROVE',comment:RUN+' verified simulated repair'}));
 await step('work-order-operator-accept',()=>http('OPERATOR',wpath+'operator-decision',{decision:'ACCEPT',comment:RUN+' simulated acceptance'}));
 await step('work-order-close',()=>http('MAINTENANCE_MANAGER',wpath+'close',{note:RUN+' simulated closure'}));
 await step('notification-close',()=>http('OPERATOR',npath+'close',{comment:RUN+' simulated final confirmation'}));
 // Independent readback verifies persisted state and stock, not just HTTP success.
 const balances=await prisma.$queryRawUnsafe('SELECT location_id, quantity_on_hand FROM inventory_balances WHERE stock_item_id = ?',item.id);
 const quantities=Object.fromEntries(balances.map(x=>[x.location_id,Number(x.quantity_on_hand)]));assert.equal(quantities[locA.id],5);assert.equal(quantities[locB.id],3);
 const persistedWo=await prisma.workOrder.findUniqueOrThrow({where:{id:wo.id}});assert.equal(persistedWo.status,'CLOSED');
 const persistedN=await prisma.maintenanceNotification.findUniqueOrThrow({where:{id:notification.id}});assert.equal(persistedN.status,'CLOSED');
 const persistedPo=await prisma.purchaseOrder.findUniqueOrThrow({where:{id:po.id}});assert.equal(persistedPo.status,'RECEIVED');
 // Retain traceable transactions. Disable only UAT workflows and require password rotation.
 for(const type of ['PURCHASE_REQUEST','PURCHASE_ORDER']) await step('deactivate-'+type,()=>http('ADMIN',`/api/approval-workflows/${state.steps['workflow-'+type].id}/activate`,{active:false}));
 for(const role of Object.keys(state.users)) await step('rotate-on-next-login-'+role,()=>http('ADMIN',`/api/admin/users/${state.users[role].id}`,{mustChangePassword:true},'PATCH'));
 const publicReport={run:RUN,finishedAt:new Date().toISOString(),accounts:Object.entries(state.users).map(([role,u])=>({role,id:u.id,username:u.username})),documents:{pr:pr.requestNumber,po:po.orderNumber,receipt:receipt.documentNumber,issue:issue.documentNumber,transfer:transfer.documentNumber,asset:asset.code,notification:notification.code,workOrder:wo.code},balances:{A:quantities[locA.id],B:quantities[locB.id]},workOrderStatus:persistedWo.status,notificationStatus:persistedN.status,purchaseOrderStatus:persistedPo.status,steps:Object.keys(state.steps)};
 fs.writeFileSync(dir+'/report.json',JSON.stringify(publicReport,null,2),{mode:0o600});state.complete=true;save();console.log(JSON.stringify(publicReport,null,2));
}
main().catch(e=>{state.lastError=e.message;save();console.error(e.message);process.exitCode=1}).finally(async()=>{for(const role of Object.keys(cookies))try{await http(role,'/api/auth/logout',{});}catch{/* Report is retained even if logout fails. */}await prisma.$disconnect();process.exit(process.exitCode||0);});
