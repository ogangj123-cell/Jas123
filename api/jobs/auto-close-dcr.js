import { db, events } from 'hatchable';
export const access = 'scheduler';
export const methods = ['POST'];

const round2 = n => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const sum = (rows, field, filter) => (rows || []).reduce((total, row) => (!filter || filter(row)) ? total + Number(row[field] || 0) : total, 0);
const todayManila = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function closeTotals(state, d) {
  const id = String(d.id);
  const rows = key => (state[key] || []).filter(x => String(x.dcr_id) === id);
  const collections = rows('dcr_collections');
  const pdcEntries = rows('dcr_pdc_entries');
  const deposits = rows('dcr_deposits');
  const cashCounts = rows('cash_counts');
  const cash = round2(sum(collections, 'cash'));
  const checks = round2(sum(collections, 'chk'));
  const pdcReceived = round2(sum(pdcEntries, 'amount'));
  const physicalCash = round2(cashCounts.reduce((v, x) => v + Number(x.denom || 0) * Number(x.pieces || 0), 0) + Number(d.coins || 0) - Number(d.coins_retained || 0));
  const previousDeposit = round2(sum(deposits, 'amount', x => x.kind !== 'pdc'));
  const pdcDeposit = round2(sum(deposits, 'amount', x => x.kind === 'pdc'));
  const recentCollection = round2(cash + checks - pdcReceived);
  const ending = round2(Number(d.beginning_balance || 0) + recentCollection + pdcReceived - previousDeposit - pdcDeposit);
  const pdcOnHand = round2(ending - recentCollection - (Number(d.prev_day_collection || 0) - previousDeposit));
  const registerBalance = round2((state.pdc_register || []).filter(x => x.status === 'Undeposited').reduce((v, x) => v + Number(x.amount || 0), 0));
  const totalDeposit = round2(previousDeposit + pdcDeposit);
  return { ending, pdcOnHand, registerBalance, tieout: round2(pdcOnHand - registerBalance), totalCollection: round2(cash + checks), totalDeposit, recentCollection };
}

export default async function(req, res) {
  const today = todayManila();
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await db.query('SELECT revision, state FROM dcr_workspace WHERE id = 1');
    if (!current.rows.length) return res.status(404).json({ error: 'DCR workspace is not initialized.' });
    const revision = Number(current.rows[0].revision);
    const state = current.rows[0].state || {};
    const records = Array.isArray(state.dcr_records) ? state.dcr_records : [];
    const due = records.filter(d => d.status === 'open' && d.date_covered && d.date_covered < today);
    if (!due.length) return res.json({ ok: true, date_manila: today, closed_count: 0, message: 'No open DCRs from a previous date.' });
    const next = { ...state, dcr_records: [...records], dcr_log: [...(state.dcr_log || [])], audit_trail: [...(state.audit_trail || [])] };
    const closedAt = new Date().toISOString();
    const closedIds = [];
    for (const d of due) {
      const t = closeTotals(next, d);
      Object.assign(d, { status: 'closed', closed_at: closedAt, closed_by: 'system:auto-close', ending_balance: t.ending, total_collection: t.totalCollection, total_deposit: t.totalDeposit, pdc_balance_at_closing: t.registerBalance, pdc_tieout_per_dcr: t.pdcOnHand, pdc_tieout_diff: t.tieout });
      const log = { dcr_id: d.id, date_covered: d.date_covered, dcr_no: d.dcr_no, total_collections: t.totalCollection, total_deposits: t.totalDeposit, next_day_collections: t.recentCollection, pdc_undeposited: t.registerBalance, ending_balance: t.ending, logged_at: closedAt };
      const ix = next.dcr_log.findIndex(x => String(x.dcr_id) === String(d.id));
      if (ix < 0) next.dcr_log.push(log); else next.dcr_log[ix] = log;
      next.audit_trail.push({ id: 'auto-close-' + String(d.id) + '-' + closedAt, at: closedAt, action: 'auto_close', dcr_id: d.id, reason: 'Automatically closed at the end of the DCR date (Philippines time).', detail: t });
      closedIds.push({ id: d.id, dcr_no: d.dcr_no, date_covered: d.date_covered });
    }
    const saved = await db.query('UPDATE dcr_workspace SET state = $1::jsonb, revision = revision + 1, updated_at = now(), updated_by = $2 WHERE id = 1 AND revision = $3 RETURNING revision', [JSON.stringify(next), 'system:auto-close', revision]);
    if (saved.rows.length) {
      await events.publish('dcr', 'changed', { kind: 'dcr_auto_closed', ids: closedIds.map(x => x.id) });
      return res.json({ ok: true, date_manila: today, closed_count: closedIds.length, closed: closedIds, revision: saved.rows[0].revision });
    }
  }
  return res.status(409).json({ error: 'Workspace changed during auto-close. The next scheduled run will retry.' });
}