import { Router } from "express";
import { pool } from "../services/db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

// Get all messages (admin)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT m.*, c.user_id FROM chat_messages m JOIN chat_conversations c ON m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 100"
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

export default router;
