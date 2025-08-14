const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/pokerclub'
});

async function init() {
  const fs = require('fs');
  const path = require('path');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

async function getUser(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
  return rows[0] || null;
}

async function upsertUser({ id, name, chips }) {
  await pool.query(
    `INSERT INTO users(id,name,chips) VALUES($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, chips=EXCLUDED.chips`,
    [id, name, chips]
  );
}

async function updateUserChips(id, chips) {
  await pool.query('UPDATE users SET chips=$2 WHERE id=$1', [id, chips]);
}

async function saveTable(table) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateJson = JSON.stringify(serializeState(table));
    await client.query(
      `INSERT INTO tables(id, owner_id, name, variant, max_seats, speed, straddle_mode, blind_levels, hand_no, state)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb)
       ON CONFLICT (id) DO UPDATE SET owner_id=$2, name=$3, variant=$4, max_seats=$5, speed=$6, straddle_mode=$7, blind_levels=$8::jsonb, hand_no=$9, state=$10::jsonb`,
      [table.id, table.ownerId, table.name, table.variant, table.maxSeats, table.speed || 'SLOW', table.straddleMode || null, JSON.stringify(table.blindLevels||[]), table.handNo||0, stateJson]
    );
    // Upsert players
    for (const p of table.players.values()) {
      await client.query(
        `INSERT INTO players(table_id,user_id,seat,sitting,stack,folded,all_in,round_committed,total_committed,timebanks,cards)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (table_id,user_id) DO UPDATE SET seat=$3,sitting=$4,stack=$5,folded=$6,all_in=$7,round_committed=$8,total_committed=$9,timebanks=$10,cards=$11`,
        [table.id, p.userId, p.seat, !!p.sitting, p.stack|0, !!p.folded, !!p.allIn, p.roundCommitted|0, p.totalCommitted|0, (p.timebanks ?? 3)|0, p.cards||[]]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('saveTable failed', e);
  } finally {
    client.release();
  }
}

async function loadTables() {
  const { rows } = await pool.query('SELECT * FROM tables ORDER BY created_at');
  const res = [];
  for (const t of rows) {
    const players = await pool.query('SELECT * FROM players WHERE table_id=$1', [t.id]);
    res.push({ table: t, players: players.rows });
  }
  return res;
}

function serializeState(table) {
  // Persist only serializable parts
  return {
    state: table.state,
    board: table.state.board,
    pots: table.state.pots,
    dealerSeat: table.state.dealerSeat,
    toAct: table.state.toAct,
    phase: table.state.phase,
    round: table.state.round,
    toCall: table.state.toCall,
    minRaise: table.state.minRaise,
    timerDeadline: table.state.timerDeadline || null,
    deck: table._deck || [],
    burns: table._burns || [],
    discards: table._discards || [],
    drawPending: table.state.drawPending || null,
    currentSeat: table.state.currentSeat || null
  };
}

module.exports = {
  pool, init, getUser, upsertUser, updateUserChips, saveTable, loadTables
};


async function startHandHistory(table){
  const { rows } = await pool.query(
    `INSERT INTO hands(table_id, hand_no, variant) VALUES($1,$2,$3) RETURNING id`,
    [table.id, table.handNo||0, table.variant]
  );
  return rows[0].id;
}

async function recordAction(handId, evt){
  await pool.query(
    `INSERT INTO actions(hand_id, user_id, seat, street, action, amount, info) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [handId, evt.userId||null, evt.seat??null, evt.street||null, evt.action, evt.amount??null, JSON.stringify(evt.info||{})]
  );
}

async function finishHand(handId, board, pots, winners){
  await pool.query(
    `UPDATE hands SET ended_at=NOW(), board=$2, pots=$3::jsonb, winners=$4::jsonb WHERE id=$1`,
    [handId, board||[], JSON.stringify(pots||[]), JSON.stringify(winners||[])]
  );
}

module.exports.startHandHistory = startHandHistory;
module.exports.recordAction = recordAction;
module.exports.finishHand = finishHand;


async function listHandsByTable(tableId, limit=50, offset=0){
  const { rows } = await pool.query(
    `SELECT id, table_id, hand_no, variant, started_at, ended_at, board, pots, winners
     FROM hands WHERE table_id=$1 ORDER BY id DESC LIMIT $2 OFFSET $3`,
    [tableId, limit, offset]
  );
  return rows;
}

async function listActions(handId){
  const { rows } = await pool.query(
    `SELECT id, hand_id, at, user_id, seat, street, action, amount, info
     FROM actions WHERE hand_id=$1 ORDER BY id ASC`, [handId]
  );
  return rows;
}

module.exports.listHandsByTable = listHandsByTable;
module.exports.listActions = listActions;


function uuidLike(){ return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c){ const r=Math.random()*16|0, v=c=='x'?r:(r&0x3|0x8); return v.toString(16); }); }

async function createInvite(tableId, expiresSec=604800, maxUses=100){
  const token = uuidLike();
  const expiresAt = expiresSec ? new Date(Date.now() + expiresSec*1000) : null;
  await pool.query(
    `INSERT INTO invites(token, table_id, expires_at, max_uses, used_count) VALUES($1,$2,$3,$4,0)`,
    [token, tableId, expiresAt, maxUses]
  );
  return token;
}

async function resolveInvite(token){
  const { rows } = await pool.query(`SELECT * FROM invites WHERE token=$1`, [token]);
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return { expired: true };
  if (row.used_count >= row.max_uses) return { exhausted: true };
  return row;
}

async function consumeInvite(token){
  await pool.query(`UPDATE invites SET used_count=used_count+1 WHERE token=$1`, [token]);
}

module.exports.createInvite = createInvite;
module.exports.resolveInvite = resolveInvite;
module.exports.consumeInvite = consumeInvite;
