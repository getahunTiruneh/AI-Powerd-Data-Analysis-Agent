import { Router } from "express";
import { pool } from "../services/db.js";
import { logActivity, LogSources, LogLevels } from '../services/logger.js';
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT cc.*, dm.name as data_mart_name
      FROM chat_conversations cc
      LEFT JOIN data_marts dm ON dm.id = cc.data_mart_id
      WHERE cc.user_id = $1
      ORDER BY cc.updated_at DESC
    `;
    const result = await pool.query(query, [req.userId]);
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    let query = "SELECT * FROM chat_conversations WHERE id = $1";
    let params = [id];
    
    if (req.userRole !== 'admin') {
      query += " AND user_id = $2";
      params.push(req.userId);
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.get("/:id/messages", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/", async (req, res) => {
  const { data_mart_id, title } = req.body;
  const user_id = req.userId;
  
  try {
    let dmId = data_mart_id;
    if (dmId && !dmId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const lookup = await pool.query(
        "SELECT id FROM data_marts WHERE name = $1 OR id::text = $1 LIMIT 1",
        [dmId]
      );
      dmId = lookup.rows.length > 0 ? lookup.rows[0].id : null;
    }
    
    const result = await pool.query(
      `INSERT INTO chat_conversations (user_id, data_mart_id, title) 
       VALUES ($1, $2, $3) RETURNING *`,
      [user_id, dmId || null, title || 'New Conversation']
    );
    await logActivity(LogLevels.INFO, LogSources.CHAT, `New conversation created`, { conversationId: result.rows[0].id, dataMart: data_mart_id });
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.post("/:id/messages", async (req, res) => {
  const { id } = req.params;
  const { role, content } = req.body;
  if (!role || !content) {
    return res.status(400).json({ error: "role and content are required" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages (conversation_id, role, content) 
       VALUES ($1, $2, $3) RETURNING *`,
      [id, role, content]
    );
    
    await pool.query(
      "UPDATE chat_conversations SET updated_at = now() WHERE id = $1",
      [id]
    );
    
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "Failed to save message" });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, bookmarked } = req.body;
  
  try {
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (bookmarked !== undefined) { updates.push(`bookmarked = $${paramCount++}`); values.push(bookmarked); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "At least one field (title or bookmarked) is required" });
    }
    
    values.push(id);
    const result = await pool.query(
      `UPDATE chat_conversations SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    if (bookmarked !== undefined) {
      await logActivity(LogLevels.INFO, LogSources.CHAT, bookmarked ? `Conversation bookmarked` : `Bookmark removed`, { conversationId: id });
    }
    
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM chat_conversations WHERE id = $1", [id]);
    await logActivity(LogLevels.INFO, LogSources.CHAT, `Conversation deleted`, { conversationId: id });
    res.json({ message: "Conversation deleted" });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;
