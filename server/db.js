import 'dotenv/config';
import mysql from 'mysql2/promise';

const required = ['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

export const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
});

export async function initializeDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      max_students INT NOT NULL,
      monthly_price DECIMAL(10,2) NOT NULL,
      features JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NULL,
      address TEXT NULL,
      status ENUM('active','suspended','pending') NOT NULL DEFAULT 'pending',
      subscription_plan VARCHAR(50) NOT NULL DEFAULT 'starter',
      max_students INT NOT NULL DEFAULT 50,
      owner_user_id CHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NULL,
      role ENUM('super_admin','tuition_admin') NOT NULL DEFAULT 'tuition_admin',
      tenant_id CHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_tenant (tenant_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS students (
      id CHAR(36) PRIMARY KEY,
      tenant_id CHAR(36) NOT NULL,
      student_code VARCHAR(100) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      date_of_birth DATE NULL,
      gender ENUM('male','female','other') NULL,
      parent_name VARCHAR(255) NULL,
      parent_contact VARCHAR(100) NULL,
      address TEXT NULL,
      course VARCHAR(255) NULL,
      monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      registration_date DATE NOT NULL DEFAULT (CURRENT_DATE),
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_student_code (tenant_id, student_code),
      INDEX idx_students_tenant (tenant_id)
    )
  `);
  const studentColumns = [
    ['date_of_birth', 'DATE NULL'],
    ['gender', "ENUM('male','female','other') NULL"],
    ['parent_name', 'VARCHAR(255) NULL'],
    ['parent_contact', 'VARCHAR(100) NULL'],
    ['address', 'TEXT NULL'],
    ['course', 'VARCHAR(255) NULL'],
    ['monthly_fee', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
    ['registration_date', 'DATE NULL'],
    ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ];
  for (const [name, definition] of studentColumns) {
    const [columns] = await db.query(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students' AND COLUMN_NAME = ?`,
      [process.env.MYSQL_DATABASE, name],
    );
    if (!columns.length) await db.query(`ALTER TABLE students ADD COLUMN ${name} ${definition}`);
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id CHAR(36) PRIMARY KEY,
      tenant_id CHAR(36) NOT NULL,
      student_id CHAR(36) NULL,
      fee_record_id CHAR(36) NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
      payment_date DATE NOT NULL,
      notes TEXT NULL,
      created_by CHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_payments_tenant_date (tenant_id, payment_date)
    )
  `);
  const paymentColumns = [
    ['fee_record_id', 'CHAR(36) NULL'],
    ['notes', 'TEXT NULL'],
    ['created_by', 'CHAR(36) NULL'],
  ];
  for (const [name, definition] of paymentColumns) {
    const [columns] = await db.query(
      `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments' AND COLUMN_NAME = ?`,
      [process.env.MYSQL_DATABASE, name],
    );
    if (!columns.length) await db.query(`ALTER TABLE payments ADD COLUMN ${name} ${definition}`);
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS fee_records (
      id CHAR(36) PRIMARY KEY,
      tenant_id CHAR(36) NOT NULL,
      student_id CHAR(36) NOT NULL,
      month INT NOT NULL,
      year INT NOT NULL,
      amount_due DECIMAL(10,2) NOT NULL,
      amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
      status ENUM('paid','unpaid','partial') NOT NULL DEFAULT 'unpaid',
      due_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_student_month (student_id, month, year),
      INDEX idx_fee_tenant_status (tenant_id, status)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id CHAR(36) PRIMARY KEY,
      tenant_id CHAR(36) NOT NULL,
      payment_id CHAR(36) NOT NULL,
      student_id CHAR(36) NOT NULL,
      receipt_number VARCHAR(100) NOT NULL UNIQUE,
      amount DECIMAL(10,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_receipts_payment (payment_id)
    )
  `);

  const plans = [
    ['starter', 50, 29, ['Up to 50 students', 'QR code generation', 'Basic reports']],
    ['professional', 200, 79, ['Up to 200 students', 'Advanced reports', 'PDF receipts']],
    ['enterprise', 9999, 199, ['Unlimited students', 'Full analytics', 'API access']],
  ];
  for (const [name, maxStudents, monthlyPrice, features] of plans) {
    await db.query(
      `INSERT IGNORE INTO subscription_plans (id, name, max_students, monthly_price, features)
       VALUES (UUID(), ?, ?, ?, ?)`,
      [name, maxStudents, monthlyPrice, JSON.stringify(features)],
    );
  }
}
