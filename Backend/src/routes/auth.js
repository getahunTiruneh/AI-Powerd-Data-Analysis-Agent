import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../services/db.js';
import { logActivity, LogSources, LogLevels } from '../services/logger.js';
import { notifyAdminNewUser } from './notifications.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { name, email, password, dept } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (!email.toLowerCase().endsWith('@cbe.com.et')) {
    return res.status(400).json({ error: 'Only @cbe.com.et email addresses are allowed to register.' });
  }

  try {
    const { rows: users } = await pool.query(
      "SELECT id FROM profiles WHERE email = $1", [email]
    );

    if (users.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO profiles (id, name, email, dept) VALUES ($1, $2, $3, $4)`,
      [userId, name, email, dept || 'General']
    );

    await pool.query(
      `INSERT INTO user_auth (user_id, password_hash) VALUES ($1, $2)`,
      [userId, passwordHash]
    );

    await pool.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`,
      [userId, 'business_user']
    );

    await logActivity(LogLevels.INFO, LogSources.AUTH, `New user registered: ${name} (${email})`, { userId, userName: name, email, dept, req });
    await notifyAdminNewUser({ name, email });
    res.json({ id: userId, name, email, dept, message: 'User registered successfully' });
  } catch (err) {
    await logActivity(LogLevels.ERROR, LogSources.AUTH, `Registration failed for ${email}: ${err.message}`, { email, error: err.message, req });
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { rows: users } = await pool.query(
      `SELECT p.*, ua.password_hash FROM profiles p
       JOIN user_auth ua ON ua.user_id = p.id
       WHERE p.email = $1`, [email]
    );

    if (!users.length) {
      await logActivity(LogLevels.WARNING, LogSources.AUTH, `Login failed - user not found: ${email}`, { attemptedEmail: email, req });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await logActivity(LogLevels.WARNING, LogSources.AUTH, `Login failed - invalid password for: ${email}`, { attemptedEmail: email, req });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.status !== 'active') {
      await logActivity(LogLevels.WARNING, LogSources.AUTH, `Login failed - account ${user.status}: ${email}`, { attemptedEmail: email, userId: user.id, req });
      return res.status(403).json({ error: `Account is ${user.status}` });
    }

    const { rows: roles } = await pool.query(
      `SELECT role FROM user_roles WHERE user_id = $1`, [user.id]
    );
    const role = roles.some(r => r.role === 'admin') ? 'admin' : 'business_user';

    const token = jwt.sign(
      { userId: user.id, role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logActivity(LogLevels.INFO, LogSources.AUTH, `User logged in: ${user.name}`, { userId: user.id, userName: user.name, email, role, req });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role, status: user.status, dept: user.dept }
    });
  } catch (err) {
    await logActivity(LogLevels.ERROR, LogSources.AUTH, `Login error: ${err.message}`, { email, req });
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// User self-update profile (requires auth)
router.patch('/profile', requireAuth, async (req, res) => {
  const { name, dept } = req.body;
  const userId = req.userId;

  if (!name && !dept) {
    return res.status(400).json({ error: 'name or dept is required' });
  }

  try {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) { updates.push(`name = $${paramCount++}`); values.push(name); }
    if (dept) { updates.push(`dept = $${paramCount++}`); values.push(dept); }
    values.push(userId);

    const result = await pool.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, dept`,
      values
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// User change password
router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.userId;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT password_hash FROM user_auth WHERE user_id = $1`, [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      `UPDATE user_auth SET password_hash = $1 WHERE user_id = $2`, [hashedPassword, userId]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.email, p.dept, p.status
       FROM profiles p WHERE p.id = $1`, [req.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { rows: roles } = await pool.query(
      `SELECT role FROM user_roles WHERE user_id = $1`, [req.userId]
    );
    const role = roles.some(r => r.role === 'admin') ? 'admin' : 'business_user';

    res.json({ user: { ...rows[0], role } });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Request password reset
// SECURITY: Always returns 200 regardless of email existence to prevent user enumeration attacks.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT p.id FROM profiles p WHERE p.email = $1`, [email]
    );

    // Always return 200 to prevent user enumeration attacks
    if (!rows.length) {
      return res.json({ success: true, message: 'If that email is registered, a reset link has been generated.' });
    }

    const userId = rows[0].id;
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      `UPDATE user_auth SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3`,
      [resetToken, expires, userId]
    );

    await logActivity(LogLevels.INFO, LogSources.AUTH, `Password reset requested`, { userId, email });

    // NOTE: In production, send the reset token via email to the user.
    // The token is intentionally NOT returned in the HTTP response to prevent exposure.
    // For development/testing, the token is logged server-side only.
    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);

    res.json({ success: true, message: 'If that email is registered, a reset link has been generated.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM user_auth
       WHERE reset_token = $1 AND reset_token_expires > NOW()`, [token]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const userId = rows[0].user_id;
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `UPDATE user_auth SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2`,
      [hashedPassword, userId]
    );

    await logActivity(LogLevels.INFO, LogSources.AUTH, `Password reset completed`, { userId });

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
