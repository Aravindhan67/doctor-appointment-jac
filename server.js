require("dotenv").config();
const mysql = require("mysql2/promise");
const http = require("http");
const { Server: SocketIO } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "medislot_dev_secret_change_in_prod";
const JWT_EXPIRES = "8h";

let io = null; // Socket.io instance (set after server starts)

const PORT = process.env.PORT || 4173;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "medislot-db.json");

const roles = ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"];

function seedDatabase() {
  return {
  plans: [
    { id: "plan_starter", name: "Starter", price: 999, maxDoctors: 5, maxStaff: 3, features: ["Booking", "Doctor dashboard", "Patient dashboard"] },
    { id: "plan_professional", name: "Professional", price: 2499, maxDoctors: 25, maxStaff: 15, features: ["Analytics", "Receptionist queue", "Printable slips"] },
    { id: "plan_enterprise", name: "Enterprise", price: 7999, maxDoctors: 100, maxStaff: 50, features: ["Multi-branch ready", "Priority support", "Custom reports"] }
  ],
  hospitals: [
    { id: "hospital_001", name: "CityCare Hospital", city: "Chennai", state: "Tamil Nadu", active: true, planId: "plan_starter", subscription: "TRIAL" },
    { id: "hospital_002", name: "MediPlus Clinic", city: "Erode", state: "Tamil Nadu", active: true, planId: "plan_professional", subscription: "ACTIVE" }
  ],
  departments: [
    { id: "dept_001", hospitalId: "hospital_001", name: "Cardiology" },
    { id: "dept_002", hospitalId: "hospital_001", name: "Dermatology" },
    { id: "dept_003", hospitalId: "hospital_001", name: "Orthopedics" },
    { id: "dept_004", hospitalId: "hospital_002", name: "General Medicine" }
  ],
  users: [
    { id: "user_000", hospitalId: null, name: "Platform Owner", email: "super@medislot.test", role: "SUPER_ADMIN", active: true },
    { id: "user_001", hospitalId: "hospital_001", name: "Nandhini Admin", email: "admin@citycare.test", role: "HOSPITAL_ADMIN", active: true },
    { id: "user_002", hospitalId: "hospital_001", name: "Dr. Arjun Kumar", email: "doctor@citycare.test", role: "DOCTOR", active: true, doctorId: "doctor_001" },
    { id: "user_003", hospitalId: "hospital_001", name: "Kavya Reception", email: "reception@citycare.test", role: "RECEPTIONIST", active: true },
    { id: "user_004", hospitalId: "hospital_001", name: "Ravi Kumar", email: "patient@citycare.test", role: "PATIENT", active: true, patientId: "patient_001" }
  ],
  doctors: [
    { id: "doctor_001", userId: "user_002", hospitalId: "hospital_001", departmentId: "dept_001", name: "Dr. Arjun Kumar", specialisation: "Heart Specialist", fee: 600, experience: 12, active: true },
    { id: "doctor_002", userId: "user_005", hospitalId: "hospital_001", departmentId: "dept_002", name: "Dr. Meera Priya", specialisation: "Skin Specialist", fee: 500, experience: 8, active: true },
    { id: "doctor_003", userId: "user_006", hospitalId: "hospital_002", departmentId: "dept_004", name: "Dr. Farhan Ali", specialisation: "General Physician", fee: 450, experience: 10, active: true }
  ],
  patients: [
    { id: "patient_001", userId: "user_004", hospitalId: "hospital_001", name: "Ravi Kumar", age: 42, gender: "Male", bloodGroup: "O+", phone: "+91 98765 43210" },
    { id: "patient_002", userId: "user_007", hospitalId: "hospital_001", name: "Priya S", age: 29, gender: "Female", bloodGroup: "B+", phone: "+91 91234 56780" },
    { id: "patient_003", userId: "user_008", hospitalId: "hospital_001", name: "Anitha R", age: 35, gender: "Female", bloodGroup: "A+", phone: "+91 99887 76655" }
  ],
  availability: [
    { doctorId: "doctor_001", days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "13:00", duration: 30 },
    { doctorId: "doctor_002", days: [1, 2, 3, 4, 5], start: "10:00", end: "15:00", duration: 30 },
    { doctorId: "doctor_003", days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "12:30", duration: 20 }
  ],
  appointments: [
    { id: "appt_001", code: "MED-10001", hospitalId: "hospital_001", patientId: "patient_001", doctorId: "doctor_001", start: todayAt("09:30"), end: todayAt("10:00"), status: "CONFIRMED", reason: "Chest pain consultation", notes: "" },
    { id: "appt_002", code: "MED-10002", hospitalId: "hospital_001", patientId: "patient_002", doctorId: "doctor_002", start: todayAt("10:30"), end: todayAt("11:00"), status: "WAITING", reason: "Skin allergy review", notes: "" },
    { id: "appt_003", code: "MED-10003", hospitalId: "hospital_001", patientId: "patient_003", doctorId: "doctor_001", start: todayAt("11:00"), end: todayAt("11:30"), status: "EMERGENCY", reason: "Severe breathing discomfort", notes: "" },
    { id: "appt_004", code: "MED-10004", hospitalId: "hospital_001", patientId: "patient_001", doctorId: "doctor_002", start: daysFromNowAt(-1, "12:00"), end: daysFromNowAt(-1, "12:30"), status: "COMPLETED", reason: "Follow-up review", notes: "Vitals stable. Continue prescribed medication." }
  ],
  payments: [
    { id: "pay_001", hospitalId: "hospital_002", planId: "plan_professional", amount: 2499, status: "CAPTURED", date: daysFromNowAt(-12, "10:00") }
  ],
  receptionistAssignments: [
    { receptionistId: "user_003", hospitalId: "hospital_001", doctorId: "doctor_001", startTime: "09:00", endTime: "17:00", updatedAt: new Date().toISOString() }
  ],
  emergencyLeaves: [],
  notifications: [],
  settings: {
    platformName: "MediSlot",
    supportEmail: "support@medislot.test",
    trialDays: 14,
    allowPatientSignup: true,
    maintenanceMode: false
  },
  audit: []
};
}

let db = seedDatabase();
let dbPool = null;

async function loadDatabase() {
  const seed = seedDatabase();
  try {
    const tempConnection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
    });
    const dbName = process.env.DB_NAME || "medislot";
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await tempConnection.end();

    dbPool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        price INT,
        maxDoctors INT,
        maxStaff INT,
        features JSON
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS hospitals (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        city VARCHAR(100),
        state VARCHAR(100),
        active BOOLEAN,
        planId VARCHAR(50),
        subscription VARCHAR(50)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(50) PRIMARY KEY,
        hospitalId VARCHAR(50),
        name VARCHAR(100)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        hospitalId VARCHAR(50),
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE,
        role VARCHAR(50),
        password VARCHAR(100),
        active BOOLEAN,
        doctorId VARCHAR(50),
        patientId VARCHAR(50)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50),
        hospitalId VARCHAR(50),
        departmentId VARCHAR(50),
        name VARCHAR(100),
        specialisation VARCHAR(100),
        fee INT,
        experience INT,
        active BOOLEAN
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50),
        hospitalId VARCHAR(50),
        name VARCHAR(100),
        age INT,
        gender VARCHAR(20),
        bloodGroup VARCHAR(10),
        phone VARCHAR(20)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS availability (
        doctorId VARCHAR(50) PRIMARY KEY,
        days JSON,
        start VARCHAR(10),
        end VARCHAR(10),
        duration INT
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50),
        hospitalId VARCHAR(50),
        patientId VARCHAR(50),
        doctorId VARCHAR(50),
        start VARCHAR(50),
        end VARCHAR(50),
        status VARCHAR(50),
        reason TEXT,
        notes TEXT,
        previousStart VARCHAR(50),
        previousEnd VARCHAR(50),
        rescheduledAt VARCHAR(50),
        rescheduleReason TEXT,
        emergencyLeaveId VARCHAR(50),
        patientName VARCHAR(100),
        age INT,
        previousReport TEXT,
        reportPhotoName VARCHAR(255),
        reportPhotoDataUrl LONGTEXT
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(50) PRIMARY KEY,
        hospitalId VARCHAR(50),
        planId VARCHAR(50),
        amount INT,
        status VARCHAR(50),
        date VARCHAR(50)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS receptionist_assignments (
        receptionistId VARCHAR(50) PRIMARY KEY,
        hospitalId VARCHAR(50),
        doctorId VARCHAR(50),
        startTime VARCHAR(10),
        endTime VARCHAR(10),
        updatedAt VARCHAR(50)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS emergency_leaves (
        id VARCHAR(50) PRIMARY KEY,
        hospitalId VARCHAR(50),
        doctorId VARCHAR(50),
        start VARCHAR(50),
        end VARCHAR(50),
        reason TEXT,
        createdBy VARCHAR(50),
        createdAt VARCHAR(50)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50),
        hospitalId VARCHAR(50),
        appointmentId VARCHAR(50),
        type VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        \`read\` BOOLEAN,
        createdAt VARCHAR(50)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY,
        platformName VARCHAR(255),
        supportEmail VARCHAR(255),
        trialDays INT,
        allowPatientSignup BOOLEAN,
        maintenanceMode BOOLEAN
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS audit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        at VARCHAR(50),
        action VARCHAR(100),
        actor VARCHAR(100),
        target VARCHAR(100),
        role VARCHAR(50),
        hospitalId VARCHAR(50),
        appointmentId VARCHAR(50),
        doctorId VARCHAR(50),
        receptionistId VARCHAR(50),
        leaveId VARCHAR(50),
        count INT,
        rescheduled INT,
        planId VARCHAR(50),
        status VARCHAR(50)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(50) PRIMARY KEY,
        patientId VARCHAR(50),
        name VARCHAR(255),
        url TEXT,
        createdAt VARCHAR(50)
      )
    `);

    try {
      await dbPool.query("ALTER TABLE appointments ADD COLUMN queueOrder INT DEFAULT 0");
    } catch (e) {
      // column likely already exists
    }

    // Helper to seed table if empty
    async function seedTable(tableName, items, insertQuery, mapFn) {
      const [countRows] = await dbPool.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      if (countRows[0].count === 0 && items && items.length > 0) {
        for (const item of items) {
          await dbPool.query(insertQuery, mapFn(item));
        }
      }
    }

    // Seeding individual tables
    await seedTable("plans", seed.plans, 
      "INSERT INTO plans (id, name, price, maxDoctors, maxStaff, features) VALUES (?, ?, ?, ?, ?, ?)",
      item => [item.id, item.name, item.price, item.maxDoctors, item.maxStaff, JSON.stringify(item.features)]
    );

    await seedTable("hospitals", seed.hospitals,
      "INSERT INTO hospitals (id, name, city, state, active, planId, subscription) VALUES (?, ?, ?, ?, ?, ?, ?)",
      item => [item.id, item.name, item.city, item.state, item.active, item.planId, item.subscription]
    );

    await seedTable("departments", seed.departments,
      "INSERT INTO departments (id, hospitalId, name) VALUES (?, ?, ?)",
      item => [item.id, item.hospitalId, item.name]
    );

    await seedTable("users", seed.users,
      "INSERT INTO users (id, hospitalId, name, email, role, password, active, doctorId, patientId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      item => [item.id, item.hospitalId, item.name, item.email, item.role, item.password || "demo123", item.active, item.doctorId || null, item.patientId || null]
    );

    await seedTable("doctors", seed.doctors,
      "INSERT INTO doctors (id, userId, hospitalId, departmentId, name, specialisation, fee, experience, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      item => [item.id, item.userId, item.hospitalId, item.departmentId, item.name, item.specialisation, item.fee, item.experience, item.active]
    );

    await seedTable("patients", seed.patients,
      "INSERT INTO patients (id, userId, hospitalId, name, age, gender, bloodGroup, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      item => [item.id, item.userId, item.hospitalId, item.name, item.age, item.gender, item.bloodGroup, item.phone]
    );

    await seedTable("availability", seed.availability,
      "INSERT INTO availability (doctorId, days, start, end, duration) VALUES (?, ?, ?, ?, ?)",
      item => [item.doctorId, JSON.stringify(item.days), item.start, item.end, item.duration]
    );

    await seedTable("appointments", seed.appointments,
      "INSERT INTO appointments (id, code, hospitalId, patientId, doctorId, start, end, status, reason, notes, previousStart, previousEnd, rescheduledAt, rescheduleReason, emergencyLeaveId, patientName, age, previousReport, reportPhotoName, reportPhotoDataUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      item => [item.id, item.code, item.hospitalId, item.patientId, item.doctorId, item.start, item.end, item.status, item.reason, item.notes, item.previousStart || null, item.previousEnd || null, item.rescheduledAt || null, item.rescheduleReason || null, item.emergencyLeaveId || null, item.patientName || null, item.age || null, item.previousReport || null, item.reportPhotoName || null, item.reportPhotoDataUrl || null]
    );

    await seedTable("payments", seed.payments,
      "INSERT INTO payments (id, hospitalId, planId, amount, status, date) VALUES (?, ?, ?, ?, ?, ?)",
      item => [item.id, item.hospitalId, item.planId, item.amount, item.status, item.date]
    );

    await seedTable("receptionist_assignments", seed.receptionistAssignments,
      "INSERT INTO receptionist_assignments (receptionistId, hospitalId, doctorId, startTime, endTime, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      item => [item.receptionistId, item.hospitalId, item.doctorId, item.startTime, item.endTime, item.updatedAt]
    );

    await seedTable("emergency_leaves", seed.emergencyLeaves,
      "INSERT INTO emergency_leaves (id, hospitalId, doctorId, start, end, reason, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      item => [item.id, item.hospitalId, item.doctorId, item.start, item.end, item.reason, item.createdBy, item.createdAt]
    );

    await seedTable("notifications", seed.notifications,
      "INSERT INTO notifications (id, userId, hospitalId, appointmentId, type, title, message, \`read\`, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      item => [item.id, item.userId, item.hospitalId, item.appointmentId, item.type, item.title, item.message, item.read, item.createdAt]
    );

    // Seeding single row settings
    const [settingsRows] = await dbPool.query("SELECT COUNT(*) as count FROM settings");
    if (settingsRows[0].count === 0) {
      await dbPool.query(
        "INSERT INTO settings (id, platformName, supportEmail, trialDays, allowPatientSignup, maintenanceMode) VALUES (1, ?, ?, ?, ?, ?)",
        [seed.settings.platformName, seed.settings.supportEmail, seed.settings.trialDays, seed.settings.allowPatientSignup, seed.settings.maintenanceMode]
      );
    }

    await seedTable("audit", seed.audit,
      "INSERT INTO audit (at, action, actor, target, role, hospitalId, appointmentId, doctorId, receptionistId, leaveId, count, rescheduled, planId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      item => [item.at, item.action, item.actor, item.target || null, item.role || null, item.hospitalId || null, item.appointmentId || null, item.doctorId || null, item.receptionistId || null, item.leaveId || null, item.count || null, item.rescheduled || null, item.planId || null, item.status || null]
    );

    // Fetch and reconstruct db object
    const [plans] = await dbPool.query("SELECT * FROM plans");
    const [hospitals] = await dbPool.query("SELECT * FROM hospitals");
    const [departments] = await dbPool.query("SELECT * FROM departments");
    const [users] = await dbPool.query("SELECT * FROM users");
    const [doctors] = await dbPool.query("SELECT * FROM doctors");
    const [patients] = await dbPool.query("SELECT * FROM patients");
    const [availability] = await dbPool.query("SELECT * FROM availability");
    const [appointments] = await dbPool.query("SELECT * FROM appointments");
    const [payments] = await dbPool.query("SELECT * FROM payments");
    const [receptionistAssignments] = await dbPool.query("SELECT * FROM receptionist_assignments");
    const [emergencyLeaves] = await dbPool.query("SELECT * FROM emergency_leaves");
    const [notifications] = await dbPool.query("SELECT * FROM notifications");
    const [settingsDb] = await dbPool.query("SELECT * FROM settings WHERE id = 1");
    const [audit] = await dbPool.query("SELECT * FROM audit");
    const [documents] = await dbPool.query("SELECT * FROM documents");

    // Map features and days back to parsed JSON objects
    const parsedPlans = plans.map(p => ({ ...p, features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features }));
    const parsedAvailability = availability.map(a => ({ ...a, days: typeof a.days === 'string' ? JSON.parse(a.days) : a.days }));

    return {
      plans: parsedPlans,
      hospitals,
      departments,
      users: users.map(u => ({ ...u, active: !!u.active })),
      doctors: doctors.map(d => ({ ...d, active: !!d.active })),
      patients: patients.map(p => ({ ...p })),
      availability: parsedAvailability,
      appointments: appointments.map(appt => ({
        ...appt,
        age: appt.age !== null ? Number(appt.age) : null
      })),
      payments,
      receptionistAssignments,
      emergencyLeaves,
      notifications: notifications.map(n => ({ ...n, read: !!n.read })),
      settings: {
        platformName: settingsDb[0].platformName,
        supportEmail: settingsDb[0].supportEmail,
        trialDays: Number(settingsDb[0].trialDays),
        allowPatientSignup: !!settingsDb[0].allowPatientSignup,
        maintenanceMode: !!settingsDb[0].maintenanceMode
      },
      audit,
      documents
    };
  } catch (error) {
    console.error("Could not load database from MySQL. Starting with seed data.", error.message);
    return seed;
  }
}

async function saveDatabase(data = db) {
  if (!dbPool) {
    console.error("Database pool not initialized. Cannot save.");
    return;
  }
  try {
    // 1. Sync plans
    for (const item of data.plans) {
      await dbPool.query(
        "REPLACE INTO plans (id, name, price, maxDoctors, maxStaff, features) VALUES (?, ?, ?, ?, ?, ?)",
        [item.id, item.name, item.price, item.maxDoctors, item.maxStaff, JSON.stringify(item.features)]
      );
    }
    // 2. Sync hospitals
    for (const item of data.hospitals) {
      await dbPool.query(
        "REPLACE INTO hospitals (id, name, city, state, active, planId, subscription) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.name, item.city, item.state, item.active, item.planId, item.subscription]
      );
    }
    // 3. Sync departments
    for (const item of data.departments) {
      await dbPool.query(
        "REPLACE INTO departments (id, hospitalId, name) VALUES (?, ?, ?)",
        [item.id, item.hospitalId, item.name]
      );
    }
    // 4. Sync users
    for (const item of data.users) {
      await dbPool.query(
        "REPLACE INTO users (id, hospitalId, name, email, role, password, active, doctorId, patientId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.hospitalId, item.name, item.email, item.role, item.password || "demo123", item.active, item.doctorId || null, item.patientId || null]
      );
    }
    // 5. Sync doctors
    for (const item of data.doctors) {
      await dbPool.query(
        "REPLACE INTO doctors (id, userId, hospitalId, departmentId, name, specialisation, fee, experience, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.userId, item.hospitalId, item.departmentId, item.name, item.specialisation, item.fee, item.experience, item.active]
      );
    }
    // 6. Sync patients
    for (const item of data.patients) {
      await dbPool.query(
        "REPLACE INTO patients (id, userId, hospitalId, name, age, gender, bloodGroup, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.userId, item.hospitalId, item.name, item.age, item.gender, item.bloodGroup, item.phone]
      );
    }
    // 7. Sync availability
    for (const item of data.availability) {
      await dbPool.query(
        "REPLACE INTO availability (doctorId, days, start, end, duration) VALUES (?, ?, ?, ?, ?)",
        [item.doctorId, JSON.stringify(item.days), item.start, item.end, item.duration]
      );
    }
    // 8. Sync appointments
    for (const item of data.appointments) {
      await dbPool.query(
        "REPLACE INTO appointments (id, code, hospitalId, patientId, doctorId, start, end, status, reason, notes, previousStart, previousEnd, rescheduledAt, rescheduleReason, emergencyLeaveId, patientName, age, previousReport, reportPhotoName, reportPhotoDataUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.code, item.hospitalId, item.patientId, item.doctorId, item.start, item.end, item.status, item.reason, item.notes, item.previousStart || null, item.previousEnd || null, item.rescheduledAt || null, item.rescheduleReason || null, item.emergencyLeaveId || null, item.patientName || null, item.age || null, item.previousReport || null, item.reportPhotoName || null, item.reportPhotoDataUrl || null]
      );
    }
    // 9. Sync payments
    for (const item of data.payments) {
      await dbPool.query(
        "REPLACE INTO payments (id, hospitalId, planId, amount, status, date) VALUES (?, ?, ?, ?, ?, ?)",
        [item.id, item.hospitalId, item.planId, item.amount, item.status, item.date]
      );
    }
    // 10. Sync receptionist assignments
    for (const item of data.receptionistAssignments) {
      await dbPool.query(
        "REPLACE INTO receptionist_assignments (receptionistId, hospitalId, doctorId, startTime, endTime, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [item.receptionistId, item.hospitalId, item.doctorId, item.startTime, item.endTime, item.updatedAt]
      );
    }
    // 11. Sync emergency leaves
    for (const item of data.emergencyLeaves) {
      await dbPool.query(
        "REPLACE INTO emergency_leaves (id, hospitalId, doctorId, start, end, reason, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.hospitalId, item.doctorId, item.start, item.end, item.reason, item.createdBy, item.createdAt]
      );
    }
    // 12. Sync notifications
    for (const item of data.notifications) {
      await dbPool.query(
        "REPLACE INTO notifications (id, userId, hospitalId, appointmentId, type, title, message, \`read\`, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.userId, item.hospitalId, item.appointmentId, item.type, item.title, item.message, item.read, item.createdAt]
      );
    }
    // 13. Sync settings
    await dbPool.query(
      "UPDATE settings SET platformName = ?, supportEmail = ?, trialDays = ?, allowPatientSignup = ?, maintenanceMode = ? WHERE id = 1",
      [data.settings.platformName, data.settings.supportEmail, data.settings.trialDays, data.settings.allowPatientSignup, data.settings.maintenanceMode]
    );
    // 14. Sync audit log
    const [auditCountRows] = await dbPool.query("SELECT COUNT(*) as count FROM audit");
    const dbCount = auditCountRows[0].count;
    if (data.audit.length > dbCount) {
      const newAudits = data.audit.slice(dbCount);
      for (const item of newAudits) {
        await dbPool.query(
          "INSERT INTO audit (at, action, actor, target, role, hospitalId, appointmentId, doctorId, receptionistId, leaveId, count, rescheduled, planId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [item.at, item.action, item.actor, item.target || null, item.role || null, item.hospitalId || null, item.appointmentId || null, item.doctorId || null, item.receptionistId || null, item.leaveId || null, item.count || null, item.rescheduled || null, item.planId || null, item.status || null]
        );
      }
    }
  } catch (error) {
    console.error("Could not save database to MySQL:", error.message);
  }
}

function todayAt(time) {
  return daysFromNowAt(0, time);
}

function daysFromNowAt(days, time) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(data);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendStatic(req, res) {
  let requestPath = decodeURIComponent(req.url.split("?")[0]);
  if (requestPath === "/" || requestPath === "/app") requestPath = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return json(res, 403, { success: false, message: "Forbidden" });
  fs.readFile(filePath, (error, content) => {
    if (error) return json(res, 404, { success: false, message: "Not found" });
    const ext = path.extname(filePath);
    const type = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  });
}

function tokenFor(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, hospitalId: user.hospitalId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function currentUser(req, url) {
  const raw = (req.headers.authorization || "").replace("Bearer ", "") || url?.searchParams.get("token") || "";
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    return db.users.find((user) => user.id === payload.userId) || null;
  } catch {
    return null;
  }
}

function tenantRows(rows, user) {
  if (!user || user.role === "SUPER_ADMIN") return rows;
  return rows.filter((row) => row.hospitalId === user.hospitalId);
}

function hospitalOf(user) {
  return user?.hospitalId ? db.hospitals.find((hospital) => hospital.id === user.hospitalId) : null;
}

function safeUser(user) {
  if (!user) return user;
  const { password, ...publicUser } = user;
  return publicUser;
}

function appointmentView(appt) {
  const patient = db.patients.find((item) => item.id === appt.patientId);
  const doctor = db.doctors.find((item) => item.id === appt.doctorId);
  const department = db.departments.find((item) => item.id === doctor?.departmentId);
  const hospital = db.hospitals.find((item) => item.id === appt.hospitalId);
  return { ...appt, patientName: appt.patientName || patient?.name, doctorName: doctor?.name, departmentName: department?.name, hospitalName: hospital?.name };
}

function assignmentView(assignment) {
  const receptionist = db.users.find((item) => item.id === assignment.receptionistId);
  const doctor = db.doctors.find((item) => item.id === assignment.doctorId);
  const hospital = db.hospitals.find((item) => item.id === assignment.hospitalId);
  return {
    ...assignment,
    receptionistName: receptionist?.name,
    receptionistEmail: receptionist?.email,
    doctorName: doctor?.name,
    doctorSpecialisation: doctor?.specialisation,
    hospitalName: hospital?.name
  };
}

function paymentView(payment) {
  const hospital = db.hospitals.find((item) => item.id === payment.hospitalId);
  const plan = db.plans.find((item) => item.id === payment.planId);
  return { ...payment, hospitalName: hospital?.name, planName: plan?.name };
}

function visibleNotifications(user) {
  return db.notifications
    .filter((item) => item.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function notifyUsers(userIds, payload) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const createdAt = new Date().toISOString();
  for (const userId of uniqueIds) {
    db.notifications.push({
      id: `notif_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      hospitalId: payload.hospitalId,
      appointmentId: payload.appointmentId,
      type: payload.type || "APPOINTMENT",
      title: payload.title,
      message: payload.message,
      read: false,
      createdAt
    });
  }
}

function notifyAppointmentBooked(appt, actor) {
  const view = appointmentView(appt);
  const doctor = db.doctors.find((item) => item.id === appt.doctorId);
  const doctorUserId = doctor?.userId;
  const assignedReceptionists = db.receptionistAssignments
    .filter((item) => item.doctorId === appt.doctorId)
    .map((item) => item.receptionistId);
  const fallbackReceptionists = assignedReceptionists.length
    ? []
    : db.users.filter((item) => item.hospitalId === appt.hospitalId && item.role === "RECEPTIONIST").map((item) => item.id);
  notifyUsers([doctorUserId, ...assignedReceptionists, ...fallbackReceptionists], {
    hospitalId: appt.hospitalId,
    appointmentId: appt.id,
    type: "NEW_APPOINTMENT",
    title: "New appointment booked",
    message: `${view.patientName || "A patient"} booked ${view.code} with ${view.doctorName || "doctor"} at ${new Date(appt.start).toLocaleString()}.`
  });
  db.audit.push({ at: new Date().toISOString(), action: "SEND_APPOINTMENT_NOTIFICATION", actor: actor.email, appointmentId: appt.id });
}

function notifyDoctorReceptionistAssigned(assignment, actor) {
  const view = assignmentView(assignment);
  const doctor = db.doctors.find((item) => item.id === assignment.doctorId);
  notifyUsers([doctor?.userId], {
    hospitalId: assignment.hospitalId,
    appointmentId: null,
    type: "RECEPTIONIST_ASSIGNMENT",
    title: "Receptionist assigned",
    message: `${view.receptionistName || "A receptionist"} is now working under you from ${assignment.startTime} to ${assignment.endTime}.`
  });
  db.audit.push({ at: new Date().toISOString(), action: "SEND_RECEPTIONIST_ASSIGNMENT_NOTIFICATION", actor: actor.email, doctorId: assignment.doctorId, receptionistId: assignment.receptionistId });
}

function notifyEmergencyReschedule(leave, doctor, rescheduled, actor) {
  const doctorName = doctor?.name || "Doctor";
  for (const appt of rescheduled) {
    const view = appointmentView(appt);
    const patient = db.patients.find((item) => item.id === appt.patientId);
    notifyUsers([patient?.userId], {
      hospitalId: appt.hospitalId,
      appointmentId: appt.id,
      type: "DOCTOR_EMERGENCY_LEAVE",
      title: "Doctor emergency leave",
      message: `${doctorName} marked emergency leave from ${new Date(leave.start).toLocaleString()} to ${new Date(leave.end).toLocaleString()}. Your appointment ${view.code} is being moved to the next available slot.`
    });
    notifyUsers([patient?.userId], {
      hospitalId: appt.hospitalId,
      appointmentId: appt.id,
      type: "EMERGENCY_RESCHEDULE",
      title: "Appointment rescheduled",
      message: `${view.code} with ${doctorName} was rescheduled to ${new Date(appt.start).toLocaleString()} due to doctor emergency leave.`
    });
  }
  const assignedReceptionists = db.receptionistAssignments.filter((item) => item.doctorId === doctor.id).map((item) => item.receptionistId);
  const fallbackReceptionists = assignedReceptionists.length ? [] : db.users.filter((item) => item.hospitalId === doctor.hospitalId && item.role === "RECEPTIONIST").map((item) => item.id);
  const hospitalAdmins = db.users.filter((item) => item.hospitalId === doctor.hospitalId && item.role === "HOSPITAL_ADMIN").map((item) => item.id);
  const otherDoctors = db.doctors.filter((item) => item.hospitalId === doctor.hospitalId && item.id !== doctor.id).map((item) => item.userId);
  notifyUsers([...assignedReceptionists, ...fallbackReceptionists, ...hospitalAdmins, ...otherDoctors], {
    hospitalId: doctor.hospitalId,
    appointmentId: null,
    type: "EMERGENCY_RESCHEDULE",
    title: "Doctor emergency leave",
    message: `${doctorName} marked emergency leave from ${new Date(leave.start).toLocaleString()} to ${new Date(leave.end).toLocaleString()}. ${rescheduled.length} appointment${rescheduled.length === 1 ? "" : "s"} rescheduled.`
  });
  db.audit.push({ at: new Date().toISOString(), action: "SEND_EMERGENCY_RESCHEDULE_NOTIFICATIONS", actor: actor.email, doctorId: doctor.id, leaveId: leave.id, count: rescheduled.length });
}

function visibleAssignments(user) {
  if (user.role === "SUPER_ADMIN") return db.receptionistAssignments.map(assignmentView);
  if (user.role === "DOCTOR") return db.receptionistAssignments.filter((item) => item.doctorId === user.doctorId).map(assignmentView);
  if (user.role === "RECEPTIONIST") return db.receptionistAssignments.filter((item) => item.receptionistId === user.id).map(assignmentView);
  return db.receptionistAssignments.filter((item) => item.hospitalId === user.hospitalId).map(assignmentView);
}

const activeAppointmentStatuses = ["PENDING", "CONFIRMED", "WAITING", "EMERGENCY", "RESCHEDULED"];

function rangesOverlap(startA, endA, startB, endB) {
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
}

function slotBlockedByLeave(doctorId, start, end) {
  return db.emergencyLeaves.some((leave) => leave.doctorId === doctorId && rangesOverlap(start, end, leave.start, leave.end));
}

function generateSlots(doctorId, dateText) {
  const availability = db.availability.find((item) => item.doctorId === doctorId);
  if (!availability) return [];
  const date = new Date(`${dateText}T00:00:00`);
  if (!availability.days.includes(date.getDay())) return [];
  const [startH, startM] = availability.start.split(":").map(Number);
  const [endH, endM] = availability.end.split(":").map(Number);
  const cursor = new Date(date);
  cursor.setHours(startH, startM, 0, 0);
  const finish = new Date(date);
  finish.setHours(endH, endM, 0, 0);
  const slots = [];
  while (cursor < finish) {
    const slotEnd = new Date(cursor.getTime() + availability.duration * 60000);
    if (slotEnd <= finish) {
      const startIso = cursor.toISOString();
      const endIso = slotEnd.toISOString();
      const busy = db.appointments.some((appt) => appt.doctorId === doctorId && activeAppointmentStatuses.includes(appt.status) && appt.start === startIso);
      slots.push({ start: startIso, end: endIso, available: !busy && !slotBlockedByLeave(doctorId, startIso, endIso) });
    }
    cursor.setTime(slotEnd.getTime());
  }
  return slots;
}

function findNextAvailableSlots(doctorId, afterIso, count) {
  const results = [];
  const cursor = new Date(afterIso);
  for (let i = 0; i < 90 && results.length < count; i++) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + i);
    const dateText = date.toISOString().slice(0, 10);
    for (const slot of generateSlots(doctorId, dateText)) {
      if (new Date(slot.start) > new Date(afterIso) && slot.available) results.push(slot);
      if (results.length === count) break;
    }
  }
  return results;
}

function dashboardFor(user) {
  const hospital = hospitalOf(user);
  const appointments = (user.role === "PATIENT" ? db.appointments : tenantRows(db.appointments, user)).map(appointmentView);
  const today = new Date().toDateString();
  const todayAppointments = appointments.filter((appt) => new Date(appt.start).toDateString() === today);
  if (user.role === "SUPER_ADMIN") {
    const revenue = db.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return {
      kpis: [
        ["Total hospitals", db.hospitals.length],
        ["Active subscriptions", db.hospitals.filter((item) => item.subscription === "ACTIVE").length],
        ["Monthly revenue", `Rs. ${revenue.toLocaleString("en-IN")}`],
        ["Expired subscriptions", db.hospitals.filter((item) => item.subscription === "EXPIRED").length]
      ],
      chart: db.plans.map((plan) => ({ label: plan.name, value: db.hospitals.filter((h) => h.planId === plan.id).length + 1 }))
    };
  }
  if (user.role === "HOSPITAL_ADMIN") {
    return {
      hospital,
      kpis: [
        ["Doctors", tenantRows(db.doctors, user).length],
        ["Patients", tenantRows(db.patients, user).length],
        ["Completed", appointments.filter((appt) => appt.status === "COMPLETED").length],
        ["Cancelled", appointments.filter((appt) => appt.status === "CANCELLED").length]
      ],
      chart: tenantRows(db.departments, user).map((dept) => ({ label: dept.name, value: appointments.filter((appt) => appt.departmentName === dept.name).length + 1 }))
    };
  }
  if (user.role === "DOCTOR") {
    const mine = appointments.filter((appt) => appt.doctorId === user.doctorId);
    return {
      hospital,
      kpis: [
        ["Today's appointments", mine.filter((appt) => new Date(appt.start).toDateString() === today).length],
        ["Pending", mine.filter((appt) => appt.status === "PENDING").length],
        ["Completed", mine.filter((appt) => appt.status === "COMPLETED").length],
        ["Daily patients", new Set(todayAppointments.filter((appt) => appt.doctorId === user.doctorId).map((appt) => appt.patientId)).size]
      ],
      appointments: mine
    };
  }
  if (user.role === "RECEPTIONIST") {
    const assignment = receptionistAssignment(user);
    const queueAppointments = assignment ? todayAppointments.filter((appt) => appt.doctorId === assignment.doctorId) : todayAppointments;
    return {
      hospital,
      kpis: [
        ["Today's queue", queueAppointments.length],
        ["Waiting", queueAppointments.filter((appt) => appt.status === "WAITING").length],
        ["Emergency", queueAppointments.filter((appt) => appt.status === "EMERGENCY").length],
        ["Completed", queueAppointments.filter((appt) => appt.status === "COMPLETED").length]
      ],
      appointments: queueAppointments.sort((a, b) => (a.status === "EMERGENCY" ? -1 : 0) - (b.status === "EMERGENCY" ? -1 : 0))
    };
  }
  const mine = appointments.filter((appt) => appt.patientId === user.patientId);
  return {
    hospital,
    kpis: [
      ["Upcoming", mine.filter((appt) => ["PENDING", "CONFIRMED", "WAITING", "EMERGENCY"].includes(appt.status)).length],
      ["Completed", mine.filter((appt) => appt.status === "COMPLETED").length],
      ["Cancelled", mine.filter((appt) => appt.status === "CANCELLED").length],
      ["Medical records", 3]
    ],
    appointments: mine
  };
}

function canBook(user) {
  const hospital = hospitalOf(user);
  return user.role === "SUPER_ADMIN" || !hospital || ["ACTIVE", "TRIAL"].includes(hospital.subscription);
}

function receptionistAssignment(user) {
  if (user.role !== "RECEPTIONIST") return null;
  return db.receptionistAssignments.find((item) => item.receptionistId === user.id) || null;
}

function canAccessAppointment(user, appt) {
  if (!appt) return false;
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "PATIENT") return appt.patientId === user.patientId;
  if (appt.hospitalId !== user.hospitalId) return false;
  if (user.role === "DOCTOR") return appt.doctorId === user.doctorId;
  if (user.role === "RECEPTIONIST") {
    const assignment = receptionistAssignment(user);
    return !assignment || assignment.doctorId === appt.doctorId;
  }
  return user.role === "HOSPITAL_ADMIN";
}

function canManageAppointment(user, appt) {
  if (!canAccessAppointment(user, appt)) return false;
  return ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "RECEPTIONIST"].includes(user.role);
}

async function api(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const user = currentUser(req, url);
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const body = await parseBody(req);
    const found = db.users.find((item) => item.email === body.email);
    if (!found) return json(res, 401, { success: false, message: "Invalid email or password." });
    const storedPwd = found.password || "demo123";
    const isHash = storedPwd.startsWith("$2");
    const match = isHash ? await bcrypt.compare(body.password, storedPwd) : body.password === storedPwd;
    if (!match) return json(res, 401, { success: false, message: "Invalid email or password." });
    if (db.settings.maintenanceMode && found.role !== "SUPER_ADMIN") return json(res, 503, { success: false, message: "Platform maintenance mode is enabled." });
    const hospital = hospitalOf(found);
    if (!found.active || hospital?.subscription === "CANCELLED" || hospital?.active === false) return json(res, 403, { success: false, message: "Account is inactive." });
    return json(res, 200, { success: true, token: tokenFor(found), user: safeUser(found) });
  }
  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    if (!db.settings.allowPatientSignup) return json(res, 403, { success: false, message: "Patient signup is currently disabled." });
    const body = await parseBody(req);
    const role = "PATIENT";
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    if (!name || !email || !String(body.password || "").trim()) return json(res, 400, { success: false, message: "Name, email, and password are required." });
    if (db.users.some((item) => item.email.toLowerCase() === email)) return json(res, 409, { success: false, message: "Email already exists. Try login instead." });
    const hospitalId = body.hospitalId || "hospital_001";
    const id = `user_${crypto.randomUUID().slice(0, 8)}`;
    const hashedPassword = await bcrypt.hash(String(body.password), 10);
    const user = { id, hospitalId, name, email, role, password: hashedPassword, active: true };
    if (role === "PATIENT") {
      const patientId = `patient_${crypto.randomUUID().slice(0, 8)}`;
      user.patientId = patientId;
      db.patients.push({ id: patientId, userId: id, hospitalId, name, age: Number(body.age || 30), gender: body.gender || "Not specified", bloodGroup: body.bloodGroup || "NA", phone: body.phone || "" });
    }
    db.users.push(user);
    db.audit.push({ at: new Date().toISOString(), action: "REGISTER", actor: email, role });
    saveDatabase();
    return json(res, 201, { success: true, token: tokenFor(user), user: safeUser(user) });
  }
  if (!user) return json(res, 401, { success: false, message: "Unauthorized" });
  if (url.pathname === "/api/admin/users" && req.method === "POST") {
    if (user.role !== "SUPER_ADMIN") return json(res, 403, { success: false, message: "Only Super Admin can add doctors and receptionists." });
    const body = await parseBody(req);
    const role = body.role === "DOCTOR" ? "DOCTOR" : body.role === "RECEPTIONIST" ? "RECEPTIONIST" : null;
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const hospitalId = body.hospitalId || "hospital_001";
    const hospital = db.hospitals.find((item) => item.id === hospitalId);
    if (!role) return json(res, 400, { success: false, message: "Role must be Doctor or Receptionist." });
    if (!hospital) return json(res, 400, { success: false, message: "Select a valid hospital." });
    if (!name || !email || !String(body.password || "").trim()) return json(res, 400, { success: false, message: "Name, email, and password are required." });
    if (db.users.some((item) => item.email.toLowerCase() === email)) return json(res, 409, { success: false, message: "Email already exists." });
    const id = `user_${crypto.randomUUID().slice(0, 8)}`;
    const newUser = { id, hospitalId, name, email, role, password: String(body.password), active: true };
    if (role === "DOCTOR") {
      const doctorId = `doctor_${crypto.randomUUID().slice(0, 8)}`;
      const departmentId = body.departmentId || db.departments.find((dept) => dept.hospitalId === hospitalId)?.id;
      newUser.doctorId = doctorId;
      db.doctors.push({ id: doctorId, userId: id, hospitalId, departmentId, name, specialisation: body.specialisation || "General Medicine", fee: Number(body.fee || 400), experience: Number(body.experience || 1), active: true });
      db.availability.push({ doctorId, days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "13:00", duration: 30 });
    }
    db.users.push(newUser);
    db.audit.push({ at: new Date().toISOString(), action: "SUPER_ADMIN_CREATE_USER", actor: user.email, target: email, role });
    saveDatabase();
    return json(res, 201, { success: true, user: safeUser(newUser) });
  }
  if (url.pathname === "/api/admin/hospitals" && req.method === "POST") {
    if (user.role !== "SUPER_ADMIN") return json(res, 403, { success: false, message: "Only Super Admin can create hospitals." });
    const body = await parseBody(req);
    const name = String(body.name || "").trim();
    const city = String(body.city || "").trim();
    const stateName = String(body.state || "").trim();
    const planId = db.plans.some((plan) => plan.id === body.planId) ? body.planId : "plan_starter";
    if (!name || !city || !stateName) return json(res, 400, { success: false, message: "Hospital name, city, and state are required." });
    const hospital = {
      id: `hospital_${crypto.randomUUID().slice(0, 8)}`,
      name,
      city,
      state: stateName,
      active: true,
      planId,
      subscription: body.subscription || "TRIAL"
    };
    db.hospitals.push(hospital);
    db.departments.push({ id: `dept_${crypto.randomUUID().slice(0, 8)}`, hospitalId: hospital.id, name: "General Medicine" });
    db.audit.push({ at: new Date().toISOString(), action: "SUPER_ADMIN_CREATE_HOSPITAL", actor: user.email, hospitalId: hospital.id });
    saveDatabase();
    return json(res, 201, { success: true, hospital });
  }
  const hospitalAdminMatch = url.pathname.match(/^\/api\/admin\/hospitals\/([^/]+)$/);
  if (hospitalAdminMatch && req.method === "PATCH") {
    if (user.role !== "SUPER_ADMIN") return json(res, 403, { success: false, message: "Only Super Admin can update hospitals." });
    const body = await parseBody(req);
    const hospital = db.hospitals.find((item) => item.id === hospitalAdminMatch[1]);
    if (!hospital) return json(res, 404, { success: false, message: "Hospital not found." });
    if (body.name !== undefined) hospital.name = String(body.name).trim() || hospital.name;
    if (body.city !== undefined) hospital.city = String(body.city).trim() || hospital.city;
    if (body.state !== undefined) hospital.state = String(body.state).trim() || hospital.state;
    if (body.planId && db.plans.some((plan) => plan.id === body.planId)) hospital.planId = body.planId;
    if (body.subscription && ["TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"].includes(body.subscription)) hospital.subscription = body.subscription;
    if (body.active !== undefined) hospital.active = Boolean(body.active);
    if (body.recordPayment && hospital.subscription === "ACTIVE") {
      const plan = db.plans.find((item) => item.id === hospital.planId);
      db.payments.push({ id: `pay_${crypto.randomUUID().slice(0, 8)}`, hospitalId: hospital.id, planId: hospital.planId, amount: plan?.price || 0, status: "CAPTURED", date: new Date().toISOString() });
    }
    db.audit.push({ at: new Date().toISOString(), action: "SUPER_ADMIN_UPDATE_HOSPITAL", actor: user.email, hospitalId: hospital.id });
    saveDatabase();
    return json(res, 200, { success: true, hospital });
  }
  if (url.pathname === "/api/admin/settings" && req.method === "PATCH") {
    if (user.role !== "SUPER_ADMIN") return json(res, 403, { success: false, message: "Only Super Admin can update platform settings." });
    const body = await parseBody(req);
    db.settings.platformName = String(body.platformName || db.settings.platformName).trim();
    db.settings.supportEmail = String(body.supportEmail || db.settings.supportEmail).trim();
    db.settings.trialDays = Math.max(0, Number(body.trialDays ?? db.settings.trialDays));
    db.settings.allowPatientSignup = Boolean(body.allowPatientSignup);
    db.settings.maintenanceMode = Boolean(body.maintenanceMode);
    db.audit.push({ at: new Date().toISOString(), action: "SUPER_ADMIN_UPDATE_SETTINGS", actor: user.email });
    saveDatabase();
    return json(res, 200, { success: true, settings: db.settings });
  }
  if (url.pathname === "/api/hospital/departments" && req.method === "POST") {
    if (user.role !== "HOSPITAL_ADMIN") return json(res, 403, { success: false, message: "Only Hospital Admin can add departments." });
    const body = await parseBody(req);
    const name = String(body.name || "").trim();
    if (!name) return json(res, 400, { success: false, message: "Department name is required." });
    if (db.departments.some((dept) => dept.hospitalId === user.hospitalId && dept.name.toLowerCase() === name.toLowerCase())) return json(res, 409, { success: false, message: "Department already exists." });
    const department = { id: `dept_${crypto.randomUUID().slice(0, 8)}`, hospitalId: user.hospitalId, name };
    db.departments.push(department);
    db.audit.push({ at: new Date().toISOString(), action: "HOSPITAL_ADMIN_CREATE_DEPARTMENT", actor: user.email, departmentId: department.id });
    saveDatabase();
    return json(res, 201, { success: true, department });
  }
  if (url.pathname === "/api/hospital/staff" && req.method === "POST") {
    if (user.role !== "HOSPITAL_ADMIN") return json(res, 403, { success: false, message: "Only Hospital Admin can add hospital staff." });
    const body = await parseBody(req);
    const role = body.role === "DOCTOR" ? "DOCTOR" : body.role === "RECEPTIONIST" ? "RECEPTIONIST" : null;
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    if (!role) return json(res, 400, { success: false, message: "Role must be Doctor or Receptionist." });
    if (!name || !email || !String(body.password || "").trim()) return json(res, 400, { success: false, message: "Name, email, and password are required." });
    if (db.users.some((item) => item.email.toLowerCase() === email)) return json(res, 409, { success: false, message: "Email already exists." });
    const id = `user_${crypto.randomUUID().slice(0, 8)}`;
    const newUser = { id, hospitalId: user.hospitalId, name, email, role, password: String(body.password), active: true };
    if (role === "DOCTOR") {
      const doctorId = `doctor_${crypto.randomUUID().slice(0, 8)}`;
      const departmentId = db.departments.some((dept) => dept.id === body.departmentId && dept.hospitalId === user.hospitalId) ? body.departmentId : db.departments.find((dept) => dept.hospitalId === user.hospitalId)?.id;
      newUser.doctorId = doctorId;
      db.doctors.push({ id: doctorId, userId: id, hospitalId: user.hospitalId, departmentId, name, specialisation: body.specialisation || "General Medicine", fee: Number(body.fee || 400), experience: Number(body.experience || 1), active: true });
      db.availability.push({ doctorId, days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "13:00", duration: 30 });
    }
    db.users.push(newUser);
    db.audit.push({ at: new Date().toISOString(), action: "HOSPITAL_ADMIN_CREATE_STAFF", actor: user.email, target: email, role });
    saveDatabase();
    return json(res, 201, { success: true, user: safeUser(newUser) });
  }
  if (url.pathname === "/api/hospital/patients" && req.method === "POST") {
    if (user.role !== "HOSPITAL_ADMIN") return json(res, 403, { success: false, message: "Only Hospital Admin can add patients." });
    const body = await parseBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    if (!name || !email || !String(body.password || "").trim()) return json(res, 400, { success: false, message: "Name, email, and password are required." });
    if (db.users.some((item) => item.email.toLowerCase() === email)) return json(res, 409, { success: false, message: "Email already exists." });
    const id = `user_${crypto.randomUUID().slice(0, 8)}`;
    const patientId = `patient_${crypto.randomUUID().slice(0, 8)}`;
    const patientUser = { id, hospitalId: user.hospitalId, name, email, role: "PATIENT", password: String(body.password), active: true, patientId };
    const patient = { id: patientId, userId: id, hospitalId: user.hospitalId, name, age: Number(body.age || 30), gender: body.gender || "Not specified", bloodGroup: body.bloodGroup || "NA", phone: body.phone || "" };
    db.users.push(patientUser);
    db.patients.push(patient);
    db.audit.push({ at: new Date().toISOString(), action: "HOSPITAL_ADMIN_CREATE_PATIENT", actor: user.email, patientId });
    saveDatabase();
    return json(res, 201, { success: true, patient, user: safeUser(patientUser) });
  }
  if (url.pathname === "/api/auth/me") return json(res, 200, { success: true, user: safeUser(user) });
  if (url.pathname === "/api/receptionist/assignment" && req.method === "POST") {
    if (user.role !== "RECEPTIONIST") return json(res, 403, { success: false, message: "Only receptionists can set their doctor assignment." });
    const body = await parseBody(req);
    const doctor = db.doctors.find((item) => item.id === body.doctorId && item.hospitalId === user.hospitalId);
    if (!doctor) return json(res, 400, { success: false, message: "Select a valid doctor from your hospital." });
    if (!body.startTime || !body.endTime) return json(res, 400, { success: false, message: "Shift start and end time are required." });
    const existing = db.receptionistAssignments.find((item) => item.receptionistId === user.id);
    const assignment = existing || { receptionistId: user.id, hospitalId: user.hospitalId };
    assignment.doctorId = doctor.id;
    assignment.startTime = body.startTime;
    assignment.endTime = body.endTime;
    assignment.updatedAt = new Date().toISOString();
    if (!existing) db.receptionistAssignments.push(assignment);
    db.audit.push({ at: new Date().toISOString(), action: "RECEPTIONIST_ASSIGNMENT", actor: user.email, doctorId: doctor.id });
    notifyDoctorReceptionistAssigned(assignment, user);
    saveDatabase();
    return json(res, 200, { success: true, assignment: assignmentView(assignment) });
  }

  if (url.pathname === "/api/patients/documents" && req.method === "POST") {
    if (user.role !== "PATIENT") return json(res, 403, { success: false, message: "Forbidden" });
    const body = await parseBody(req);
    if (!body.name || !body.url) return json(res, 400, { success: false, message: "Name and file data are required" });
    const doc = {
      id: "doc_" + Math.random().toString(36).substr(2, 9),
      patientId: user.patientId,
      name: body.name,
      url: body.url,
      createdAt: new Date().toISOString()
    };
    db.documents.push(doc);
    saveDatabase();
    return json(res, 200, { success: true, document: doc });
  }

  if (url.pathname === "/api/patients/documents" && req.method === "GET") {
    if (user.role !== "PATIENT") return json(res, 403, { success: false, message: "Forbidden" });
    const docs = db.documents.filter(d => d.patientId === user.patientId);
    return json(res, 200, { success: true, documents: docs });
  }

  if (url.pathname === "/api/appointments/reorder" && req.method === "PATCH") {
    if (!["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "RECEPTIONIST"].includes(user.role)) return json(res, 403, { success: false, message: "Forbidden" });
    const body = await parseBody(req);
    if (!Array.isArray(body.order)) return json(res, 400, { success: false, message: "Order array required" });
    body.order.forEach((id, index) => {
      const appt = db.appointments.find(a => a.id === id);
      if (appt && canAccessAppointment(user, appt)) {
        appt.queueOrder = index;
      }
    });
    saveDatabase();
    io.to("hospital_" + user.hospitalId).emit("appointment:update", { action: "REORDERED" });
    return json(res, 200, { success: true });
  }

  if (url.pathname === "/api/bootstrap") {
    const activeHospitalIds = new Set(db.hospitals.filter((hospital) => hospital.active).map((hospital) => hospital.id));
    const patientHospitals = db.hospitals.filter((hospital) => hospital.active);
    const patientDoctors = db.doctors.filter((doctor) => doctor.active && activeHospitalIds.has(doctor.hospitalId));
    const visibleDoctors = user.role === "SUPER_ADMIN" ? db.doctors : user.role === "PATIENT" ? patientDoctors : tenantRows(db.doctors, user);
    return json(res, 200, {
      success: true,
      roles,
      user: safeUser(user),
      hospitals: user.role === "SUPER_ADMIN" ? db.hospitals : user.role === "PATIENT" ? patientHospitals : tenantRows(db.hospitals, user),
      users: (user.role === "SUPER_ADMIN" ? db.users : tenantRows(db.users, user)).map(safeUser),
      departments: user.role === "PATIENT" ? db.departments.filter((department) => activeHospitalIds.has(department.hospitalId)) : tenantRows(db.departments, user),
      doctors: visibleDoctors,
      patients: user.role === "PATIENT" ? db.patients.filter((patient) => patient.id === user.patientId) : tenantRows(db.patients, user),
      availability: user.role === "SUPER_ADMIN" ? db.availability : db.availability.filter((item) => visibleDoctors.some((doctor) => doctor.id === item.doctorId)),
      emergencyLeaves: user.role === "SUPER_ADMIN" ? db.emergencyLeaves : db.emergencyLeaves.filter((item) => visibleDoctors.some((doctor) => doctor.id === item.doctorId)),
      plans: db.plans,
      payments: user.role === "SUPER_ADMIN" ? db.payments.map(paymentView) : [],
      settings: user.role === "SUPER_ADMIN" ? db.settings : null,
      notifications: visibleNotifications(user),
      appointments: (user.role === "PATIENT" ? db.appointments.filter((appt) => appt.patientId === user.patientId) : tenantRows(db.appointments, user)).map(appointmentView),
      receptionistAssignments: visibleAssignments(user),
      dashboard: dashboardFor(user)
    });
  }
  if (url.pathname === "/api/dashboard") return json(res, 200, { success: true, dashboard: dashboardFor(user) });
  if (url.pathname === "/api/appointments" && req.method === "GET") return json(res, 200, { success: true, appointments: db.appointments.filter((appt) => canAccessAppointment(user, appt)).map(appointmentView) });
  if (url.pathname === "/api/appointments/queue/today") {
    if (!["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "RECEPTIONIST"].includes(user.role)) return json(res, 403, { success: false, message: "Only hospital staff can manage appointment queues." });
    const today = new Date().toDateString();
    return json(res, 200, { success: true, appointments: db.appointments.filter((appt) => canAccessAppointment(user, appt)).map(appointmentView).filter((appt) => new Date(appt.start).toDateString() === today) });
  }
  const availabilityMatch = url.pathname.match(/^\/api\/doctors\/([^/]+)\/availability$/);
  if (availabilityMatch && req.method === "PATCH") {
    const doctor = db.doctors.find((item) => item.id === availabilityMatch[1]);
    if (!doctor || !["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR"].includes(user.role)) return json(res, 404, { success: false, message: "Doctor not found." });
    if (user.role === "DOCTOR" && doctor.id !== user.doctorId) return json(res, 403, { success: false, message: "Doctors can update only their own availability." });
    if (user.role === "HOSPITAL_ADMIN" && doctor.hospitalId !== user.hospitalId) return json(res, 403, { success: false, message: "Doctor not found in this hospital." });
    const body = await parseBody(req);
    const days = Array.isArray(body.days) ? body.days.map(Number).filter((day) => day >= 0 && day <= 6) : [];
    const start = String(body.start || "").trim();
    const end = String(body.end || "").trim();
    const duration = Number(body.duration || 30);
    if (!days.length || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || duration < 5) return json(res, 400, { success: false, message: "Valid days, start time, end time, and slot duration are required." });
    let availability = db.availability.find((item) => item.doctorId === doctor.id);
    if (!availability) {
      availability = { doctorId: doctor.id, days: [], start: "09:00", end: "13:00", duration: 30 };
      db.availability.push(availability);
    }
    availability.days = [...new Set(days)].sort((a, b) => a - b);
    availability.start = start;
    availability.end = end;
    availability.duration = duration;
    db.audit.push({ at: new Date().toISOString(), action: "DOCTOR_UPDATE_AVAILABILITY", actor: user.email, doctorId: doctor.id });
    saveDatabase();
    return json(res, 200, { success: true, availability });
  }
  const emergencyLeaveMatch = url.pathname.match(/^\/api\/doctors\/([^/]+)\/emergency-leave$/);
  if (emergencyLeaveMatch && req.method === "POST") {
    const doctor = db.doctors.find((item) => item.id === emergencyLeaveMatch[1]);
    if (!doctor || !["DOCTOR", "HOSPITAL_ADMIN"].includes(user.role)) return json(res, 404, { success: false, message: "Doctor not found." });
    if (user.role === "DOCTOR" && doctor.id !== user.doctorId) return json(res, 403, { success: false, message: "Doctors can create emergency leave only for themselves." });
    if (user.role === "HOSPITAL_ADMIN" && doctor.hospitalId !== user.hospitalId) return json(res, 403, { success: false, message: "Doctor not found in this hospital." });
    const body = await parseBody(req);
    const date = String(body.date || "").trim();
    const startTime = String(body.startTime || "").trim();
    const endTime = String(body.endTime || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return json(res, 400, { success: false, message: "Date, start time, and end time are required." });
    const leaveStart = new Date(`${date}T${startTime}:00`);
    const leaveEnd = new Date(`${date}T${endTime}:00`);
    if (!(leaveEnd > leaveStart)) return json(res, 400, { success: false, message: "Emergency leave end time must be after start time." });
    const affected = db.appointments
      .filter((appt) => appt.doctorId === doctor.id && activeAppointmentStatuses.includes(appt.status) && rangesOverlap(appt.start, appt.end, leaveStart.toISOString(), leaveEnd.toISOString()))
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    const leave = {
      id: `leave_${crypto.randomUUID().slice(0, 8)}`,
      hospitalId: doctor.hospitalId,
      doctorId: doctor.id,
      start: leaveStart.toISOString(),
      end: leaveEnd.toISOString(),
      reason: String(body.reason || "Emergency leave").trim(),
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };
    db.emergencyLeaves.push(leave);
    const nextSlots = findNextAvailableSlots(doctor.id, leave.end, affected.length);
    if (nextSlots.length < affected.length) {
      db.emergencyLeaves = db.emergencyLeaves.filter((item) => item.id !== leave.id);
      return json(res, 409, { success: false, message: "Not enough future availability to reschedule every appointment." });
    }
    const rescheduled = [];
    affected.forEach((appt, index) => {
      const slot = nextSlots[index];
      appt.previousStart = appt.start;
      appt.previousEnd = appt.end;
      appt.start = slot.start;
      appt.end = slot.end;
      appt.status = "RESCHEDULED";
      appt.rescheduledAt = new Date().toISOString();
      appt.rescheduleReason = leave.reason;
      appt.emergencyLeaveId = leave.id;
      rescheduled.push(appt);
    });
    db.audit.push({ at: new Date().toISOString(), action: "DOCTOR_EMERGENCY_LEAVE", actor: user.email, doctorId: doctor.id, leaveId: leave.id, rescheduled: rescheduled.length });
    notifyEmergencyReschedule(leave, doctor, rescheduled, user);
    saveDatabase();
    return json(res, 200, { success: true, leave, rescheduled: rescheduled.map(appointmentView) });
  }
  const slotMatch = url.pathname.match(/^\/api\/appointments\/doctor\/([^/]+)\/slots$/);
  if (slotMatch) return json(res, 200, { success: true, slots: generateSlots(slotMatch[1], url.searchParams.get("date") || new Date().toISOString().slice(0, 10)) });
  if (url.pathname === "/api/appointments" && req.method === "POST") {
    if (!canBook(user)) return json(res, 403, { success: false, message: "Subscription is read-only. Renew before booking." });
    const body = await parseBody(req);
    const doctor = db.doctors.find((item) => item.id === body.doctorId);
    const typedPatientName = String(body.patientName || "").trim();
    let patient = db.patients.find((item) => item.id === body.patientId);
    if (!patient && user.role === "PATIENT") patient = db.patients.find((item) => item.id === user.patientId);
    if (!doctor || (!["SUPER_ADMIN", "PATIENT"].includes(user.role) && doctor.hospitalId !== user.hospitalId)) return json(res, 400, { success: false, message: "Invalid doctor." });
    if (!typedPatientName) return json(res, 400, { success: false, message: "Patient name is required." });
    if (patient && user.role !== "PATIENT" && patient.hospitalId !== doctor.hospitalId) return json(res, 400, { success: false, message: "Invalid patient for this hospital." });
    if (user.role === "PATIENT" && (!patient || patient.id !== user.patientId)) return json(res, 403, { success: false, message: "Patients can book only for their own account." });
    if (user.role === "DOCTOR" && doctor.id !== user.doctorId) return json(res, 403, { success: false, message: "Doctors can book only under their own schedule." });
    if (user.role === "RECEPTIONIST") {
      const assignment = receptionistAssignment(user);
      if (!assignment) return json(res, 403, { success: false, message: "Select your doctor and shift before creating walk-in bookings." });
      if (assignment.doctorId !== doctor.id) return json(res, 403, { success: false, message: "Receptionists can create walk-ins only for their assigned doctor." });
    }
    const slots = generateSlots(body.doctorId, body.start.slice(0, 10));
    const selected = slots.find((slot) => slot.start === body.start && slot.available);
    if (!selected) return json(res, 409, { success: false, message: "Selected slot is no longer available." });
    const bookingAge = Number(body.age);
    if (!Number.isFinite(bookingAge) || bookingAge < 1 || bookingAge > 130) return json(res, 400, { success: false, message: "Patient age is required and must be between 1 and 130." });
    if (!patient) {
      const patientId = `patient_${crypto.randomUUID().slice(0, 8)}`;
      patient = {
        id: patientId,
        userId: null,
        hospitalId: doctor.hospitalId,
        name: typedPatientName,
        age: bookingAge,
        gender: "Not specified",
        bloodGroup: "NA",
        phone: ""
      };
      db.patients.push(patient);
    }
    const reportPhotoDataUrl = String(body.reportPhotoDataUrl || "");
    if (reportPhotoDataUrl && (!reportPhotoDataUrl.startsWith("data:image/") || reportPhotoDataUrl.length > 2_000_000)) return json(res, 400, { success: false, message: "Report photo must be a valid image below 1.5 MB." });
    const appt = {
      id: `appt_${crypto.randomUUID().slice(0, 8)}`,
      code: `MED-${Date.now().toString().slice(-6)}`,
      hospitalId: doctor.hospitalId,
      patientId: patient.id,
      patientName: typedPatientName,
      doctorId: doctor.id,
      start: selected.start,
      end: selected.end,
      status: body.priority === "EMERGENCY" ? "EMERGENCY" : "CONFIRMED",
      reason: body.reason || "Consultation",
      age: bookingAge,
      previousReport: String(body.previousReport || "").trim(),
      reportPhotoName: String(body.reportPhotoName || "").trim(),
      reportPhotoDataUrl,
      notes: ""
    };
    db.appointments.push(appt);
    db.audit.push({ at: new Date().toISOString(), action: "BOOK_APPOINTMENT", actor: user.email, appointmentId: appt.id });
    notifyAppointmentBooked(appt, user);
    saveDatabase();
    return json(res, 201, { success: true, appointment: appointmentView(appt) });
  }
  if (url.pathname === "/api/notifications/read" && req.method === "PATCH") {
    for (const item of db.notifications) {
      if (item.userId === user.id) item.read = true;
    }
    saveDatabase();
    return json(res, 200, { success: true, notifications: visibleNotifications(user) });
  }
  const statusMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)\/status$/);
  if (statusMatch && req.method === "PATCH") {
    const body = await parseBody(req);
    const appt = db.appointments.find((item) => item.id === statusMatch[1]);
    if (!appt || !canManageAppointment(user, appt)) return json(res, 404, { success: false, message: "Appointment not found or not manageable for this role." });
    appt.status = body.status;
    if (body.notes) appt.notes = body.notes;
    db.audit.push({ at: new Date().toISOString(), action: "STATUS_CHANGE", actor: user.email, appointmentId: appt.id, status: body.status });
    saveDatabase();
    return json(res, 200, { success: true, appointment: appointmentView(appt) });
  }
  const notesMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)\/notes$/);
  if (notesMatch && req.method === "PATCH") {
    const body = await parseBody(req);
    const appt = db.appointments.find((item) => item.id === notesMatch[1]);
    if (!appt || !canAccessAppointment(user, appt)) return json(res, 404, { success: false, message: "Appointment not found." });
    if (user.role !== "DOCTOR" || appt.doctorId !== user.doctorId) return json(res, 403, { success: false, message: "Only the assigned doctor can add consultation notes." });
    appt.notes = String(body.notes || "").trim();
    if (body.status && ["CONFIRMED", "WAITING", "EMERGENCY", "COMPLETED", "CANCELLED"].includes(body.status)) appt.status = body.status;
    db.audit.push({ at: new Date().toISOString(), action: "DOCTOR_CONSULTATION_NOTES", actor: user.email, appointmentId: appt.id });
    saveDatabase();
    return json(res, 200, { success: true, appointment: appointmentView(appt) });
  }
  const cancelMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)\/cancel$/);
  if (cancelMatch && req.method === "DELETE") {
    const appt = db.appointments.find((item) => item.id === cancelMatch[1]);
    if (!appt || !canManageAppointment(user, appt)) return json(res, 404, { success: false, message: "Appointment not found or not manageable for this role." });
    appt.status = "CANCELLED";
    db.audit.push({ at: new Date().toISOString(), action: "CANCEL_APPOINTMENT", actor: user.email, appointmentId: appt.id });
    saveDatabase();
    io?.to(`hospital_${appt.hospitalId}`).emit("appointment:update", { action: "CANCELLED", appointmentId: appt.id });
    return json(res, 200, { success: true, appointment: appointmentView(appt) });
  }
  // --- Manual Reschedule endpoint ---
  const rescheduleMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)\/reschedule$/);
  if (rescheduleMatch && req.method === "PATCH") {
    const body = await parseBody(req);
    const appt = db.appointments.find((item) => item.id === rescheduleMatch[1]);
    if (!appt || !canAccessAppointment(user, appt)) return json(res, 404, { success: false, message: "Appointment not found." });
    if (!body.start) return json(res, 400, { success: false, message: "New start time is required." });
    const doctor = db.doctors.find((d) => d.id === appt.doctorId);
    const slotDuration = (db.availability.find((a) => a.doctorId === appt.doctorId)?.duration || 30) * 60000;
    const newStart = new Date(body.start).toISOString();
    const newEnd = new Date(new Date(body.start).getTime() + slotDuration).toISOString();
    const conflict = db.appointments.some((a) => a.id !== appt.id && a.doctorId === appt.doctorId && activeAppointmentStatuses.includes(a.status) && a.start === newStart);
    if (conflict) return json(res, 409, { success: false, message: "That slot is already booked. Choose another." });
    appt.previousStart = appt.start;
    appt.previousEnd = appt.end;
    appt.start = newStart;
    appt.end = newEnd;
    appt.status = "RESCHEDULED";
    appt.rescheduledAt = new Date().toISOString();
    appt.rescheduleReason = String(body.reason || "Manual reschedule");
    db.audit.push({ at: new Date().toISOString(), action: "MANUAL_RESCHEDULE", actor: user.email, appointmentId: appt.id });
    saveDatabase();
    io?.to(`hospital_${appt.hospitalId}`).emit("appointment:update", { action: "RESCHEDULED", appointmentId: appt.id });
    return json(res, 200, { success: true, appointment: appointmentView(appt) });
  }
  // --- Patient profile update endpoint ---
  if (url.pathname === "/api/patients/profile" && req.method === "PATCH") {
    if (user.role !== "PATIENT") return json(res, 403, { success: false, message: "Only patients can update their profile." });
    const body = await parseBody(req);
    const patient = db.patients.find((p) => p.id === user.patientId);
    if (!patient) return json(res, 404, { success: false, message: "Patient record not found." });
    if (body.name) { patient.name = String(body.name).trim(); const u = db.users.find((u) => u.id === user.id); if (u) u.name = patient.name; }
    if (body.age) patient.age = Number(body.age);
    if (body.gender) patient.gender = String(body.gender);
    if (body.bloodGroup) patient.bloodGroup = String(body.bloodGroup);
    if (body.phone) patient.phone = String(body.phone);
    db.audit.push({ at: new Date().toISOString(), action: "PATIENT_PROFILE_UPDATE", actor: user.email });
    saveDatabase();
    return json(res, 200, { success: true, patient });
  }
  const slipMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)\/slip$/);
  if (slipMatch) {
    const rawAppt = db.appointments.find((item) => item.id === slipMatch[1]);
    if (!rawAppt || !canAccessAppointment(user, rawAppt)) return json(res, 404, { success: false, message: "Appointment slip not found." });
    const appt = appointmentView(rawAppt);
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`<!doctype html><title>${escapeHtml(appt.code || "Appointment")} Slip</title><style>body{font-family:Arial;margin:40px}.slip{max-width:720px;border:1px solid #cfd8e3;padding:28px;border-radius:12px}h1{color:#1a56db}.row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid #eef2f7;padding:10px 0}.note{white-space:pre-wrap;line-height:1.5}.report{max-width:220px;border:1px solid #e5e7eb;border-radius:10px;margin-top:12px}@media print{button{display:none}}</style><div class="slip"><h1>MediSlot Appointment Slip</h1><div class="row"><b>Code</b><span>${escapeHtml(appt.code)}</span></div><div class="row"><b>Patient</b><span>${escapeHtml(appt.patientName)}</span></div><div class="row"><b>Age</b><span>${escapeHtml(appt.age || "Not provided")}</span></div><div class="row"><b>Doctor</b><span>${escapeHtml(appt.doctorName)}</span></div><div class="row"><b>Department</b><span>${escapeHtml(appt.departmentName)}</span></div><div class="row"><b>Date</b><span>${new Date(appt.start).toLocaleString()}</span></div><div class="row"><b>Status</b><span>${escapeHtml(appt.status)}</span></div><h3>Reason</h3><p class="note">${escapeHtml(appt.reason || "")}</p><h3>Previous Report</h3><p class="note">${escapeHtml(appt.previousReport || "No previous report notes added.")}</p>${appt.reportPhotoDataUrl ? `<h3>Report Photo</h3><p>${escapeHtml(appt.reportPhotoName || "Uploaded report photo")}</p><img class="report" src="${appt.reportPhotoDataUrl}" alt="Previous report photo" />` : ""}<button onclick="window.print()">Print / Save PDF</button></div>`);
  }
  if (url.pathname === "/api/subscriptions/plans") return json(res, 200, { success: true, plans: db.plans });
  if (url.pathname === "/api/subscriptions/payment/create-order" && req.method === "POST") {
    const body = await parseBody(req);
    const plan = db.plans.find((item) => item.id === body.planId);
    return json(res, 201, { success: true, order: { id: `order_${crypto.randomUUID().slice(0, 8)}`, amount: plan.price * 100, currency: "INR", plan } });
  }
  if (url.pathname === "/api/subscriptions/payment/verify" && req.method === "POST") {
    const body = await parseBody(req);
    const hospital = hospitalOf(user);
    if (hospital && body.planId) {
      hospital.planId = body.planId;
      hospital.subscription = "ACTIVE";
      db.payments.push({ id: `pay_${crypto.randomUUID().slice(0, 8)}`, hospitalId: hospital.id, planId: body.planId, amount: db.plans.find((p) => p.id === body.planId).price, status: "CAPTURED", date: new Date().toISOString() });
      db.audit.push({ at: new Date().toISOString(), action: "SUBSCRIPTION_PAYMENT", actor: user.email, hospitalId: hospital.id, planId: body.planId });
      saveDatabase();
    }
    return json(res, 200, { success: true, message: "Payment verified in demo mode." });
  }
  return json(res, 404, { success: false, message: "Endpoint not found." });
}

async function startServer() {
  db = await loadDatabase();
  const httpServer = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url.startsWith("/api/")) return api(req, res);
    return sendStatic(req, res);
  });
  // Socket.io setup
  io = new SocketIO(httpServer, { cors: { origin: "*" } });
  io.on("connection", (socket) => {
    socket.on("join", (hospitalId) => {
      if (hospitalId) socket.join(`hospital_${hospitalId}`);
    });
  });
  httpServer.listen(PORT, () => {
    console.log(`MediSlot running at http://localhost:${PORT}`);
  });
}

startServer();

