import { Router } from "express";
import { pool } from '../services/db.js';
import { logActivity, LogSources, LogLevels } from '../services/logger.js';
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function getUserDetails(userId) {
  try {
    const r = await pool.query(
      `SELECT p.name, p.email FROM profiles p WHERE p.id = $1`, [userId]
    );
    if (r.rows.length > 0) {
      const roles = await pool.query(
        `SELECT role FROM user_roles WHERE user_id = $1`, [userId]
      );
      const role = roles.rows.some(x => x.role === 'admin') ? 'admin' : (roles.rows[0]?.role || null);
      return { userName: r.rows[0].name, email: r.rows[0].email, role };
    }
  } catch {}
  return {};
}

/**
 * Checks that the SQL string is a safe SELECT-only statement.
 * Blocks any DDL, DML, or system-level commands.
 */
function isSafeSelectQuery(sql) {
  if (!sql || typeof sql !== 'string') return false;
  const normalized = sql.trim().toUpperCase();

  // Must start with SELECT
  if (!normalized.startsWith('SELECT')) return false;

  // Block dangerous keywords (word-boundary matched)
  const dangerous = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'TRUNCATE', 'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'COPY',
    'PG_READ_FILE', 'PG_LS_DIR', 'LO_IMPORT', 'LO_EXPORT',
    'PG_SLEEP', 'DBLINK', 'PG_STAT_FILE'
  ];
  for (const kw of dangerous) {
    if (new RegExp(`\\b${kw}\\b`).test(normalized)) {
      console.warn(`[CHAT] SQL blocked — contains forbidden keyword: ${kw}`);
      return false;
    }
  }
  return true;
}

/**
 * Ensures the SQL query has a LIMIT clause.
 * Appends LIMIT 100 if none is present.
 */
function ensureLimit(sql, maxRows = 100) {
  const clean = sql.trim().replace(/;$/, '');
  if (!/\bLIMIT\b/i.test(clean)) {
    return `${clean} LIMIT ${maxRows}`;
  }
  return clean;
}

/**
 * Uses fast PostgreSQL statistics (pg_class.reltuples) to estimate row count.
 * Returns in < 1ms even for tables with 40M+ rows.
 */
async function getFastRowCount(tableName) {
  try {
    const result = await pool.query(
      `SELECT reltuples::bigint AS cnt
       FROM pg_class
       WHERE oid = ('data_mart."' || $1 || '"')::regclass`,
      [tableName]
    );
    const cnt = parseInt(result.rows[0]?.cnt);
    // reltuples can be -1 for unanalyzed tables — fall back to real COUNT
    if (cnt === undefined || cnt === null || cnt < 0) {
      const real = await pool.query(
        `SELECT COUNT(*) AS cnt FROM data_mart."${tableName}"`
      );
      return parseInt(real.rows[0]?.cnt || 0);
    }
    return cnt;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

router.use(requireAuth);

// ─────────────────────────────────────────────
// Simple metadata question fast-path
// ─────────────────────────────────────────────

const METADATA_PATTERNS = [
  { regex: /how many colum|number of colum|column count|list colum|what are the colum|show colum|table colum/i, type: 'columns' },
  { regex: /how many rows|row count|total rows|number of records|table size|how many records|total records/i, type: 'row_count' },
  { regex: /describe table|table schema|table structure|table info|schema info|show schema/i, type: 'schema' },
  { regex: /what is the table|table name|what table|which table/i, type: 'table_name' },
  { regex: /what data type|data type|column type|column datatype|types of colum/i, type: 'data_types' },
  { regex: /sample data|show.*sample|preview data|show.*data.*table|show.*first.*rows|give me.*data|some.*rows|show data|show rows|display data|show.*record/i, type: 'sample_data' },
];

async function handleMetadataQuestion(tableName, questionType) {
  if (questionType === 'columns') {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'data_mart' AND table_name = $1
       ORDER BY ordinal_position`, [tableName]
    );
    const names = r.rows.map(r => r.column_name);
    return {
      direct: true,
      content: `The table **${tableName}** has **${names.length} columns**:\n\n` +
        names.map((n, i) => `${i + 1}. \`${n}\``).join('\n')
    };
  }

  if (questionType === 'row_count') {
    const r = await pool.query(`SELECT COUNT(*) AS cnt FROM data_mart."${tableName}"`);
    const cnt = parseInt(r.rows[0]?.cnt || "0");
    return {
      direct: true,
      content: `The table **${tableName}** has **${cnt.toLocaleString()}** rows.`
    };
  }

  if (questionType === 'schema') {
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'data_mart' AND table_name = $1
       ORDER BY ordinal_position`, [tableName]
    );
    const lines = cols.rows.map(c =>
      `- \`${c.column_name}\` — ${c.data_type}${c.is_nullable === 'YES' ? ' (nullable)' : ''}`
    );
    return {
      direct: true,
      content: `### Schema for **${tableName}**\n\n${lines.join('\n')}`
    };
  }

  if (questionType === 'table_name') {
    return {
      direct: true,
      content: `You are currently querying the **${tableName}** table.`
    };
  }

  if (questionType === 'data_types') {
    const cols = await pool.query(
      `SELECT column_name, data_type, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = 'data_mart' AND table_name = $1
       ORDER BY ordinal_position`, [tableName]
    );
    const lines = cols.rows.map(c =>
      `- \`${c.column_name}\`: ${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ''}`
    );
    return {
      direct: true,
      content: `### Column Data Types for **${tableName}**\n\n${lines.join('\n')}`
    };
  }

  if (questionType === 'sample_data') {
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'data_mart' AND table_name = $1
       ORDER BY ordinal_position`, [tableName]
    );
    const headerRow = cols.rows.map(c => c.column_name).join(' | ');
    const separator = cols.rows.map(() => '---').join(' | ');

    const data = await pool.query(`SELECT * FROM data_mart."${tableName}" LIMIT 5`);
    const dataRows = data.rows.map(row =>
      cols.rows.map(c => {
        const val = row[c.column_name];
        if (val === null || val === undefined) return '';
        const s = String(val);
        return s.length > 40 ? s.slice(0, 40) + '...' : s;
      }).join(' | ')
    );

    return {
      direct: true,
      content: `### Sample Data from **${tableName}**\n\n| ${headerRow} |\n| ${separator} |\n${dataRows.map(r => `| ${r} |`).join('\n')}`
    };
  }

  return null;
}

// ── Streaming Chat Endpoint (SSE) ──
router.post("/stream", async (req, res) => {
  const { messages, dataMartId, fileData } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required" });
  }
  if (!dataMartId) {
    return res.status(400).json({ error: "dataMartId is required" });
  }

  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendSSE = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const sendError = (msg) => {
    sendSSE({ error: msg });
    res.end();
  };

  try {
    let dataMartInfo = null;
    let dataMartData = null;
    let queryResult  = null;
    let tableName    = dataMartId;
    let dataMartName = dataMartId;

    // Step 1: Resolve data mart name
    if (dataMartId === 'file') {
      dataMartInfo = { name: fileData?.name || 'Uploaded File', description: 'User uploaded file for analysis' };
      dataMartName = fileData?.name || 'Uploaded File';
    } else {
      try {
        const dmResult = await pool.query(
          "SELECT id, name, description FROM data_marts WHERE id = $1 OR name = $1 LIMIT 1", [dataMartId]
        );
        if (dmResult.rows.length > 0) {
          dataMartInfo = dmResult.rows[0];
          dataMartName = dmResult.rows[0].name;
          tableName    = dmResult.rows[0].name;
        }
      } catch { tableName = dataMartId; dataMartName = dataMartId; }
    }

    // Fast-path: check for simple metadata questions (skip entire AI pipeline)
    if (dataMartId !== 'file' && tableName) {
      for (const pattern of METADATA_PATTERNS) {
        if (pattern.regex.test(lastUserMessage)) {
          const result = await handleMetadataQuestion(tableName, pattern.type);
          if (result) {
            const tokens = result.content.split(/(\s+)/);
            for (const token of tokens) {
              sendSSE({ token });
            }
            sendSSE({ done: true });
            res.end();
            return;
          }
        }
      }
    }

    // Step 2: Get user assignments
    let userAssignmentsResult;
    try {
      userAssignmentsResult = await pool.query(
        `SELECT dm.id, dm.name, dm.description FROM user_data_mart_assignments udma
         LEFT JOIN data_marts dm ON dm.id::text = udma.data_mart_id::text OR dm.name = udma.data_mart_id
         WHERE udma.user_id = $1`, [req.userId]
      );
    } catch { userAssignmentsResult = { rows: [] }; }

    // Step 3: File upload path
    let cleanFileData = null;
    if (dataMartId === 'file') {
      if (!fileData?.data || !Array.isArray(fileData.data) || fileData.data.length === 0) {
        sendError('No data found in the uploaded file.');
        return;
      }
      cleanFileData = { name: fileData.name, headers: fileData.headers, data: fileData.data.slice(0, 50), totalRows: fileData.totalRows || fileData.data.length };
    }

    // Step 4: Data Mart path — Text-to-SQL pipeline
    if (dataMartId !== 'file' && tableName) {
      const allowed = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'data_mart' AND table_name = $1`, [tableName]
      );
      if (allowed.rows.length === 0) {
        sendError('Data mart table not found or access denied');
        return;
      }

      const colsResult = await pool.query(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_schema = 'data_mart' AND table_name = $1 ORDER BY ordinal_position`, [tableName]
      );
      const columns = colsResult.rows;
      const rowCount = await getFastRowCount(tableName);
      const sampleResult = await pool.query(`SELECT * FROM data_mart."${tableName}" LIMIT 3`);

      let generatedSql = null;
      try {
        const sqlGenResp = await fetch(`${AI_SERVICE_URL}/api/sql-gen`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: lastUserMessage, table_name: tableName, columns, sample_rows: sampleResult.rows, total_rows: rowCount, conversation_history: messages.slice(-6) }),
          signal: AbortSignal.timeout(300000)
        });
        if (sqlGenResp.ok) {
          const sqlData = await sqlGenResp.json();
          generatedSql = sqlData.sql || null;
        }
      } catch (e) { console.error(`[CHAT] SQL generation failed: ${e.message}`); }

      if (generatedSql && isSafeSelectQuery(generatedSql)) {
        const safeSql = ensureLimit(generatedSql, 100);
        const client = await pool.connect();
        try {
          await client.query('SET statement_timeout = 30000');
          const execResult = await client.query(safeSql);
          queryResult = {
            sql: generatedSql,
            columns: execResult.fields?.map(f => f.name) || [],
            rows: execResult.rows,
            totalReturned: execResult.rows.length,
            totalInTable: rowCount
          };
        } catch (sqlExecErr) {
          queryResult = { sql: generatedSql, columns: [], rows: [], totalReturned: 0, totalInTable: rowCount, sqlError: sqlExecErr.message };
        } finally { client.release(); }
      }

      if (!queryResult || (queryResult.rows.length === 0 && !queryResult.sqlError)) {
        const dataResult = await pool.query(`SELECT * FROM data_mart."${tableName}" LIMIT 20`);
        dataMartData = { name: tableName, columns: columns.map(c => c.column_name), records: dataResult.rows, totalRows: rowCount };
        queryResult = null;
      }
    }

    // Step 5: Render results — direct table if SQL succeeded, otherwise AI fallback
    const userDetails = await getUserDetails(req.userId);

    if (queryResult && queryResult.rows.length > 0) {
      // ── Direct table render (no AI call) ──
      const colNames = queryResult.columns;
      const headerRow = colNames.join(' | ');
      const separator = colNames.map(() => '---').join(' | ');
      const dataRows = queryResult.rows.map(row =>
        colNames.map(c => {
          const val = row[c];
          if (val === null || val === undefined) return '';
          const s = String(val);
          return s.length > 50 ? s.slice(0, 50) + '...' : s;
        }).join(' | ')
      );
      const tableMd = `### Results for **${dataMartName}**\n\n| ${headerRow} |\n| ${separator} |\n${dataRows.map(r => `| ${r} |`).join('\n')}\n\n*${queryResult.totalReturned} row(s) returned | ${queryResult.totalInTable.toLocaleString()} total in table*`;

      const tokens = tableMd.split(/(\s+)/);
      for (const token of tokens) {
        sendSSE({ token });
      }
      sendSSE({ done: true });

      await logActivity(LogLevels.INFO, LogSources.CHAT, 'Chat query rendered (direct)', {
        ...userDetails, userId: req.userId, dataMartId, dataMartName, prompt: lastUserMessage,
        sqlGenerated: queryResult.sql, rowsReturned: queryResult.totalReturned, req
      });
      res.end();
      return;
    }

    if (queryResult && queryResult.sqlError) {
      // ── SQL error — try AI to explain the error ──
      const context = { dataMartInfo, queryResult, dataMartData, availableTables: userAssignmentsResult.rows, fileData: cleanFileData };
      const aiResp = await fetch(`${AI_SERVICE_URL}/api/chat/stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(-10), context }),
        signal: AbortSignal.timeout(300000)
      });
      if (aiResp.ok) {
        const reader = aiResp.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6);
            if (payload === '[DONE]') { res.write('data: {"done":true}\n\n'); continue; }
            try {
              const parsed = JSON.parse(payload);
              if (parsed.token) sendSSE({ token: parsed.token });
              else if (parsed.error) sendSSE({ error: parsed.error });
            } catch {}
          }
        }
      } else {
        sendSSE({ token: `The query encountered an error: ${queryResult.sqlError}` });
        sendSSE({ done: true });
      }
      await logActivity(LogLevels.INFO, LogSources.CHAT, 'Chat query rendered (SQL error)', {
        ...userDetails, userId: req.userId, dataMartId, dataMartName, prompt: lastUserMessage, sqlGenerated: queryResult.sql, req
      });
      res.end();
      return;
    }

    // ── Fallback: no SQL or sample data — need AI chat formatting ──
    const context = { dataMartInfo, queryResult, dataMartData, availableTables: userAssignmentsResult.rows, fileData: cleanFileData };
    const aiResp = await fetch(`${AI_SERVICE_URL}/api/chat/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.slice(-10), context }),
      signal: AbortSignal.timeout(300000)
    });

    if (!aiResp.ok) {
      sendError('AI service unavailable');
      return;
    }

    const reader = aiResp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') { res.write('data: {"done":true}\n\n'); continue; }
        try {
          const parsed = JSON.parse(payload);
          if (parsed.token) sendSSE({ token: parsed.token });
          else if (parsed.error) sendSSE({ error: parsed.error });
        } catch {}
      }
    }

    await logActivity(LogLevels.INFO, LogSources.CHAT, 'Chat stream completed (AI fallback)', {
      ...userDetails, userId: req.userId, dataMartId, dataMartName, prompt: lastUserMessage,
      sqlGenerated: queryResult?.sql || null, rowsReturned: queryResult?.totalReturned || null, req
    });

    res.end();
  } catch (err) {
    sendError(err.message || 'Stream error');
  }
});


// ── Main Chat Endpoint ──
router.post("/", async (req, res) => {
  const { messages, dataMartId, fileData } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required" });
  }
  if (!dataMartId) {
    return res.status(400).json({ error: "dataMartId is required" });
  }

  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

  try {
    let dataMartInfo = null;
    let dataMartData = null;     // fallback sample-based context (used if SQL fails)
    let queryResult  = null;     // Text-to-SQL result context (primary for data marts)
    let tableName    = dataMartId;
    let dataMartName = dataMartId;

    // ── Step 1: Resolve data mart name ──
    if (dataMartId === 'file') {
      dataMartInfo = {
        name: fileData?.name || 'Uploaded File',
        description: 'User uploaded file for analysis'
      };
      dataMartName = fileData?.name || 'Uploaded File';
    } else {
      try {
        const dmResult = await pool.query(
          "SELECT id, name, description FROM data_marts WHERE id = $1 OR name = $1 LIMIT 1",
          [dataMartId]
        );
        if (dmResult.rows.length > 0) {
          dataMartInfo = dmResult.rows[0];
          dataMartName = dmResult.rows[0].name;
          tableName    = dmResult.rows[0].name;
        }
      } catch {
        tableName = dataMartId;
        dataMartName = dataMartId;
      }
    }

    // Fast-path: check for simple metadata questions (skip entire AI pipeline)
    if (dataMartId !== 'file' && tableName) {
      for (const pattern of METADATA_PATTERNS) {
        if (pattern.regex.test(lastUserMessage)) {
          const result = await handleMetadataQuestion(tableName, pattern.type);
          if (result) {
            return res.json({ content: result.content });
          }
        }
      }
    }

    // ── Step 2: Get user's data mart assignments for context ──
    let userAssignmentsResult;
    try {
      userAssignmentsResult = await pool.query(
        `SELECT dm.id, dm.name, dm.description
         FROM user_data_mart_assignments udma
         LEFT JOIN data_marts dm ON dm.id::text = udma.data_mart_id::text
            OR dm.name = udma.data_mart_id
         WHERE udma.user_id = $1`,
        [req.userId]
      );
    } catch {
      userAssignmentsResult = { rows: [] };
    }

    // ── Step 3: File upload path ──
    let cleanFileData = null;
    if (dataMartId === 'file') {
      if (!fileData?.data || !Array.isArray(fileData.data) || fileData.data.length === 0) {
        return res.status(400).json({ error: 'No data found in the uploaded file. Please check the file content and try again.' });
      }
      cleanFileData = {
        name: fileData.name,
        headers: fileData.headers,
        data: fileData.data.slice(0, 50),
        totalRows: fileData.totalRows || fileData.data.length
      };
    }

    // ── Step 4: Data Mart path — Text-to-SQL pipeline ──
    if (dataMartId !== 'file' && tableName) {

      // 4a. Validate table exists in data_mart schema (SQL injection protection)
      const allowed = await pool.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'data_mart' AND table_name = $1`,
        [tableName]
      );
      if (allowed.rows.length === 0) {
        return res.status(403).json({ error: 'Data mart table not found or access denied' });
      }

      // 4b. Get column schema (names + types)
      const colsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'data_mart' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      const columns = colsResult.rows;

      // 4c. Fast row count (no sequential scan — uses pg statistics, < 1ms)
      const rowCount = await getFastRowCount(tableName);

      // 4d. 3 sample rows for AI context (tiny query, always fast)
      const sampleResult = await pool.query(
        `SELECT * FROM data_mart."${tableName}" LIMIT 3`
      );

      console.log(`[CHAT] Table: ${tableName}, ~${rowCount.toLocaleString()} rows, ${columns.length} cols`);

      // 4e. Generate SQL via AI /api/sql-gen
      let generatedSql = null;
      try {
        const controller = new AbortController();
        const sqlTimeout = setTimeout(() => controller.abort(), 300000); // 300s timeout for SQL gen

        const sqlGenResp = await fetch(`${AI_SERVICE_URL}/api/sql-gen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: lastUserMessage,
            table_name: tableName,
            columns: columns,
            sample_rows: sampleResult.rows,
            total_rows: rowCount,
            conversation_history: messages.slice(-6)   // last 6 msgs for follow-up context
          }),
          signal: controller.signal
        });
        clearTimeout(sqlTimeout);

        if (sqlGenResp.ok) {
          const sqlData = await sqlGenResp.json();
          generatedSql = sqlData.sql || null;
          if (sqlData.error) console.warn(`[CHAT] SQL-gen warning: ${sqlData.error}`);
        }
      } catch (e) {
        console.error(`[CHAT] SQL generation failed: ${e.message}`);
      }

      // 4f. Validate and execute the generated SQL
      if (generatedSql && isSafeSelectQuery(generatedSql)) {
        const safeSql = ensureLimit(generatedSql, 100);
        const client = await pool.connect();

        try {
          // Use a dedicated client to set statement timeout safely
          await client.query('SET statement_timeout = 30000');  // 30s max
          const execResult = await client.query(safeSql);
          const resultCols = execResult.fields?.map(f => f.name) || [];

          queryResult = {
            sql: generatedSql,
            columns: resultCols,
            rows: execResult.rows,
            totalReturned: execResult.rows.length,
            totalInTable: rowCount
          };

          console.log(`[CHAT] SQL OK → ${execResult.rows.length} rows returned from ${rowCount.toLocaleString()} total`);

        } catch (sqlExecErr) {
          console.error(`[CHAT] SQL execution error: ${sqlExecErr.message}`);
          // Mark query result with the error so the AI can explain gracefully
          queryResult = {
            sql: generatedSql,
            columns: [],
            rows: [],
            totalReturned: 0,
            totalInTable: rowCount,
            sqlError: sqlExecErr.message
          };
        } finally {
          client.release();
        }
      } else {
        if (generatedSql) {
          console.warn(`[CHAT] SQL failed safety check, falling back to sample mode`);
        } else {
          console.warn(`[CHAT] No SQL generated, falling back to sample mode`);
        }
      }

      // 4g. Fallback: if SQL generation/execution failed entirely, use sample data
      if (!queryResult || (queryResult.rows.length === 0 && !queryResult.sqlError)) {
        // Only fall back to samples if we have genuinely no result (not a 0-row query result)
        const dataResult = await pool.query(
          `SELECT * FROM data_mart."${tableName}" LIMIT 20`
        );
        dataMartData = {
          name: tableName,
          columns: columns.map(c => c.column_name),
          records: dataResult.rows,
          totalRows: rowCount
        };
        queryResult = null; // ensure we use dataMartData path in AI
        console.log(`[CHAT] Fallback: sending ${dataResult.rows.length} sample rows`);
      }
    }

    // ── Step 5: Render results — direct table if SQL succeeded, otherwise AI fallback
    const userDetails = await getUserDetails(req.userId);

    if (queryResult && queryResult.rows.length > 0) {
      // ── Direct table render (no AI call) ──
      const colNames = queryResult.columns;
      const headerRow = colNames.join(' | ');
      const separator = colNames.map(() => '---').join(' | ');
      const dataRows = queryResult.rows.map(row =>
        colNames.map(c => {
          const val = row[c];
          if (val === null || val === undefined) return '';
          const s = String(val);
          return s.length > 50 ? s.slice(0, 50) + '...' : s;
        }).join(' | ')
      );
      const tableMd = `### Results for **${dataMartName}**\n\n| ${headerRow} |\n| ${separator} |\n${dataRows.map(r => `| ${r} |`).join('\n')}\n\n*${queryResult.totalReturned} row(s) returned | ${queryResult.totalInTable.toLocaleString()} total in table*`;

      await logActivity(LogLevels.INFO, LogSources.CHAT, 'Chat query rendered (direct)', {
        ...userDetails, userId: req.userId, dataMartId, dataMartName, prompt: lastUserMessage,
        sqlGenerated: queryResult.sql, rowsReturned: queryResult.totalReturned, req
      });
      return res.json({ content: tableMd });
    }

    if (queryResult && queryResult.sqlError) {
      // ── SQL error — try AI to explain ──
      const context = { dataMartInfo, queryResult, dataMartData, availableTables: userAssignmentsResult.rows, fileData: cleanFileData };
      try {
        const aiRes = await fetch(`${AI_SERVICE_URL}/api/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messages.slice(-10), context }),
          signal: AbortSignal.timeout(300000)
        });
        if (aiRes.ok) {
          const result = await aiRes.json();
          return res.json({ content: result.message || result.content });
        }
      } catch {}
      return res.json({ content: `The query encountered an error: ${queryResult.sqlError}` });
    }

    // ── Fallback: no SQL or sample data — need AI chat formatting ──
    const context = { dataMartInfo, queryResult, dataMartData, availableTables: userAssignmentsResult.rows, fileData: cleanFileData };

    let aiResponse;
    try {
      aiResponse = await fetch(`${AI_SERVICE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(-10), context }),
        signal: AbortSignal.timeout(300000)
      });
    } catch (e) {
      await logActivity(LogLevels.ERROR, LogSources.CHAT,
        `AI service error: ${e.message}`,
        { ...userDetails, userId: req.userId, dataMartId, dataMartName, prompt: lastUserMessage, req }
      );
      return res.status(500).json({ error: 'Failed to get AI response' });
    }

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      await logActivity(LogLevels.ERROR, LogSources.CHAT,
        `AI service error: ${error}`,
        { ...userDetails, userId: req.userId, dataMartId, dataMartName, prompt: lastUserMessage, req }
      );
      return res.status(500).json({ error: 'Failed to get AI response' });
    }

    const result = await aiResponse.json();

    await logActivity(LogLevels.INFO, LogSources.CHAT, 'Chat message processed', {
      ...userDetails, userId: req.userId, dataMartId, dataMartName,
      messageCount: messages.length, prompt: lastUserMessage,
      sqlGenerated: queryResult?.sql || null, rowsReturned: queryResult?.totalReturned || null, usedTextToSql: !!queryResult, req
    });

    const imageErrorPattern = /cannot\s*read.*\.(png|jpg|jpeg|gif|bmp|webp)|does not support image|this model does not support|image input is not supported/i;
    const cleanContent = imageErrorPattern.test(result.message)
      ? "I can only analyze structured data from CSV/Excel files and database tables. I cannot read images, screenshots, or scanned documents. Please upload a CSV or Excel file."
      : result.message;

    res.json({ content: cleanContent, model: result.model });

  } catch (err) {
    const errorMsg = err.message || "Failed to process chat";
    const userDetails = await getUserDetails(req.userId);
    await logActivity(LogLevels.ERROR, LogSources.CHAT,
      `Chat error: ${errorMsg}`,
      { ...userDetails, userId: req.userId, dataMartId, req }
    );
    res.status(500).json({ error: errorMsg });
  }
});

// ── Autocomplete Endpoint ──
router.post("/autocomplete", async (req, res) => {
  const { currentInput, dataMartName, dataMartDescription } = req.body;

  if (!currentInput || currentInput.trim().length < 3) {
    return res.json({ suggestion: "" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout for local AI

    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_input: currentInput,
        context: {
          dataMartName: dataMartName || '',
          dataMartDescription: dataMartDescription || ''
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!aiResponse.ok) return res.json({ suggestion: "" });

    const result = await aiResponse.json();
    res.json({ suggestion: result.suggestion || "" });
  } catch {
    res.json({ suggestion: "" });
  }
});

// ── Suggestions Endpoint ──
router.post("/suggestions", async (req, res) => {
  const { dataMartName, totalRows, columnCount, fileName, fileHeaders, fileRows } = req.body;

  let columns = [];

  // Fetch actual column names from the database for data marts
  if (dataMartName && !fileName) {
    try {
      const colsResult = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'data_mart' AND table_name = $1
        ORDER BY ordinal_position
      `, [dataMartName]);
      columns = colsResult.rows.map(r => r.column_name);
    } catch {
      columns = [];
    }
  }

  // Fetch most frequent user prompts (all-time, optionally filtered by data mart)
  let frequentPrompts = [];
  try {
    const freqQuery = dataMartName && !fileName
      ? `SELECT LOWER(TRIM(m.content)) AS prompt, COUNT(*) AS cnt
         FROM chat_messages m
         JOIN chat_conversations c ON c.id = m.conversation_id
         WHERE m.role = 'user' AND c.data_mart_id = (SELECT id FROM data_marts WHERE name = $1)
         GROUP BY LOWER(TRIM(m.content))
         ORDER BY cnt DESC
         LIMIT 5`
      : `SELECT LOWER(TRIM(content)) AS prompt, COUNT(*) AS cnt
         FROM chat_messages
         WHERE role = 'user'
         GROUP BY LOWER(TRIM(content))
         ORDER BY cnt DESC
         LIMIT 5`;

    const freqResult = await pool.query(freqQuery, dataMartName && !fileName ? [dataMartName] : []);
    frequentPrompts = freqResult.rows.map(r => r.prompt);
  } catch {
    frequentPrompts = [];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for suggestions

    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data_mart_name: dataMartName || '',
        columns,
        total_rows: totalRows || 0,
        file_name: fileName || '',
        file_headers: fileHeaders || [],
        file_rows: fileRows || 0
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!aiResponse.ok) return res.json({ suggestions: [], frequentPrompts });

    const result = await aiResponse.json();
    res.json({ suggestions: result.suggestions || [], frequentPrompts });
  } catch {
    res.json({ suggestions: [], frequentPrompts });
  }
});

export default router;