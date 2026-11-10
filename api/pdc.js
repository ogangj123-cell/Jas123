import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const s=await db.query('SELECT role,active FROM app_staff WHERE user_id=$1',[String(req.user.id)]);
 if(!s.rows.length||!s.rows[0].active||s.rows[0].role==='pending') return res.status(403).json({error:'Staff access pending.'});
 const r=await db.query("SELECT p.*,d.dcr_no FROM pdc_register p LEFT JOIN dcrs d ON d.id=p.received_dcr_id ORDER BY p.due_date NULLS LAST,p.id DESC LIMIT 1000");
 res.json({pdcs:r.rows});
}