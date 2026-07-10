import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { db, initializeDatabase } from './db.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const jwtSecret = process.env.JWT_SECRET ?? 'change-this-development-secret';
const allowedOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const PLAN_LIMITS = { starter: 50, professional: 200, enterprise: 9999 };

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required');
  const hash = await bcrypt.hash(password, 12);
  await db.query(
    `INSERT IGNORE INTO users (id, email, password_hash, full_name, role)
     VALUES (?, ?, ?, ?, 'super_admin')`,
    [randomUUID(), email, hash, process.env.SUPER_ADMIN_NAME ?? 'Super Admin'],
  );
}

function authenticate(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  next();
}

function requireTuitionAdmin(req, res, next) {
  if (req.user.role !== 'tuition_admin' || !req.user.tenant_id) {
    return res.status(403).json({ error: 'Tuition admin access required' });
  }
  next();
}

app.get('/api/health', async (_req, res) => {
  await db.query('SELECT 1');
  res.json({ ok: true, database: 'mysql' });
});

app.post('/api/auth/login', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const profile = { id: user.id, full_name: user.full_name, role: user.role, tenant_id: user.tenant_id };
  const token = jwt.sign(profile, jwtSecret, { expiresIn: '12h' });
  res.json({ token, profile });
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT id, full_name, role, tenant_id, created_at, updated_at FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'User no longer exists' });
  res.json({ profile: rows[0] });
});

app.patch('/api/profile', authenticate, async (req, res) => {
  const fullName = req.body.full_name?.trim();
  if (!fullName) return res.status(400).json({ error: 'Full name is required' });
  await db.query('UPDATE users SET full_name = ? WHERE id = ?', [fullName, req.user.id]);
  res.json({ ok: true });
});

app.get('/api/admin/overview', authenticate, requireSuperAdmin, async (_req, res) => {
  const [[students], [payments]] = await Promise.all([
    db.query('SELECT COUNT(*) AS total_students FROM students'),
    db.query('SELECT COALESCE(SUM(amount), 0) AS total_collected FROM payments'),
  ]);
  res.json({ totalStudents: students[0].total_students, totalCollected: payments[0].total_collected });
});

app.get('/api/tuition/dashboard', authenticate, requireTuitionAdmin, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [[studentRows], [unpaidRows], [collectionRows], [recentRows]] = await Promise.all([
    db.query(
      `SELECT COUNT(*) AS total_students,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_students
       FROM students WHERE tenant_id = ?`,
      [tenantId],
    ),
    db.query(
      `SELECT COUNT(*) AS unpaid_count FROM fee_records
       WHERE tenant_id = ? AND status = 'unpaid' AND month = ? AND year = ?`,
      [tenantId, month, year],
    ),
    db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_date = CURRENT_DATE THEN amount ELSE 0 END), 0) AS today_collection,
         COALESCE(SUM(CASE WHEN MONTH(payment_date) = ? AND YEAR(payment_date) = ? THEN amount ELSE 0 END), 0) AS month_collection
       FROM payments WHERE tenant_id = ?`,
      [month, year, tenantId],
    ),
    db.query(
      `SELECT p.id, p.amount, p.payment_date, p.payment_method, s.full_name, s.student_code
       FROM payments p LEFT JOIN students s ON s.id = p.student_id
       WHERE p.tenant_id = ? ORDER BY p.created_at DESC LIMIT 5`,
      [tenantId],
    ),
  ]);

  res.json({
    totalStudents: studentRows[0].total_students,
    activeStudents: Number(studentRows[0].active_students ?? 0),
    unpaidCount: unpaidRows[0].unpaid_count,
    todayCollection: collectionRows[0].today_collection,
    monthCollection: collectionRows[0].month_collection,
    recentPayments: recentRows.map(row => ({
      id: row.id,
      amount: row.amount,
      payment_date: row.payment_date,
      payment_method: row.payment_method,
      students: row.full_name ? { full_name: row.full_name, student_code: row.student_code } : null,
    })),
  });
});

app.get('/api/tuition/students', authenticate, requireTuitionAdmin, async (req, res) => {
  const now = new Date();
  const month = Number(req.query.month) || now.getMonth() + 1;
  const year = Number(req.query.year) || now.getFullYear();
  const [[students], [tenants]] = await Promise.all([
    db.query(
      `SELECT s.*, COALESCE(f.status, 'unpaid') AS fee_status,
              COALESCE(f.amount_due, s.monthly_fee) AS amount_due,
              COALESCE(f.amount_paid, 0) AS amount_paid,
              GREATEST(COALESCE(f.amount_due, s.monthly_fee) - COALESCE(f.amount_paid, 0), 0) AS balance
       FROM students s
       LEFT JOIN fee_records f ON f.student_id = s.id AND f.tenant_id = s.tenant_id AND f.month = ? AND f.year = ?
       WHERE s.tenant_id = ? ORDER BY s.full_name`,
      [month, year, req.user.tenant_id],
    ),
    db.query('SELECT max_students FROM tenants WHERE id = ?', [req.user.tenant_id]),
  ]);
  res.json({ students, maxStudents: tenants[0]?.max_students ?? 50, month, year });
});

app.post('/api/tuition/students', authenticate, requireTuitionAdmin, async (req, res) => {
  const fields = normalizeStudentInput(req.body);
  if (!fields.student_code || !fields.full_name || !Number.isFinite(fields.monthly_fee)) {
    return res.status(400).json({ error: 'Student code, name, and monthly fee are required' });
  }
  const [[tenant], [countRows]] = await Promise.all([
    db.query('SELECT max_students FROM tenants WHERE id = ?', [req.user.tenant_id]),
    db.query('SELECT COUNT(*) AS total FROM students WHERE tenant_id = ?', [req.user.tenant_id]),
  ]);
  if (countRows[0].total >= (tenant[0]?.max_students ?? 50)) {
    return res.status(409).json({ error: 'Student limit reached' });
  }
  const id = randomUUID();
  try {
    await db.query(
      `INSERT INTO students
       (id, tenant_id, student_code, full_name, date_of_birth, gender, parent_name, parent_contact, address, course, monthly_fee, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.tenant_id, fields.student_code, fields.full_name, fields.date_of_birth, fields.gender, fields.parent_name, fields.parent_contact, fields.address, fields.course, fields.monthly_fee, fields.status],
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Student code already exists' });
    throw error;
  }
  const [rows] = await db.query('SELECT * FROM students WHERE id = ?', [id]);
  res.status(201).json({ student: rows[0] });
});

app.patch('/api/tuition/students/:id', authenticate, requireTuitionAdmin, async (req, res) => {
  const fields = normalizeStudentInput(req.body);
  const keys = ['full_name', 'date_of_birth', 'gender', 'parent_name', 'parent_contact', 'address', 'course', 'monthly_fee', 'status'];
  await db.query(
    `UPDATE students SET ${keys.map(key => `${key} = ?`).join(', ')} WHERE id = ? AND tenant_id = ?`,
    [...keys.map(key => fields[key]), req.params.id, req.user.tenant_id],
  );
  res.json({ ok: true });
});

app.delete('/api/tuition/students/:id', authenticate, requireTuitionAdmin, async (req, res) => {
  await db.query('DELETE FROM students WHERE id = ? AND tenant_id = ?', [req.params.id, req.user.tenant_id]);
  res.json({ ok: true });
});

app.post('/api/tuition/scan', authenticate, requireTuitionAdmin, async (req, res) => {
  const studentId = req.body.studentId?.trim();
  if (!studentId) return res.status(400).json({ error: 'Student QR code is required' });

  const [studentRows] = await db.query(
    'SELECT * FROM students WHERE id = ? AND tenant_id = ? LIMIT 1',
    [studentId, req.user.tenant_id],
  );
  const student = studentRows[0];
  if (!student) return res.status(404).json({ error: 'Student not found in your institute.' });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const [feeRows] = await db.query(
    'SELECT * FROM fee_records WHERE student_id = ? AND tenant_id = ? AND month = ? AND year = ? LIMIT 1',
    [student.id, req.user.tenant_id, month, year],
  );
  let feeRecord = feeRows[0];

  if (!feeRecord) {
    const id = randomUUID();
    const dueDate = `${year}-${String(month).padStart(2, '0')}-15`;
    await db.query(
      `INSERT INTO fee_records
       (id, tenant_id, student_id, month, year, amount_due, amount_paid, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'unpaid', ?)`,
      [id, req.user.tenant_id, student.id, month, year, student.monthly_fee, dueDate],
    );
    const [createdRows] = await db.query('SELECT * FROM fee_records WHERE id = ?', [id]);
    feeRecord = createdRows[0];
  }

  res.json({ student, feeRecord });
});

app.get('/api/tuition/students/:id/profile', authenticate, requireTuitionAdmin, async (req, res) => {
  const [students] = await db.query('SELECT * FROM students WHERE id = ? AND tenant_id = ? LIMIT 1', [req.params.id, req.user.tenant_id]);
  if (!students[0]) return res.status(404).json({ error: 'Student not found' });
  const [fees] = await db.query('SELECT * FROM fee_records WHERE student_id = ? AND tenant_id = ? ORDER BY year DESC, month DESC', [req.params.id, req.user.tenant_id]);
  res.json({ student: students[0], fees });
});

app.post('/api/tuition/fees/:id/pay', authenticate, requireTuitionAdmin, async (req, res) => {
  const amount = Number(req.body.amount);
  const method = req.body.method || 'cash';
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Enter a valid amount' });
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [fees] = await connection.query('SELECT * FROM fee_records WHERE id = ? AND tenant_id = ? FOR UPDATE', [req.params.id, req.user.tenant_id]);
    const fee = fees[0];
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });
    const newPaid = Number(fee.amount_paid) + amount;
    const status = newPaid >= Number(fee.amount_due) ? 'paid' : 'partial';
    const paymentId = randomUUID();
    const receiptId = randomUUID();
    const receiptNumber = `RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
    await connection.query(
      `INSERT INTO payments (id, tenant_id, student_id, fee_record_id, amount, payment_method, payment_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, ?)`,
      [paymentId, req.user.tenant_id, fee.student_id, fee.id, amount, method, req.body.notes || null, req.user.id],
    );
    await connection.query('UPDATE fee_records SET amount_paid = ?, status = ? WHERE id = ?', [newPaid, status, fee.id]);
    await connection.query(
      `INSERT INTO receipts (id, tenant_id, payment_id, student_id, receipt_number, amount, payment_date, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE, ?)`,
      [receiptId, req.user.tenant_id, paymentId, fee.student_id, receiptNumber, amount, method],
    );
    await connection.commit();
    const [updated] = await db.query('SELECT * FROM fee_records WHERE id = ?', [fee.id]);
    res.status(201).json({ feeRecord: updated[0], receipt: { receiptNumber, amount, date: new Date().toISOString().slice(0, 10), method } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

app.get('/api/tuition/payments', authenticate, requireTuitionAdmin, async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.id, p.amount, p.payment_date, p.payment_method, p.notes, s.full_name, s.student_code, r.receipt_number
     FROM payments p LEFT JOIN students s ON s.id = p.student_id LEFT JOIN receipts r ON r.payment_id = p.id
     WHERE p.tenant_id = ? AND MONTH(p.payment_date) = ? AND YEAR(p.payment_date) = ? ORDER BY p.payment_date DESC`,
    [req.user.tenant_id, Number(req.query.month), Number(req.query.year)],
  );
  res.json({ payments: rows.map(row => ({ ...row, students: row.full_name ? { full_name: row.full_name, student_code: row.student_code } : null, receipts: row.receipt_number ? [{ receipt_number: row.receipt_number }] : [] })) });
});

app.get('/api/tuition/reports', authenticate, requireTuitionAdmin, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const type = req.query.type;
  if (type === 'unpaid') {
    const [rows] = await db.query(
      `SELECT f.id, f.amount_due, f.amount_paid, s.full_name, s.student_code, s.parent_contact
       FROM fee_records f JOIN students s ON s.id = f.student_id
       WHERE f.tenant_id = ? AND f.status <> 'paid' AND f.month = ? AND f.year = ?`,
      [tenantId, Number(req.query.month), Number(req.query.year)],
    );
    return res.json({ rows: rows.map(row => ({ ...row, students: { full_name: row.full_name, student_code: row.student_code, parent_contact: row.parent_contact } })) });
  }
  const params = [tenantId];
  let filter = '';
  if (type === 'student') {
    filter = ' AND p.student_id = ?';
    params.push(req.query.studentId);
  } else {
    filter = ' AND MONTH(p.payment_date) = ? AND YEAR(p.payment_date) = ?';
    params.push(Number(req.query.month), Number(req.query.year));
  }
  const [rows] = await db.query(
    `SELECT p.id, p.amount, p.payment_date, p.payment_method, s.full_name, s.student_code
     FROM payments p LEFT JOIN students s ON s.id = p.student_id WHERE p.tenant_id = ?${filter} ORDER BY p.payment_date DESC`,
    params,
  );
  res.json({ rows: rows.map(row => ({ ...row, students: row.full_name ? { full_name: row.full_name, student_code: row.student_code } : null })) });
});

app.get('/api/tuition/settings', authenticate, requireTuitionAdmin, async (req, res) => {
  const [[tenants], [counts]] = await Promise.all([
    db.query('SELECT * FROM tenants WHERE id = ?', [req.user.tenant_id]),
    db.query('SELECT COUNT(*) AS student_count FROM students WHERE tenant_id = ?', [req.user.tenant_id]),
  ]);
  res.json({ tenant: tenants[0], studentCount: counts[0].student_count });
});

app.patch('/api/tuition/settings', authenticate, requireTuitionAdmin, async (req, res) => {
  const { name, email, phone, address } = req.body;
  await db.query('UPDATE tenants SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?', [name, email, phone || null, address || null, req.user.tenant_id]);
  res.json({ ok: true });
});

function normalizeStudentInput(body) {
  return {
    student_code: body.student_code?.trim(),
    full_name: body.full_name?.trim(),
    date_of_birth: body.date_of_birth || null,
    gender: body.gender || null,
    parent_name: body.parent_name?.trim() || null,
    parent_contact: body.parent_contact?.trim() || null,
    address: body.address?.trim() || null,
    course: body.course?.trim() || null,
    monthly_fee: Number(body.monthly_fee),
    status: body.status === 'inactive' ? 'inactive' : 'active',
  };
}

app.get('/api/institutes', authenticate, requireSuperAdmin, async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM tenants ORDER BY created_at DESC');
  res.json({ tenants: rows });
});

app.post('/api/institutes', authenticate, requireSuperAdmin, async (req, res) => {
  const { name, email, phone = null, address = null, subscriptionPlan = 'starter', adminName, adminPassword } = req.body;
  if (!name?.trim() || !email?.trim() || !adminName?.trim() || !adminPassword) return res.status(400).json({ error: 'All admin fields are required' });
  if (adminPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!(subscriptionPlan in PLAN_LIMITS)) return res.status(400).json({ error: 'Invalid subscription plan' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const tenantId = randomUUID();
    const userId = randomUUID();
    const normalizedEmail = email.trim().toLowerCase();
    await connection.query(
      `INSERT INTO tenants (id, name, email, phone, address, status, subscription_plan, max_students, owner_user_id)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [tenantId, name.trim(), normalizedEmail, phone || null, address || null, subscriptionPlan, PLAN_LIMITS[subscriptionPlan], userId],
    );
    await connection.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, tenant_id) VALUES (?, ?, ?, ?, 'tuition_admin', ?)`,
      [userId, normalizedEmail, await bcrypt.hash(adminPassword, 12), adminName.trim(), tenantId],
    );
    await connection.commit();
    const [rows] = await db.query('SELECT * FROM tenants WHERE id = ?', [tenantId]);
    res.status(201).json({ tenant: rows[0] });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Admin email already exists' });
    throw error;
  } finally {
    connection.release();
  }
});

app.patch('/api/institutes/:id', authenticate, requireSuperAdmin, async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'address', 'status', 'subscription_plan'];
  const fields = Object.entries(req.body).filter(([key]) => allowed.includes(key));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields supplied' });
  if (req.body.subscription_plan) fields.push(['max_students', PLAN_LIMITS[req.body.subscription_plan]]);
  await db.query(`UPDATE tenants SET ${fields.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`, [...fields.map(([, value]) => value), req.params.id]);
  res.json({ ok: true });
});

app.get('/api/subscription-plans', authenticate, requireSuperAdmin, async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM subscription_plans ORDER BY monthly_price');
  res.json({ plans: rows.map(row => ({ ...row, features: typeof row.features === 'string' ? JSON.parse(row.features) : row.features })) });
});

app.get('/api/admin/payments', authenticate, requireSuperAdmin, async (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  const [rows] = await db.query(
    `SELECT p.id, p.amount, p.payment_date, p.payment_method,
            s.full_name AS student_name, s.student_code, t.name AS tenant_name
     FROM payments p LEFT JOIN students s ON s.id = p.student_id
     LEFT JOIN tenants t ON t.id = p.tenant_id
     WHERE MONTH(p.payment_date) = ? AND YEAR(p.payment_date) = ?
     ORDER BY p.payment_date DESC`,
    [month, year],
  );
  res.json({ payments: rows.map(row => ({ ...row, students: row.student_name ? { full_name: row.student_name, student_code: row.student_code } : null, tenants: row.tenant_name ? { name: row.tenant_name } : null })) });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

await initializeDatabase();
await seedSuperAdmin();
app.listen(port, () => console.log(`MySQL API listening on http://localhost:${port}`));
