import { db, events } from 'hatchable';
export const access='user';
export const methods=['GET','PUT'];
export default async function(req,res){
 const s=await db.query('SELECT role,active,email FROM app_staff WHERE user_id=$1',[String(req.user.id)]);
 if(!s.rows.length||!s.rows[0].active||s.rows[0].role==='pending')return res.status(403).json({error:'Staff access pending.'});
 if(req.method==='GET'){const r=await db.query("SELECT p.*,d.dcr_no FROM pdc_register p LEFT JOIN dcrs d ON d.id=p.received_dcr_id ORDER BY p.due_date NULLS LAST,p.id DESC LIMIT 5000");return res.json({pdcs:r.rows});}
 if(!['admin','cashier'].includes(s.rows[0].role))return res.status(403).json({error:'Accounting is view-only. Only Cashier or Admin can change PDC status.'});
 const id=Number(req.body?.id),status=String(req.body?.status||''),remarks=String(req.body?.remarks||'');
 if(!['Undeposited','Deposited','Bounced','Cancelled'].includes(status))return res.status(400).json({error:'Invalid PDC status.'});
 const old=await db.query('SELECT * FROM pdc_register WHERE id=$1',[id]);if(!old.rows.length)return res.status(404).json({error:'PDC not found.'});if(old.rows[0].status===status)return res.json({ok:true,pdc:old.rows[0]});
 const r=await db.query('UPDATE pdc_register SET status=$1,updated_at=now() WHERE id=$2 RETURNING *',[status,id]);
 await db.query('INSERT INTO pdc_status_history(pdc_id,old_status,new_status,remarks,changed_by,changed_by_email) VALUES($1,$2,$3,$4,$5,$6)',[id,old.rows[0].status,status,remarks,String(req.user.id),s.rows[0].email]);
 await db.query("INSERT INTO audit_trail(entity_type,entity_id,action,before_data,after_data,actor_id,actor_email) VALUES('pdc',$1,'status_changed',$2::jsonb,$3::jsonb,$4,$5)",[String(id),JSON.stringify(old.rows[0]),JSON.stringify(r.rows[0]),String(req.user.id),s.rows[0].email]);
 await events.publish('dcr','changed',{kind:'pdc_status_changed',id});return res.json({ok:true,pdc:r.rows[0]});
}