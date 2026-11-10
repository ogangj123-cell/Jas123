import { db, events } from 'hatchable';
export const access='user';
export const methods=['GET','POST','PUT'];
async function staffFor(u){const r=await db.query('SELECT role,active,email,display_name FROM app_staff WHERE user_id=$1',[String(u.id)]);return r.rows[0]||null;}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:null;}
export default async function(req,res){
 const a=await staffFor(req.user);
 if(!a||!a.active||a.role==='pending')return res.status(403).json({error:'Approved staff access required.'});
 if(req.method==='GET'){const q=String(req.query?.q||'').trim();const r=await db.query("SELECT d.*,COALESCE(sum(t.amount) FILTER(WHERE t.voided_at IS NULL),0) AS transaction_total FROM dcrs d LEFT JOIN dcr_transactions t ON t.dcr_id=d.id WHERE ($1='' OR d.dcr_no ILIKE '%'||$1||'%' OR d.prepared_by ILIKE '%'||$1||'%') GROUP BY d.id ORDER BY d.date_covered DESC,d.id DESC LIMIT 200",[q]);return res.json({dcrs:r.rows});}
 if(req.method==='POST'){
  if(!['admin','cashier'].includes(a.role))return res.status(403).json({error:'Accounting is view-only. Only Cashier or Admin can create a DCR.'});
  const b=req.body||{},no=String(b.dcr_no||'').trim(),date=String(b.date_covered||'').trim(),begin=money(b.beginning_balance??0);
  if(!no||!date||begin===null)return res.status(400).json({error:'DCR number, date and valid beginning balance are required.'});
  try{const r=await db.query("INSERT INTO dcrs(dcr_no,date_covered,prepared_by,beginning_balance,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5) RETURNING *",[no,date,String(b.prepared_by||a.display_name),begin,String(req.user.id)]);
   await db.query("INSERT INTO audit_trail(entity_type,entity_id,action,after_data,actor_id,actor_email) VALUES('dcr',$1,'created',$2::jsonb,$3,$4)",[String(r.rows[0].id),JSON.stringify(r.rows[0]),String(req.user.id),a.email]);
   await events.publish('dcr','changed',{kind:'dcr_created',id:r.rows[0].id});return res.status(201).json({dcr:r.rows[0]});
  }catch(e){return res.status(409).json({error:'DCR number may already exist, or the date is invalid.'});}
 }
 if(req.method==='PUT'){
  if(!['admin','cashier'].includes(a.role))return res.status(403).json({error:'Accounting is view-only. Only Cashier or Admin can close a DCR.'});
  const id=Number(req.body?.id),old=await db.query('SELECT * FROM dcrs WHERE id=$1',[id]);if(!old.rows.length)return res.status(404).json({error:'DCR not found.'});if(old.rows[0].status==='closed')return res.status(409).json({error:'This DCR is already closed. Its closing snapshot is locked.'});
  const closing=Number(req.body?.closing_balance);if(!Number.isFinite(closing)||closing<0)return res.status(400).json({error:'Enter the verified closing balance before closing this DCR.'});
  const pdc=await db.query("SELECT COALESCE(sum(amount),0) AS total FROM pdc_register WHERE status='Undeposited'"),tieout=Number(req.body?.tieout??0);if(!Number.isFinite(tieout))return res.status(400).json({error:'Enter a valid tie-out amount.'});
  const r=await db.query("UPDATE dcrs SET status='closed',closing_balance=$1,pdc_balance_at_closing=$2,tieout_at_closing=$3,closed_at=now(),closed_by=$4,updated_at=now(),updated_by=$4 WHERE id=$5 AND status='open' RETURNING *",[closing,Number(pdc.rows[0].total),tieout,String(req.user.id),id]);
  await db.query("INSERT INTO audit_trail(entity_type,entity_id,action,before_data,after_data,actor_id,actor_email) VALUES('dcr',$1,'closed',$2::jsonb,$3::jsonb,$4,$5)",[String(id),JSON.stringify(old.rows[0]),JSON.stringify(r.rows[0]),String(req.user.id),a.email]);
  await events.publish('dcr','changed',{kind:'dcr_closed',id});return res.json({dcr:r.rows[0]});
 }
}