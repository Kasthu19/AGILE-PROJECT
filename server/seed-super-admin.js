import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db, initializeDatabase } from './db.js';

const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD;
if (!email || !password) throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required');
if (password.length < 12) throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters');

await initializeDatabase();
await db.query(
  `INSERT INTO users (id, email, password_hash, full_name, role)
   VALUES (?, ?, ?, ?, 'super_admin')
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), full_name = VALUES(full_name), role = 'super_admin', tenant_id = NULL`,
  [randomUUID(), email, await bcrypt.hash(password, 12), process.env.SUPER_ADMIN_NAME ?? 'Super Admin'],
);
await db.end();
console.log(`MySQL super admin is ready: ${email}`);
