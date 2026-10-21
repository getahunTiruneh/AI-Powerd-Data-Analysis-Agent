import { Router } from "express";
import { pool } from "../services/db.js";
import jwt from 'jsonwebtoken';
import { Pool as PgPool } from 'pg';
import { logActivity, LogSources, LogLevels } from '../services/logger.js';
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const DATA_MART_SCHEMA = 'data_mart';
const SYSTEM_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'topology'];

let remotePool = null;
let connectionConfig = null;
let selectedSchema = null;

async function getFastRowCount(tableName, client = pool, schemaName = 'data_mart') {
  try {
    const result = await client.query(
      `SELECT reltuples::bigint AS cnt
       FROM pg_class
       WHERE oid = ($1 || '.' || $2)::regclass`,
      [`"${schemaName}"`, `"${tableName}"`]
    );
    const cnt = parseInt(result.rows[0]?.cnt);
    if (cnt === undefined || cnt === null || cnt < 0) {
      const real = await client.query(
        `SELECT COUNT(*) AS cnt FROM "${schemaName}"."${tableName}"`
      );
      return parseInt(real.rows[0]?.cnt || "0");
    }
    return cnt;
  } catch (err) {
    try {
      const real = await client.query(
        `SELECT COUNT(*) AS cnt FROM "${schemaName}"."${tableName}"`
      );
      return parseInt(real.rows[0]?.cnt || "0");
    } catch (innerErr) {
      console.error(`[DB-STATS] getFastRowCount failed for ${schemaName}.${tableName}: ${innerErr.message}`);
      return 0;
    }
  }
}

function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Initialize connection on startup
async function initializeConnection() {
  try {
    const result = await pool.query(
      "SELECT * FROM db_connections WHERE is_active = true LIMIT 1"
    );
    
    if (result.rows.length > 0) {
      const conn = result.rows[0];
      connectionConfig = {
        host: conn.host,
        port: conn.port,
        database: conn.database,
        username: conn.username,
        ssl: conn.ssl
      };
      selectedSchema = conn.schema_name || 'public';
      
      remotePool = new PgPool({
        host: conn.host,
        port: conn.port,
        database: conn.database,
        user: conn.username,
        password: conn.password_encrypted,
        ssl: conn.ssl ? { rejectUnauthorized: false } : false,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      
      // Test connection
      const client = await remotePool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log('Database connection restored from saved config');
    }
  } catch (error) {
    console.error('Failed to restore database connection:', error);
  }
}

// Initialize on module load
initializeConnection();

router.use(requireAuth);

// Get assigned data marts for business users
router.get("/assigned", async (req, res) => {
  try {
    const userId = req.userId;
    
    const assignmentsResult = await pool.query(
      "SELECT data_mart_id FROM user_data_mart_assignments WHERE user_id = $1",
      [userId]
    );
    
    const assignedIds = assignmentsResult.rows.map(r => r.data_mart_id);
    
    if (assignedIds.length === 0) {
      return res.json({ data: [], message: "No data marts assigned" });
    }

    // BATCH 1: Get table names + estimated row counts + column counts in one query
    const metaResult = await pool.query(`
      SELECT
        t.table_name,
        COALESCE(c.reltuples::bigint, 0) AS estimated_count,
        col_info.column_count
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.oid = ('"data_mart"."' || t.table_name || '"')::regclass
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS column_count
        FROM information_schema.columns c2
        WHERE c2.table_schema = 'data_mart' AND c2.table_name = t.table_name
      ) col_info ON true
      WHERE t.table_schema = 'data_mart'
        AND t.table_name = ANY($1::text[])
      ORDER BY t.table_name
    `, [assignedIds]);
    
    // BATCH 2: Get column names for all tables in one query
    const colResult = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'data_mart'
        AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position
    `, [assignedIds]);
    
    // Group columns by table name (in-memory, no per-table queries)
    const columnsByTable = {};
    for (const row of colResult.rows) {
      if (!columnsByTable[row.table_name]) columnsByTable[row.table_name] = [];
      columnsByTable[row.table_name].push(row.column_name);
    }
    
    // Build result: sample data still needs per-table queries but runs in parallel
    const tablesWithCounts = await Promise.all(
      metaResult.rows.map(async (row) => {
        const tableName = row.table_name;
        try {
          let rowCount = parseInt(row.estimated_count);
          if (rowCount <= 0) {
            const countResult = await pool.query(
              `SELECT COUNT(*) AS cnt FROM data_mart."${tableName}"`
            );
            rowCount = parseInt(countResult.rows[0]?.cnt || "0");
          }
          
          const sampleResult = await pool.query(`SELECT * FROM data_mart."${tableName}" LIMIT 5`);
          
          return {
            id: tableName,
            name: tableName,
            row_count: rowCount,
            columns: columnsByTable[tableName] || [],
            sample_data: sampleResult.rows,
            column_count: parseInt(row.column_count)
          };
        } catch (e) {
          console.log(`[ASSIGNED] Error for ${tableName}:`, e.message);
          return { id: tableName, name: tableName, row_count: 0, columns: [], sample_data: [], column_count: 0 };
        }
      })
    );
    
    res.json({ data: tablesWithCounts });
  } catch (error) {
    console.error("Error fetching assigned data marts:", error);
    res.status(500).json({ error: "Failed to fetch assigned data marts" });
  }
});

// Legacy endpoint for backward compatibility
router.get("/assigned/legacy", async (req, res) => {
  if (!remotePool) {
    return res.json({ data: [], message: "No database connected" });
  }

  try {
    const userId = req.userId;
    
    const assignmentsResult = await pool.query(
      "SELECT data_mart_id FROM user_data_mart_assignments WHERE user_id = $1",
      [userId]
    );
    
    const assignedIds = assignmentsResult.rows.map(r => r.data_mart_id);
    
    if (assignedIds.length === 0) {
      return res.json({ data: [], message: "No data marts assigned" });
    }

    let query;
    let params = [];
    
    if (selectedSchema) {
      query = `
        SELECT 
          t.table_name as id,
          t.table_name as name,
          (SELECT pg_size_pretty(pg_total_relation_size(('"' || t.table_schema || '"."' || t.table_name || '"')::regclass)) ) as size,
          (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE t.table_schema = $1
        AND t.table_type = 'BASE TABLE'
        AND t.table_name = ANY($2)
        ORDER BY t.table_name
      `;
      params = [selectedSchema, assignedIds];
    } else {
      query = `
        SELECT 
          t.table_name as id,
          t.table_name as name,
          t.table_schema as schema,
          (SELECT pg_size_pretty(pg_total_relation_size(('"' || t.table_schema || '"."' || t.table_name || '"')::regclass)) ) as size,
          (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND t.table_schema NOT LIKE 'pg_temp_%'
        AND t.table_schema NOT LIKE 'pg_toast_temp_%'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name = ANY($1)
        ORDER BY t.table_schema, t.table_name
      `;
      params = [assignedIds];
    }

    const result = await remotePool.query(query, params);

    const tables = result.rows.map(row => ({
      ...row,
      icon: getTableIcon(row.name),
      description: getTableDescription(row.name),
      status: 'connected',
      column_count: parseInt(row.column_count)
    }));

    res.json({ data: tables, schema: selectedSchema });
  } catch (error) {
    console.error("Error fetching assigned tables:", error);
    res.status(500).json({ error: "Failed to fetch assigned data marts" });
  }
});

// Get connection status (accessible to all authenticated users)
router.get("/connection/status", async (req, res) => {
  res.json({ 
    connected: remotePool !== null,
    config: connectionConfig ? { host: connectionConfig.host, database: connectionConfig.database } : null,
    schema: selectedSchema
  });
});

// Get all local data_mart schema tables
router.get("/local", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        table_name as id,
        table_name as name,
        (SELECT pg_size_pretty(pg_total_relation_size(('"data_mart"."' || table_name || '"')::regclass))) as size,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = 'data_mart' AND c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'data_mart'
      AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);
    
    const tables = await Promise.all(result.rows.map(async (row) => {
      const rowCount = await getFastRowCount(row.table_name || row.name, pool, 'data_mart');
      return { ...row, row_count: rowCount };
    }));
    
    res.json({ data: tables });
  } catch (error) {
    console.error("[DATA_MARTS GET /] Error:", error.message);
    res.json({ data: [], message: "No data marts found" });
  }
});

// Get data from a specific data mart table (for all authenticated users)
router.get("/:id/data", async (req, res) => {
  const { id } = req.params;
  const { limit = 10, offset = 0 } = req.query;

  try {
    // Validate table name against the data_mart schema whitelist to prevent SQL injection
    const allowed = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'data_mart' AND table_name = $1`,
      [id]
    );
    if (allowed.rows.length === 0) {
      return res.status(403).json({ error: "Table not found or access denied" });
    }

    const result = await pool.query(
      `SELECT * FROM data_mart."${id}" LIMIT $1 OFFSET $2`,
      [parseInt(limit) || 10, parseInt(offset) || 0]
    );
    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Get table columns (for all authenticated users)
router.get("/:id/columns", async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'data_mart' AND table_name = $1
      ORDER BY ordinal_position
    `, [id]);
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching columns:", error);
    res.status(500).json({ error: "Failed to fetch columns" });
  }
});

router.use(requireAdmin);

// Get actual data mart definitions (not DB tables)
router.get("/list", async (req, res) => {
  try {
    const tablesResult = await pool.query(`
      SELECT 
        table_name as name,
        table_name as id,
        (SELECT pg_size_pretty(pg_total_relation_size(('"data_mart"."' || table_name || '"')::regclass))) as size,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = 'data_mart' AND c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'data_mart'
      AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);
    
    const metaResult = await pool.query(
      "SELECT id, name, description, icon, db_type, status FROM data_marts"
    );
    
    const dataMarts = await Promise.all(tablesResult.rows.map(async (table) => {
      const rowCount = await getFastRowCount(table.name, pool, 'data_mart');
      const meta = metaResult.rows.find(m => m.name === table.name);
      return {
        ...table,
        row_count: rowCount,
        description: meta?.description || `Data from ${table.name} table`,
        icon: meta?.icon || '📊',
        db_type: meta?.db_type || 'PostgreSQL',
        status: meta?.status || 'connected'
      };
    }));
    
    res.json({ data: dataMarts });
  } catch (error) {
    console.error("[DATA_MARTS GET /list] Error:", error.message);
    res.json({ data: [], message: "No data marts found" });
  }
});

// Get all tables from connected external database (filtered by selected schema)
router.get("/", async (req, res) => {
  if (!remotePool) {
    return res.json({ data: [], message: "No database connected" });
  }

  try {
    let query;
    let params = [];
    
    if (selectedSchema) {
      query = `
        SELECT 
          t.table_name as id,
          t.table_name as name,
          (SELECT pg_size_pretty(pg_total_relation_size(('"' || t.table_schema || '"."' || t.table_name || '"')::regclass)) ) as size,
          (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE t.table_schema = $1
        AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `;
      params = [selectedSchema];
    } else {
      query = `
        SELECT 
          t.table_name as id,
          t.table_name as name,
          t.table_schema as schema,
          (SELECT pg_size_pretty(pg_total_relation_size(('"' || t.table_schema || '"."' || t.table_name || '"')::regclass)) ) as size,
          (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND t.table_schema NOT LIKE 'pg_temp_%'
        AND t.table_schema NOT LIKE 'pg_toast_temp_%'
        AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_schema, t.table_name
      `;
    }

    const result = await remotePool.query(query, params);

    const tables = await Promise.all(result.rows.map(async (row) => {
      const rowCount = await getFastRowCount(row.name, remotePool, row.schema || selectedSchema);
      return {
        ...row,
        icon: getTableIcon(row.name),
        description: getTableDescription(row.name),
        status: 'connected',
        column_count: parseInt(row.column_count),
        row_count: rowCount
      };
    }));

    res.json({ data: tables, schema: selectedSchema });
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({ error: "Failed to fetch data marts" });
  }
});

// Get specific table details
router.get("/:table", async (req, res) => {
  const { table } = req.params;
  
  if (!remotePool) {
    return res.status(400).json({ error: "No database connected" });
  }

  if (SYSTEM_SCHEMAS.includes(table)) {
    return res.status(400).json({ error: "Cannot access system schema" });
  }

  try {
    const targetSchema = selectedSchema || 'public';

    const columnsResult = await remotePool.query(`
      SELECT 
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        col_description(('"' || c.table_schema || '"."' || c.table_name || '"')::regclass, c.ordinal_position) as description,
        (SELECT COUNT(*) > 0 FROM information_schema.table_constraints tc 
         JOIN information_schema.key_column_usage kcu 
         ON tc.constraint_name = kcu.constraint_name
         WHERE tc.table_schema = c.table_schema 
         AND tc.table_name = c.table_name 
         AND kcu.column_name = c.column_name 
         AND tc.constraint_type = 'PRIMARY KEY') as is_primary_key,
        (SELECT COUNT(*) > 0 FROM information_schema.table_constraints tc 
         JOIN information_schema.key_column_usage kcu 
         ON tc.constraint_name = kcu.constraint_name
         WHERE tc.table_schema = c.table_schema 
         AND tc.table_name = c.table_name 
         AND kcu.column_name = c.column_name 
         AND tc.constraint_type = 'FOREIGN KEY') as is_foreign_key
      FROM information_schema.columns c
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `, [targetSchema, table]);

    if (columnsResult.rows.length === 0) {
      return res.status(404).json({ error: `Table "${table}" not found in schema "${targetSchema}"` });
    }

    const columns = columnsResult.rows.map(col => ({
      name: col.column_name,
      type: col.data_type + (col.character_maximum_length ? `(${col.character_maximum_length})` : ''),
      nullable: col.is_nullable === 'YES',
      default: col.column_default,
      description: col.description || '',
      isPrimaryKey: col.is_primary_key === 't',
      isForeignKey: col.is_foreign_key === 't'
    }));

    res.json({ 
      data: {
        id: table,
        name: table,
        schema: targetSchema,
        description: '',
        columns,
        status: 'connected'
      }
    });
  } catch (error) {
    console.error("Error fetching table:", error);
    res.status(500).json({ error: "Failed to fetch table details" });
  }
});

// Configure database connection
router.post("/connection", async (req, res) => {
  const { host, port, database, username, password, ssl } = req.body;
  
  if (!host || !database) {
    return res.status(400).json({ error: "Host and database are required" });
  }
  
  try {
    if (remotePool) {
      await remotePool.end();
    }

    remotePool = new PgPool({
      host,
      port: port || 5432,
      database,
      user: username,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const client = await remotePool.connect();
    await client.query('SELECT 1');
    client.release();

    connectionConfig = { host, port, database, username, ssl };

    // Save to database
    await pool.query(`
      UPDATE db_connections SET is_active = false WHERE is_active = true
    `);
    await pool.query(`
      INSERT INTO db_connections (host, port, database, username, password_encrypted, ssl, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
    `, [host, port || 5432, database, username, password, ssl || false]);

    await logActivity(LogLevels.INFO, LogSources.DATA_MARTS, `Connected to database: ${host}/${database}`, { host, database, schema: selectedSchema, req });
    
    res.json({ message: "Connection successful", status: "connected" });
  } catch (error) {
    console.error("Connection error:", error);
    console.error("Stack:", error.stack);
    remotePool = null;
    connectionConfig = null;
    try {
      await logActivity(LogLevels.ERROR, LogSources.DATA_MARTS, `Failed to connect to database: ${error.message}`, { host, database, req });
    } catch (logErr) {
      console.error("Log error:", logErr);
    }
    res.status(500).json({ error: "Failed to connect: " + error.message });
  }
});

// Disconnect from external database
router.delete("/connection", async (req, res) => {
  try {
    if (remotePool) {
      const host = connectionConfig?.host;
      const database = connectionConfig?.database;
      await remotePool.end();
      remotePool = null;
      connectionConfig = null;
      selectedSchema = null;
      await logActivity(LogLevels.INFO, LogSources.DATA_MARTS, `Disconnected from database: ${host}/${database}`);
    }

    // Remove from database
    await pool.query("UPDATE db_connections SET is_active = false WHERE is_active = true");
    
    res.json({ message: "Disconnected successfully", status: "disconnected" });
  } catch (error) {
    console.error("Disconnect error:", error);
    await logActivity(LogLevels.ERROR, LogSources.DATA_MARTS, `Failed to disconnect: ${error.message}`);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// Select a schema
router.post("/connection/schema", async (req, res) => {
  const { schema } = req.body;
  
  if (!remotePool) {
    return res.status(400).json({ error: "No database connected" });
  }
  
  if (!schema) {
    return res.status(400).json({ error: "Schema is required" });
  }

  try {
    selectedSchema = schema;
    
    // Save schema selection to database
    await pool.query(
      "UPDATE db_connections SET schema_name = $1, updated_at = NOW() WHERE is_active = true",
      [schema]
    );
    
    res.json({ message: "Schema selected", schema: selectedSchema });
  } catch (error) {
    console.error("Error selecting schema:", error);
    res.status(500).json({ error: "Failed to select schema" });
  }
});

// Get schemas from connected database
router.get("/connection/schemas", async (req, res) => {
  if (!remotePool) {
    return res.status(400).json({ error: "No database connected" });
  }

  try {
    const result = await remotePool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'pg_toast', 'topology')
      AND schema_name NOT LIKE 'pg_temp_%'
      AND schema_name NOT LIKE 'pg_toast_temp_%'
      ORDER BY schema_name
    `);

    res.json({ data: result.rows.map(r => r.schema_name) });
  } catch (error) {
    console.error("Error fetching schemas:", error);
    res.status(500).json({ error: "Failed to fetch schemas" });
  }
});

// Get tables from selected schema in connected database
router.get("/connection/schemas/:schema/tables", async (req, res) => {
  const { schema } = req.params;

  if (!remotePool) {
    return res.status(400).json({ error: "No database connected" });
  }

  try {
    const result = await remotePool.query(`
      SELECT 
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `, [schema]);

    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
});

// Import tables from connected database (from selected schema)
router.post("/import", async (req, res) => {
  const { schema } = req.body;
  
  if (!remotePool) {
    return res.status(400).json({ error: "No database connected" });
  }

  const targetSchema = schema || 'public';

  try {
    const tablesResult = await remotePool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [targetSchema]);

    const tables = tablesResult.rows.map(r => r.table_name);
    let imported = 0;
    let errors = [];

    for (const tableName of tables) {
      try {
        const colsResult = await remotePool.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [targetSchema, tableName]);

        const columns = colsResult.rows.map(col => {
          const type = col.character_maximum_length 
            ? `${col.data_type}(${col.character_maximum_length})`
            : col.data_type;
          return `"${col.column_name}" ${type}`;
        }).join(', ');

        const importName = `${targetSchema}_${tableName}`;
        
        await pool.query(`
          CREATE TABLE IF NOT EXISTS "${DATA_MART_SCHEMA}"."${importName}" (${columns})
        `);
        
        imported++;
      } catch (err) {
        errors.push({ table: tableName, error: err.message });
      }
    }

    res.json({ 
      message: `Imported ${imported} tables from ${targetSchema}`,
      imported,
      schema: targetSchema,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Import failed: " + error.message });
  }
});

// Import specific tables
router.post("/import/tables", async (req, res) => {
  const { schema, tables } = req.body;
  
  if (!remotePool) {
    return res.status(400).json({ error: "No database connected" });
  }

  if (!tables || !Array.isArray(tables) || tables.length === 0) {
    return res.status(400).json({ error: "No tables selected" });
  }

  const targetSchema = schema || 'public';
  let imported = 0;
  let errors = [];

  try {
    for (const tableName of tables) {
      try {
        const colsResult = await remotePool.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [targetSchema, tableName]);

        if (colsResult.rows.length === 0) {
          errors.push({ table: tableName, error: "Table not found" });
          continue;
        }

        const columns = colsResult.rows.map(col => {
          const type = col.character_maximum_length 
            ? `${col.data_type}(${col.character_maximum_length})`
            : col.data_type;
          return `"${col.column_name}" ${type}`;
        }).join(', ');

        const importName = `${targetSchema}_${tableName}`;
        
        await pool.query(`
          CREATE TABLE IF NOT EXISTS "${DATA_MART_SCHEMA}"."${importName}" (${columns})
        `);
        
        imported++;
      } catch (err) {
        errors.push({ table: tableName, error: err.message });
      }
    }

    res.json({ 
      message: `Imported ${imported} tables`,
      imported,
      schema: targetSchema,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Import failed: " + error.message });
  }
});

// Create table in data_mart schema
router.post("/", async (req, res) => {
  const { name, columns } = req.body;
  
  if (!name || !columns || !Array.isArray(columns)) {
    return res.status(400).json({ error: "Table name and columns are required" });
  }

  const tableName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  try {
    await ensureDataMartSchema();

    const columnsDef = columns.map(col => {
      const colName = col.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      let type = 'VARCHAR(255)';
      if (col.type === 'integer') type = 'INTEGER';
      else if (col.type === 'decimal') type = 'DECIMAL(18,2)';
      else if (col.type === 'text') type = 'TEXT';
      else if (col.type === 'date') type = 'DATE';
      else if (col.type === 'timestamp') type = 'TIMESTAMP';
      else if (col.type === 'boolean') type = 'BOOLEAN';
      return `"${colName}" ${type}`;
    }).join(', ');

    await pool.query(`CREATE TABLE "${DATA_MART_SCHEMA}"."${tableName}" (${columnsDef})`);

    res.json({ 
      data: { id: tableName, name: tableName },
      message: "Table created successfully" 
    });
  } catch (error) {
    console.error("Error creating table:", error);
    res.status(500).json({ error: "Failed to create table: " + error.message });
  }
});

// Delete table
router.delete("/:table", async (req, res) => {
  const { table } = req.params;
  
  try {
    await pool.query(`DROP TABLE IF EXISTS "${DATA_MART_SCHEMA}"."${table}" CASCADE`);
    res.json({ message: "Table deleted successfully" });
  } catch (error) {
    console.error("Error deleting table:", error);
    res.status(500).json({ error: "Failed to delete table" });
  }
});

// Query table data
// Helper function
function getTableIcon(tableName) {
  const icons = {
    'retail': '🏦',
    'digital': '📱',
    'credit': '💰',
    'loan': '💰',
    'customer': '👥',
    'customers': '👥',
    'transaction': '💸',
    'transactions': '💸',
    'branch': '🏢',
    'branches': '🏢',
    'user': '👤',
    'users': '👥',
    'account': '🏦',
    'accounts': '🏦',
    'repayment': '💳',
    'repayments': '💳',
  };
  
  const lower = tableName.toLowerCase();
  for (const [key, icon] of Object.entries(icons)) {
    if (lower.includes(key)) return icon;
  }
  return '📊';
}

function getTableDescription(tableName) {
  const descriptions = {
    'retail_customers': 'Retail banking customer master data',
    'retail_transactions': 'Retail banking transaction records',
    'retail_branches': 'Branch information and performance',
    'digital_users': 'Digital banking user accounts',
    'digital_transactions': 'Digital channel transactions',
    'loan_accounts': 'Loan portfolio accounts',
    'loan_repayments': 'Loan repayment records',
  };
  return descriptions[tableName] || '';
}

export default router;
