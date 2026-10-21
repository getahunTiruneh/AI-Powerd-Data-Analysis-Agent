import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "postgres",
  port: parseInt(process.env.DB_PORT || "5432"),
});

async function setup() {
  console.log("Connecting to database...");
  
  const client = await pool.connect();
  
  try {
    // Read and execute schema
    console.log("Creating schema...");
    const schemaPath = path.join(__dirname, '..', 'DB', 'schema.sql');
    console.log("Schema path:", schemaPath);
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    console.log("✓ Schema created");
    
    // Check if admin exists
    const { rows } = await client.query("SELECT * FROM profiles WHERE email = 'admin@cbe.com.et'");
    
    if (rows.length === 0) {
      // Create admin profile
      const profileResult = await client.query(`
        INSERT INTO profiles (id, name, email, dept, status)
        VALUES (gen_random_uuid(), 'Admin', 'admin@cbe.com.et', 'IT', 'active')
        RETURNING id
      `);
      const userId = profileResult.rows[0].id;
      
      // Hash password
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      // Create auth record
      await client.query(`
        INSERT INTO user_auth (user_id, password_hash)
        VALUES ($1, $2)
      `, [userId, hashedPassword]);
      
      // Make admin
      await client.query(`
        INSERT INTO user_roles (user_id, role)
        VALUES ($1, 'admin')
      `, [userId]);
      
      console.log("✓ Admin user created");
      console.log("\n========================================");
      console.log("  ADMIN CREDENTIALS:");
      console.log("  Email:    admin@cbe.com.et");
      console.log("  Password: admin123");
      console.log("========================================\n");
    } else {
      console.log("✓ Admin user already exists");
    }
    
    console.log("\n✅ Database setup complete!");
    
  } catch (err) {
    console.error("❌ Error:", err.message);
    if (err.code === '42P07') {
      console.log("  (Tables already exist - this is fine)");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
