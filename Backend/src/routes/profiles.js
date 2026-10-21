import { Router } from "express";
import { pool } from "../services/db.js";
import { logActivity, LogSources, LogLevels } from '../services/logger.js';
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/roles", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM user_roles");
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM profiles ORDER BY created_at DESC");
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching profiles:", error);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM profiles WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.get("/:id/roles", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM user_roles WHERE user_id = $1", [id]);
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching user roles:", error);
    res.status(500).json({ error: "Failed to fetch user roles" });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, status, role } = req.body;
  
  if (!name && !status && !role) {
    return res.status(400).json({ error: "At least one field (name, status, or role) is required" });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const profileResult = await client.query("SELECT * FROM profiles WHERE id = $1", [id]);
    const profile = profileResult.rows[0];
    
    if (name || status) {
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (name) { updates.push(`name = $${paramCount++}`); values.push(name); }
      if (status) { updates.push(`status = $${paramCount++}`); values.push(status); }
      values.push(id);
      
      await client.query(
        `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );
      
      if (status && status !== profile?.status) {
        const statusMessages = {
          active: 'Your account has been activated by the administrator.',
          suspended: 'Your account has been suspended. Please contact the administrator.',
          pending: 'Your account status has been changed to pending.'
        };
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, 'account_status', 'Account Status Updated', $2, '/profile')`,
          [id, statusMessages[status] || `Your account status has been updated to ${status}.`]
        );
      }
    }
    
    if (role) {
      await client.query("DELETE FROM user_roles WHERE user_id = $1", [id]);
      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, $2)",
        [id, role]
      );
      
      if (role === 'admin') {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, 'promotion', 'Promoted to Admin', 'You have been promoted to administrator.', '/admin')`,
          [id]
        );
      }
    }
    
    await client.query('COMMIT');
    await logActivity(LogLevels.INFO, LogSources.ADMIN, `User profile updated: ${profile.name}`, { 
      userId: req.userId, userName: profile.name, targetUserId: id, targetUserName: name || profile.name, req 
    });
    res.json({ message: "Profile updated" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  } finally {
    client.release();
  }
});

router.post("/:id/promote-to-admin", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query("DELETE FROM user_roles WHERE user_id = $1", [id]);
    await client.query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')",
      [id]
    );
    
    await client.query("UPDATE profiles SET status = 'active' WHERE id = $1", [id]);
    
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, 'promotion', 'Promoted to Admin', 'You have been promoted to administrator.', '/admin')`,
      [id]
    );
    
    await client.query('COMMIT');
    res.json({ message: "User promoted to admin" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error promoting user:", error);
    res.status(500).json({ error: "Failed to promote user to admin" });
  } finally {
    client.release();
  }
});

export default router;
