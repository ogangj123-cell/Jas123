import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const s=await db.query('SELECT role,active FROM app_staff WHERE user_id=$1',[String(req.user.id)]);
 if(!s.rows.length||!s.rows[0].active||s.rows[0].role==='pending') return res.status(403).json({error:'Staff access pending.'});
 const id=Number(req.query?.id); if(!id) return res.status(400).json({error:'DCR id required.'});
 const d=await db.query('SELECT * FROM dcrs WHERE id=$1',[id]); if(!d.rows.length)return res.status(404).json({error:'DCR not found.'});
 const [c,p,dep,cc,tx]=await Promise.all([
  db.query('SELECT * FROM dcr_collections WHERE dcr_id=$1 ORDER BY id',[id]),
  db.query('SELECT * FROM dcr_pdc_entries WHERE dcr_id=$1 ORDER BY id',[id]),
  db.query('SELECT * FROM dcr_deposits WHERE dcr_id=$1 ORDER BY id',[id]),
  db.query('SELECT * FROM dcr_cash_counts WHERE dcr_id=$1 ORDER BY denom DESC',[id]),
  db.query('SELECT * FROM dcr_transactions WHERE dcr_id=$1 AND voided_at IS NULL ORDER BY transaction_date,id',[id])
 ]);
 return res.json({dcr:d.rows[0],collections:c.rows,pdc_entries:p.rows,deposits:dep.rows,cash_counts:cc.rows,transactions:tx.rows});
}