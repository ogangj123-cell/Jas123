import { db, events } from 'hatchable';
export const access='user';
export const methods=['GET','PUT'];
async function staffFor(user){const r=await db.query('SELECT role,active FROM app_staff WHERE user_id=$1',[String(user.id)]);return r.rows[0]&&r.rows[0].active&&r.rows[0].role!=='pending'?r.rows[0]:null}
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const sections=['pdc_register','pdc_status_history','dcr_log','audit_trail','dcr_records','dcr_collections','dcr_pdc_entries','dcr_deposits','cash_counts','dcr_checks'];
const childSections=['dcr_collections','dcr_pdc_entries','dcr_deposits','cash_counts','dcr_checks'];
function mergeRows(base,incoming,current,key){
 const bm=new Map((base||[]).map(x=>[String(x[key]),x])),im=new Map((incoming||[]).map(x=>[String(x[key]),x])),cm=new Map((current||[]).map(x=>[String(x[key]),x]));
 const out=new Map(cm),ids=new Set([...bm.keys(),...im.keys()]);
 for(const id of ids){
  const before=bm.get(id),after=im.get(id),now=cm.get(id);
  if(same(before,after))continue;
  if(!same(before,now))throw new Error('A record you edited was also changed by another user. Reload the latest record and reapply your change.');
  if(after===undefined)out.delete(id);else out.set(id,after);
 }
 return [...out.values()];
}
export default async function(req,res){
 const staff=await staffFor(req.user);if(!staff)return res.status(403).json({error:'Approved staff access required.'});
 if(req.method==='GET'){const r=await db.query('SELECT revision,state,updated_at FROM dcr_workspace WHERE id=1');if(!r.rows.length)return res.status(404).json({error:'DCR workspace is not initialized.'});return res.json(r.rows[0])}
 if(staff.role==='accounting')return res.status(403).json({error:'Accounting access is view-only. Changes are disabled.'});
 if(!['admin','cashier'].includes(staff.role))return res.status(403).json({error:'Not permitted.'});
 const b=req.body||{},revision=Number(b.revision),incoming=b.state,base=b.base_state;
 if(!Number.isInteger(revision)||!incoming||typeof incoming!=='object'||Array.isArray(incoming)||!base||typeof base!=='object'||Array.isArray(base))return res.status(400).json({error:'Workspace state, base snapshot and revision are required.'});
 for(const k of sections)if(!Array.isArray(incoming[k])||!Array.isArray(base[k]))return res.status(400).json({error:'Invalid workspace section: '+k});
 for(let attempt=0;attempt<4;attempt++){
  const old=await db.query('SELECT revision,state FROM dcr_workspace WHERE id=1');if(!old.rows.length)return res.status(404).json({error:'Workspace missing.'});
  const current=old.rows[0].state||{},currentRev=Number(old.rows[0].revision);let next;
  try{
   next={...current};
   for(const k of sections)next[k]=mergeRows(base[k],incoming[k],current[k]||[],'id');
  }catch(e){return res.status(409).json({error:e.message})}
  if(staff.role==='cashier'){
   // Cashiers may generate new audit/status entries through normal actions, but may never alter or remove an existing history row.
   for(const k of ['pdc_status_history','dcr_log','audit_trail']){
    const oldRows=current[k]||[],newRows=next[k]||[];
    for(const row of oldRows){const updated=newRows.find(x=>String(x.id)===String(row.id));if(!updated||!same(row,updated))return res.status(403).json({error:'Cashier cannot modify or delete existing '+k+' records.'});}
   }
   const oldDcr=current.dcr_records||[],newDcr=next.dcr_records||[];
   for(const d of oldDcr){const n=newDcr.find(x=>String(x.id)===String(d.id));if(!n)return res.status(403).json({error:'Cashier cannot delete DCR records.'});if(d.status==='closed'&&!same(d,n))return res.status(403).json({error:'Closed DCRs are locked and cannot be edited by Cashier.'});}
   for(const k of childSections){
    const oldRows=current[k]||[],newRows=next[k]||[];
    for(const x of oldRows){const d=oldDcr.find(v=>String(v.id)===String(x.dcr_id));if(d?.status==='closed'){const nx=newRows.find(v=>String(v.id)===String(x.id));if(!nx||!same(x,nx))return res.status(403).json({error:'Details belonging to a closed DCR cannot be edited or deleted.'});}}
    for(const x of newRows){const d=newDcr.find(v=>String(v.id)===String(x.dcr_id));if(!d)return res.status(400).json({error:'Every DCR detail must belong to an existing DCR.'});if(d.status==='closed'&&!(oldRows||[]).some(v=>String(v.id)===String(x.id)))return res.status(403).json({error:'Cannot add details to a closed DCR.'});}
   }
   const prior=current.pdc_register||[],now=next.pdc_register||[];
   for(const x of prior)if(!now.some(v=>String(v.id)===String(x.id)))return res.status(403).json({error:'Cashier cannot delete PDC register entries. Use a status update instead.'});
  }
  const saved=await db.query('UPDATE dcr_workspace SET state=$1::jsonb,revision=revision+1,updated_at=now(),updated_by=$2 WHERE id=1 AND revision=$3 RETURNING revision,updated_at',[JSON.stringify(next),String(req.user.id),currentRev]);
  if(saved.rows.length){await events.publish('dcr','changed',{kind:'workspace_saved',revision:saved.rows[0].revision});return res.json({ok:true,revision:saved.rows[0].revision,updated_at:saved.rows[0].updated_at,state:next});}
 }
 return res.status(409).json({error:'The workspace is busy with other saves. Please retry; your local changes have not been discarded.'});
}