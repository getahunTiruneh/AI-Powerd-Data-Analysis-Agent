import { Router } from "express";
import { pool } from "../services/db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

// Health check - checks local database connection
router.get("/health", async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({ 
      status: "unhealthy",
      database: "disconnected",
      error: error.message
    });
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const [
      users,
      conversations,
      assignments,
      logs,
      chatMessages,
      hourlyQueries,
      dailyActivity,
      avgQueriesPerUser,
      querySuccessRate,
      topDataMarts,
      userActivity,
      failedLogins24h,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM profiles"),
      pool.query("SELECT COUNT(*) as count FROM chat_conversations"),
      pool.query("SELECT COUNT(*) as count FROM user_data_mart_assignments"),
      pool.query("SELECT COUNT(*) as count FROM logs"),
      pool.query("SELECT COUNT(*) as count FROM chat_messages WHERE role = 'user'"),
      pool.query(`
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM chat_messages
        WHERE role = 'user' AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `),
      pool.query(`
        SELECT 
          TO_CHAR(created_at, 'Day') as day,
          COUNT(DISTINCT user_id) as count
        FROM chat_conversations
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(DOW FROM created_at)
        ORDER BY EXTRACT(DOW FROM created_at)
      `),
      pool.query(`
        SELECT COALESCE(AVG(user_counts.cnt), 0) as avg_val
        FROM (
          SELECT COUNT(*) as cnt
          FROM chat_conversations
          GROUP BY user_id
        ) user_counts
      `),
      pool.query(`
        SELECT 
          ROUND(
            (COUNT(*) FILTER (WHERE level != 'error')::numeric / NULLIF(COUNT(*), 0)) * 100, 
            1
          ) as success_rate
        FROM logs
      `),
      pool.query(`
        SELECT COALESCE(dm.name, cc.data_mart_id::text) as name, COUNT(cc.id) as conversations
        FROM chat_conversations cc
        LEFT JOIN data_marts dm ON dm.id::text = cc.data_mart_id::text
          OR dm.name = cc.data_mart_id::text
        GROUP BY COALESCE(dm.name, cc.data_mart_id::text)
        ORDER BY conversations DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT p.name, p.email, COUNT(cc.id) as conversations
        FROM chat_conversations cc
        JOIN profiles p ON p.id = cc.user_id
        GROUP BY p.id, p.name, p.email
        ORDER BY conversations DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT COUNT(*) as count, 
               COUNT(DISTINCT details->>'userId') as unique_users,
               COALESCE(array_agg(DISTINCT details->>'userId') FILTER (WHERE details->>'userId' IS NOT NULL), '{}') as user_ids
        FROM logs
        WHERE source = 'auth' AND level = 'warning' AND created_at >= NOW() - INTERVAL '24 hours'
      `),
    ]);

    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sortedDaily = dailyActivity.rows.sort((a, b) => {
      const dayA = a.day.trim();
      const dayB = b.day.trim();
      return dayOrder.indexOf(dayA) - dayOrder.indexOf(dayB);
    });

    res.json({ 
      data: {
        totalUsers: parseInt(users.rows[0].count),
        totalConversations: parseInt(conversations.rows[0].count),
        totalAssignments: parseInt(assignments.rows[0].count),
        totalLogs: parseInt(logs.rows[0].count),
        totalQueries: parseInt(chatMessages.rows[0].count),
        hourlyQueries: hourlyQueries.rows.map(r => ({
          hour: parseInt(r.hour),
          count: parseInt(r.count),
        })),
        dailyActivity: sortedDaily.map(r => ({
          day: r.day.trim().substring(0, 3),
          count: parseInt(r.count),
        })),
        avgQueriesPerUser: parseFloat(avgQueriesPerUser.rows[0].avg_val).toFixed(1),
        querySuccessRate: parseFloat(querySuccessRate.rows[0].success_rate || 0).toFixed(1),
        topDataMarts: topDataMarts.rows,
        topUsers: userActivity.rows,
        failedLogins24h: parseInt(failedLogins24h.rows[0].count),
        failedLoginUsers: parseInt(failedLogins24h.rows[0].unique_users),
        failedLoginUserIds: failedLogins24h.rows[0].user_ids,
      }
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// Get conversation stats for admin dashboard (no chat content)
router.get("/conversation-stats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cc.id, cc.title, cc.user_id, cc.data_mart_id, dm.name as data_mart_name, 
             cc.created_at, cc.updated_at,
             p.name as user_name, p.email as user_email,
             COALESCE(msg.message_count, 0) as message_count
      FROM chat_conversations cc
      LEFT JOIN data_marts dm ON dm.id = cc.data_mart_id
      LEFT JOIN profiles p ON p.id = cc.user_id
      LEFT JOIN (
        SELECT conversation_id, COUNT(*) as message_count 
        FROM chat_messages 
        GROUP BY conversation_id
      ) msg ON msg.conversation_id = cc.id
      ORDER BY cc.updated_at DESC
      LIMIT 50
    `);
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Conversation stats error:", error);
    res.status(500).json({ error: "Failed to fetch conversation stats" });
  }
});

router.get("/logs", async (req, res) => {
  const { level, source, search } = req.query;
  try {
    const countsResult = await pool.query(`
      SELECT 
        level,
        COUNT(*) as count 
      FROM logs 
      GROUP BY level
    `);
    
    const counts = {
      info: 0,
      warning: 0,
      error: 0,
      debug: 0,
    };
    countsResult.rows.forEach(row => {
      if (counts.hasOwnProperty(row.level)) {
        counts[row.level] = parseInt(row.count);
      }
    });

    let query = "SELECT * FROM logs WHERE 1=1";
    const values = [];
    
    if (level && level !== 'all') {
      values.push(level);
      query += ` AND level = $${values.length}`;
    }
    if (source && source !== 'all') {
      values.push(source);
      query += ` AND source = $${values.length}`;
    }
    if (search) {
      values.push(`%${search}%`);
      query += ` AND (message ILIKE $${values.length} OR details ILIKE $${values.length})`;
    }
    
    query += " ORDER BY created_at DESC LIMIT 100";
    
    const result = await pool.query(query, values);
    
    const formattedLogs = result.rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      level: row.level,
      source: row.source,
      message: row.message,
      user: row.details?.user || row.details?.email || null,
      dataMart: row.details?.dataMart || row.details?.data_mart_id || null,
    }));
    
    res.json({ logs: formattedLogs, counts });
  } catch (error) {
    console.error("Logs error:", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

export default router;
