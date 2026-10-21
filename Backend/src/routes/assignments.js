import { Router } from "express";
import { pool } from "../services/db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Get my assignments (for business users)
router.get("/my", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT uda.*, COALESCE(dm.name, uda.data_mart_id) as data_mart_name FROM user_data_mart_assignments uda LEFT JOIN data_marts dm ON (dm.id::text = uda.data_mart_id::text OR dm.name = uda.data_mart_id::text) WHERE uda.user_id = $1 ORDER BY assigned_at DESC",
      [req.userId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching my assignments:", error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

router.use(requireAuth, requireAdmin);

router.get("/", async (req, res) => {
  const { user_id } = req.query;
  try {
    let query = `
      SELECT uda.*, COALESCE(dm.name, uda.data_mart_id) as data_mart_name
      FROM user_data_mart_assignments uda
      LEFT JOIN data_marts dm ON (dm.id::text = uda.data_mart_id::text OR dm.name = uda.data_mart_id::text)
    `;
    const values = [];
    if (user_id) {
      query += " WHERE uda.user_id = $1";
      values.push(user_id);
    }
    query += " ORDER BY uda.assigned_at DESC";
    const result = await pool.query(query, values);
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

router.post("/", async (req, res) => {
  const { user_id, schema_name, data_mart_id } = req.body;
  const martId = schema_name || data_mart_id;
  
  if (!user_id || !martId) {
    return res.status(400).json({ error: "user_id and data_mart_id are required" });
  }
  try {
    // Check if user is active
    const userResult = await pool.query(
      "SELECT id, status FROM profiles WHERE id = $1",
      [user_id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (userResult.rows[0].status !== 'active') {
      return res.status(400).json({ 
        error: "Cannot assign data mart to inactive user",
        userStatus: userResult.rows[0].status
      });
    }
    
    const result = await pool.query(
      `INSERT INTO user_data_mart_assignments (user_id, data_mart_id) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, data_mart_id) DO NOTHING
       RETURNING *`,
      [user_id, martId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ message: "Assignment already exists" });
    }
    
    res.json({ data: result.rows[0], message: "Assignment created" });
  } catch (error) {
    console.error("Error creating assignment:", error.message);
    res.status(500).json({ error: "Failed to create assignment: " + error.message });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM user_data_mart_assignments WHERE id = $1 RETURNING id",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    
    res.json({ message: "Assignment deleted" });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    res.status(500).json({ error: "Failed to delete assignment" });
  }
});

router.delete("/", async (req, res) => {
  const { user_id, schema_name } = req.query;
  
  if (!user_id || !schema_name) {
    return res.status(400).json({ error: "user_id and schema_name query parameters are required" });
  }
  
  try {
    const result = await pool.query(
      "DELETE FROM user_data_mart_assignments WHERE user_id = $1 AND data_mart_id = $2 RETURNING id",
      [user_id, schema_name]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    
    res.json({ message: "Assignment deleted" });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    res.status(500).json({ error: "Failed to delete assignment" });
  }
});

export default router;
