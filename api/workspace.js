import { db, events } from 'hatchable';
export const access='user';
export const methods=['GET','PUT'];
async function staffFor(user){const r=await db.query('SELECT role,active FROM app_staff WHERE user_id=$1',[String(user.id)]);return r.rows[0]&&r.rows[0].active&&r.rows[0].role!=='pending'?r.rows[0]:null}
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const sections=['pdc_register','pdc_status_history','dcr_log','audit_trail','dcr_records','dcr_collections','dcr_pdc_entries','dcr_deposits','cash_counts','dcr_checks'];
const childSections=['dcr_collections','dcr_pdc_entries','dcr_deposits','cash_counts','dcr_checks'];
export default async function(req,res){
 const staff=await staffFor(req.user);if(!staff)return res.status(403).json({error:'Approved staff access required.'});
 if(req.method==='GET'){const r=await db.query('SELECT revision,state,updated_at FROM dcr_workspace WHERE id=1');if(!r.rows.length)return res.status(404).json({error:'DCR workspace is not initialized.'});return res.json(r.rows[0])}
 if(staff.role==='accounting')return res.status(403).json({error:'Accounting access is view-only. Changes are disabled.'});
 if(!['admin','cashier'].includes(staff.role))return res.status(403).json({error:'Not permitted.'});
 const b=req.body||{},revision=Number(b.revision),state=b.state;if(!Number.isInteger(revision)||!state||typeof state!=='object'||Array.isArray(state))return res.status(400).json({error:'Workspace state and revision are required.'});
 for(const k of sections)if(!Array.isArray(state[k]))return res.status(400).json({error:'Invalid workspace section: '+k});
 const old=await db.query('SELECT revision,state FROM dcr_workspace WHERE id=1');if(!old.rows.length)return res.status(404).json({error:'Workspace missing.'});if(Number(old.rows[0].revision)!==revision)return res.status(409).json({error:'Another staff member saved changes first. Refresh and reconcile before continuing.'});
 const prev=old.rows[0].state||{},next={...state};
 if(staff.role==='cashier'){
  // Cashier may operate DCR and PDC records only; audit/security/configuration data stays server-owned.
  for(const k of ['pdc_status_history','dcr_log','audit_trail'])if(!same(prev[k]||[],state[k]||[]))return res.status(403).json({error:'Cashier cannot edit audit history or administrative records.'});
  const oldDcr=prev.dcr_records||[],newDcr=state.dcr_records||[];
  for(const d of oldDcr){
   const n=newDcr.find(x=>String(x.id)===String(d.id));
   if(!n)return res.status(403).json({error:'Cashier cannot delete DCR records.'});
   if(d.status==='closed'&&!same(d,n))return res.status(403).json({error:'Closed DCRs are locked and cannot be edited by Cashier.'});
  }
  const allDcr=[...oldDcr,...newDcr];
  for(const k of childSections){
   const oldRows=prev[k]||[],newRows=state[k]||[];
   for(const x of oldRows){
    const d=oldDcr.find(v=>String(v.id)===String(x.dcr_id));
    if(d?.status==='closed'){
     const nx=newRows.find(v=>String(v.id)===String(x.id));
     if(!nx||!same(x,nx))return res.status(403).json({error:'Details belonging to a closed DCR cannot be edited or deleted.'});
    }
   }
   for(const x of newRows){
    const d=newDcr.find(v=>String(v.id)===String(x.dcr_id));
    if(!d)return res.status(400).json({error:'Every DCR detail must belong to an existing DCR.'});
    if(d.status==='closed'&&!oldRows.some(v=>String(v.id)===String(x.id)))return res.status(403).json({error:'Cannot add details to a closed DCR.'});
   }
  }
  const prior=prev.pdc_register||[],now=state.pdc_register||[];
  for(const x of prior){const n=now.find(v=>String(v.id)===String(x.id));if(!n)return res.status(403).json({error:'Cashier cannot delete PDC register entries. Use a status update instead.'});}
  // Cashier cannot rewrite existing audit metadata, but may update operational PDC fields.
  next.pdc_status_history=prev.pdc_status_history||[];
  next.dcr_log=prev.dcr_log||[];
  next.audit_trail=prev.audit_trail||[];
 }
 const saved=await db.query('UPDATE dcr_workspace SET state=$1::jsonb,revision=revision+1,updated_at=now(),updated_by=$2 WHERE id=1 AND revision=$3 RETURNING revision,updated_at',[JSON.stringify(next),String(req.user.id),revision]);
 if(!saved.rows.length)return res.status(409).json({error:'Another staff member saved changes first. Refresh and reconcile before continuing.'});
 await events.publish('dcr','changed',{kind:'workspace_saved',revision:saved.rows[0].revision});
 return res.json({ok:true,revision:saved.rows[0].revision,updated_at:saved.rows[0].updated_at});
}