import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const s=await db.query('SELECT role,active FROM app_staff WHERE user_id=$1',[String(req.user.id)]);
 if(!s.rows.length||!s.rows[0].active||!['admin','accounting'].includes(s.rows[0].role))return res.status(403).json({error:'Audit-view access required.'});
 const r=await db.query('SELECT * FROM audit_trail ORDER BY created_at DESC,id DESC LIMIT 1000');
 return res.json({entries:r.rows});
}