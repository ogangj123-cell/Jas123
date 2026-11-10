import { db, events } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const r=await db.query("SELECT role,active FROM app_staff WHERE user_id=$1",[String(req.user.id)]);
 if(!r.rows.length||!r.rows[0].active||r.rows[0].role==='pending') return res.status(403).json({error:'Staff access pending.'});
 res.json(await events.grant(['dcr']));
}