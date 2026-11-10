import { db } from 'hatchable';
export const access='user';
export const methods=['GET','PUT'];
export default async function(req,res){
 const me=await db.query('SELECT role,active FROM app_staff WHERE user_id=$1',[String(req.user.id)]);
 if(!me.rows.length||me.rows[0].role!=='admin'||!me.rows[0].active) return res.status(403).json({error:'Administrator access required.'});
 if(req.method==='GET'){const r=await db.query('SELECT user_id,email,display_name,role,active,created_at FROM app_staff ORDER BY created_at');return res.json({staff:r.rows});}
 const b=req.body||{},id=String(b.user_id||''),role=String(b.role||'');
 if(!id||!['pending','cashier','accounting','admin'].includes(role)) return res.status(400).json({error:'Invalid staff update.'});
 if(id===String(req.user.id)&&role!=='admin') return res.status(400).json({error:'You cannot remove your own administrator role.'});
 await db.query('UPDATE app_staff SET role=$1,active=$2,updated_at=now() WHERE user_id=$3',[role,b.active!==false,id]);
 const r=await db.query('SELECT user_id,email,display_name,role,active FROM app_staff WHERE user_id=$1',[id]);
 return res.json({staff:r.rows[0]});
}