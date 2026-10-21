import { Router } from "express";
import { pool } from "../services/db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

// Get audit logs with filtering, sorting, pagination
router.get("/", async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sortBy = "created_at",
    sortOrder = "desc",
    level,
    source,
    search,
    startDate,
    endDate,
    userId
  } = req.query;

  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (level && level !== 'all') {
      conditions.push(`level = $${paramCount++}`);
      params.push(level);
    }

    if (source && source !== 'all') {
      conditions.push(`source = $${paramCount++}`);
      params.push(source);
    }

    if (userId) {
      conditions.push(`details->>'userId' = $${paramCount++}`);
      params.push(userId);
    }

    if (search) {
      conditions.push(`(message ILIKE $${paramCount} OR details::text ILIKE $${paramCount} OR source ILIKE $${paramCount} OR level ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramCount++}`);
      params.push(new Date(startDate));
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramCount++}`);
      params.push(new Date(endDate));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const allowedSortFields = ['created_at', 'level', 'source', 'message'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get logs
    const query = `
      SELECT * FROM logs 
      ${whereClause} 
      ORDER BY ${sortField} ${sortDirection} 
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Format the response
    const logs = result.rows.map(log => {
      const details = log.details || {};
      return {
        id: log.id,
        level: log.level,
        source: log.source,
        message: log.message,
        status: getStatus(log.level, log.message),
        userName: details.userName || details.name || details.email || 'System',
        userEmail: details.email || null,
        userId: details.userId || null,
        role: details.role || details.userRole || null,
        ip: details.ip || details.ipAddress || null,
        userAgent: details.userAgent || details.device || null,
        location: details.location || null,
        action: getAction(log.source, log.message),
        dataMartName: details.dataMartName || null,
        details: log.details,
        requestId: details.requestId || details.traceId || null,
        sessionId: details.sessionId || null,
        createdAt: log.created_at
      };
    });

    res.json({
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// Get log sources for filter dropdown
router.get("/sources", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT source FROM logs ORDER BY source`
    );
    res.json({ data: result.rows.map(r => r.source) });
  } catch (error) {
    console.error("Error fetching sources:", error);
    res.status(500).json({ error: "Failed to fetch sources" });
  }
});

// Export logs (must be before /:id route)
router.get("/export", async (req, res) => {
  const { format = 'json', ...filters } = req.query;
  
  try {
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (filters.level && filters.level !== 'all') {
      conditions.push(`level = $${paramCount++}`);
      params.push(filters.level);
    }

    if (filters.source && filters.source !== 'all') {
      conditions.push(`source = $${paramCount++}`);
      params.push(filters.source);
    }

    if (filters.search) {
      conditions.push(`(message ILIKE $${paramCount} OR details::text ILIKE $${paramCount} OR source ILIKE $${paramCount} OR level ILIKE $${paramCount})`);
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramCount++}`);
      params.push(new Date(filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramCount++}`);
      params.push(new Date(filters.endDate));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const result = await pool.query(
      `SELECT * FROM logs ${whereClause} ORDER BY created_at DESC LIMIT 1000`,
      params
    );

    const logs = result.rows.map(log => {
      const details = log.details || {};
      return {
        timestamp: log.created_at,
        level: log.level,
        source: log.source,
        message: log.message,
        user: details.userName || details.email || 'System',
        userId: details.userId || null,
        ip: details.ip || null,
        dataMartName: details.dataMartName || null,
        action: getAction(log.source, log.message),
        status: getStatus(log.level, log.message)
      };
    });

    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'source', 'message', 'user', 'ip', 'dataMartName', 'action', 'status'];
      const csvRows = [headers.join(',')];
      logs.forEach(log => {
        csvRows.push([
          log.timestamp,
          log.level,
          log.source,
          `"${log.message.replace(/"/g, '""')}"`,
          log.user,
          log.ip || '',
          log.dataMartName || '',
          log.action,
          log.status
        ].join(','));
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
      res.send(csvRows.join('\n'));
    } else {
      res.json({ data: logs });
    }
  } catch (error) {
    console.error("Error exporting logs:", error);
    res.status(500).json({ error: "Failed to export logs" });
  }
});

// Get single log details (must be after /export)
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM logs WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Log not found" });
    }

    const log = result.rows[0];
    const details = log.details || {};
    
    res.json({
      data: {
        id: log.id,
        level: log.level,
        source: log.source,
        message: log.message,
        status: getStatus(log.level, log.message),
        userName: details.userName || details.name || details.email || 'System',
        userEmail: details.email || null,
        userId: details.userId || null,
        role: details.role || details.userRole || null,
        ip: details.ip || details.ipAddress || null,
        userAgent: details.userAgent || details.device || null,
        location: details.location || null,
        action: getAction(log.source, log.message),
        dataMartName: details.dataMartName || null,
        details: log.details,
        requestId: details.requestId || details.traceId || null,
        sessionId: details.sessionId || null,
        createdAt: log.created_at
      }
    });
  } catch (error) {
    console.error("Error fetching log:", error);
    res.status(500).json({ error: "Failed to fetch log" });
  }
});

// Get suspicious activity summary
router.get("/security/summary", async (req, res) => {
  try {
    const failedLogins = await pool.query(`
      SELECT COUNT(*) as count 
      FROM logs 
      WHERE source = 'auth' 
      AND level = 'warning'
      AND created_at > NOW() - INTERVAL '24 hours'
    `);

    const suspiciousIPs = await pool.query(`
      SELECT details->>'ip' as ip, COUNT(*) as attempts
      FROM logs 
      WHERE source = 'auth' 
      AND level = 'warning'
      AND created_at > NOW() - INTERVAL '24 hours'
      AND details->>'ip' IS NOT NULL
      GROUP BY details->>'ip'
      HAVING COUNT(*) > 3
      ORDER BY attempts DESC
      LIMIT 10
    `);

    const usersWithFailures = await pool.query(`
      SELECT COALESCE(details->>'email', details->>'attemptedEmail') as email, 
             details->>'userId' as userId, 
             COUNT(*) as attempts
      FROM logs 
      WHERE source = 'auth' 
      AND level = 'warning'
      AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY COALESCE(details->>'email', details->>'attemptedEmail'), details->>'userId'
      HAVING COUNT(*) > 2
      ORDER BY attempts DESC
      LIMIT 10
    `);

    res.json({
      data: {
        failedLoginsLast24h: parseInt(failedLogins.rows[0].count),
        suspiciousIPs: suspiciousIPs.rows,
        usersWithFailures: usersWithFailures.rows
      }
    });
  } catch (error) {
    console.error("Error fetching security summary:", error);
    res.status(500).json({ error: "Failed to fetch security summary" });
  }
});

// Delete a log entry
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM logs WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Log not found" });
    }
    res.json({ success: true, message: "Log deleted" });
  } catch (error) {
    console.error("Error deleting log:", error);
    res.status(500).json({ error: "Failed to delete log" });
  }
});

// Helper functions
function getStatus(level, message) {
  const msg = message.toLowerCase();
  if (level === 'error' || msg.includes('failed') || msg.includes('error')) {
    return 'failed';
  }
  if (level === 'warning' || msg.includes('warning') || msg.includes('suspicious')) {
    return 'warning';
  }
  return 'success';
}

function getAction(source, message) {
  const msg = message.toLowerCase();
  
  if (source === 'auth') {
    if (msg.includes('login')) return 'Login';
    if (msg.includes('logout')) return 'Logout';
    if (msg.includes('register')) return 'Registration';
    if (msg.includes('password')) return 'Password Change';
    if (msg.includes('failed')) return 'Failed Login';
    if (msg.includes('refresh')) return 'Token Refresh';
  }
  
  if (source === 'chat' || source === 'ai') {
    if (msg.includes('task') || msg.includes('execution')) return 'AI Task Execution';
    if (msg.includes('query')) return 'Data Query';
    if (msg.includes('error')) return 'AI Error';
    return 'AI Interaction';
  }
  
  if (source === 'data_marts') {
    if (msg.includes('connect')) return 'Database Connect';
    if (msg.includes('query')) return 'Data Query';
    if (msg.includes('disconnect')) return 'Database Disconnect';
    return 'Data Mart Activity';
  }
  
  if (source === 'admin') {
    if (msg.includes('user')) return 'User Management';
    if (msg.includes('assignment')) return 'Assignment Change';
    if (msg.includes('data mart')) return 'Data Mart Management';
    return 'Admin Action';
  }

  return source || 'System';
}

export default router;
