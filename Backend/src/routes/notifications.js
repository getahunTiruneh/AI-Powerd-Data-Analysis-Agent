import { Router } from "express";
import { pool } from "../services/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

// Get all notifications for current user
router.get("/", async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';
    let query;
    let params;
    
    if (isAdmin) {
      query = `
        SELECT n.*, p.name as user_name, p.email as user_email
        FROM notifications n
        LEFT JOIN profiles p ON n.user_id = p.id
        WHERE n.user_id = $1 OR n.type IN ('system', 'user_registration', 'data_mart')
        ORDER BY n.created_at DESC
        LIMIT 50
      `;
      params = [req.userId];
    } else {
      query = `
        SELECT * FROM notifications 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 50
      `;
      params = [req.userId];
    }
    
    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Get unread count
router.get("/unread-count", async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';
    let query;
    let params;
    
    if (isAdmin) {
      query = `
        SELECT COUNT(*) as count FROM notifications 
        WHERE (user_id = $1 OR type IN ('system', 'user_registration', 'data_mart'))
        AND is_read = FALSE
      `;
      params = [req.userId];
    } else {
      query = `
        SELECT COUNT(*) as count FROM notifications 
        WHERE user_id = $1 AND is_read = FALSE
      `;
      params = [req.userId];
    }
    
    const result = await pool.query(query, params);
    res.json({ data: { count: parseInt(result.rows[0].count) } });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

// Mark notification as read
router.patch("/:id/read", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Mark all as read
router.patch("/read-all", async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';
    let query;
    let params;
    
    if (isAdmin) {
      query = `
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE (user_id = $1 OR type IN ('system', 'user_registration', 'data_mart'))
        AND is_read = FALSE
      `;
      params = [req.userId];
    } else {
      query = `
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE user_id = $1 AND is_read = FALSE
      `;
      params = [req.userId];
    }
    
    await pool.query(query, params);
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all as read:", error);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

// Delete notification
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM notifications WHERE id = $1", [id]);
    res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// Notify admin for user registration
export async function notifyAdminNewUser(user) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link) 
       SELECT p.id, 'user_registration', 'New User Registration', $1, '/admin/users'
       FROM profiles p
       JOIN user_roles r ON r.user_id = p.id AND r.role = 'admin'
      `,
      [`New user "${user.name}" (${user.email}) has registered and is pending approval.`]
    );
  } catch (error) {
    console.error("Error notifying admin:", error);
  }
}

export default router;
