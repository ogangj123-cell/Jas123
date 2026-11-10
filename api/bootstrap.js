import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET'];
export default async function(req,res) {
  const u=req.user, email=String(u.email||'').trim().toLowerCase();
  if(!email) return res.status(400).json({error:'Account email unavailable.'});
  await db.query("INSERT INTO app_staff(user_id,email,display_name,role) VALUES($1,$2,$3,'pending') ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,updated_at=now()",[String(u.id),email,String(u.name||u.display_name||email.split('@')[0])]);
  const admins=await db.query("SELECT count(*)::int AS n FROM app_staff WHERE role='admin' AND active=true");
  if(Number(admins.rows[0].n)===0) await db.query("UPDATE app_staff SET role='admin',updated_at=now() WHERE user_id=$1",[String(u.id)]);
  const staff=await db.query('SELECT user_id,email,display_name,role,active FROM app_staff WHERE user_id=$1',[String(u.id)]);
  const dcr=await db.query("SELECT d.*,COALESCE(sum(t.amount) FILTER(WHERE t.voided_at IS NULL),0) AS transaction_total FROM dcrs d LEFT JOIN dcr_transactions t ON t.dcr_id=d.id GROUP BY d.id ORDER BY d.date_covered DESC,d.id DESC LIMIT 200");
  const totals=await db.query("SELECT transaction_type,COALESCE(sum(amount),0) AS total,count(*) AS count FROM dcr_transactions WHERE voided_at IS NULL GROUP BY transaction_type");
  const pdc=await db.query("SELECT count(*)::int AS count,COALESCE(sum(amount),0) AS amount FROM pdc_register WHERE status='Undeposited'");
  res.json({staff:staff.rows[0],dcrs:dcr.rows,totals:totals.rows,pdc_undeposited:pdc.rows[0]});
}