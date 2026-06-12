const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

const db = loadDatabase();

function loadDatabase() {
  const seed = seedDatabase();
  try {
    if (!fs.existsSync(DB_FILE)) {
      saveDatabase(seed);
      return seed;
    }
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    const merged = { ...seed, ...parsed };
    for (const key of Object.keys(seed)) {
      if (Array.isArray(seed[key]) && !Array.isArray(merged[key])) merged[key] = seed[key];
      if (!Array.isArray(seed[key]) && (typeof merged[key] !== "object" || merged[key] === null)) merged[key] = seed[key];
    }
    merged.settings = { ...seed.settings, ...(parsed.settings || {}) };
    saveDatabase(merged);
    return merged;
  } catch (error) {
    console.error("Could not load database file. Starting with seed data.", error.message);
    saveDatabase(seed);
    return seed;
  }
}

function saveDatabase(data = db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, DB_FILE);
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
  const requestPath = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
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
  return Buffer.from(JSON.stringify({ userId: user.id, role: user.role, hospitalId: user.hospitalId })).toString("base64url");
}

function currentUser(req, url) {
  const raw = (req.headers.authorization || "").replace("Bearer ", "") || url?.searchParams.get("token") || "";
  try {
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
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
  return { ...appt, patientName: patient?.name, doctorName: doctor?.name, departmentName: department?.name, hospitalName: hospital?.name };
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

function visibleAssignments(user) {
  if (user.role === "SUPER_ADMIN") return db.receptionistAssignments.map(assignmentView);
  if (user.role === "DOCTOR") return db.receptionistAssignments.filter((item) => item.doctorId === user.doctorId).map(assignmentView);
  if (user.role === "RECEPTIONIST") return db.receptionistAssignments.filter((item) => item.receptionistId === user.id).map(assignmentView);
  return db.receptionistAssignments.filter((item) => item.hospitalId === user.hospitalId).map(assignmentView);
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
      const busy = db.appointments.some((appt) => appt.doctorId === doctorId && ["PENDING", "CONFIRMED", "WAITING", "EMERGENCY"].includes(appt.status) && appt.start === cursor.toISOString());
      slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString(), available: !busy });
    }
    cursor.setTime(slotEnd.getTime());
  }
  return slots;
}

function dashboardFor(user) {
  const hospital = hospitalOf(user);
  const appointments = tenantRows(db.appointments, user).map(appointmentView);
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
  if (appt.hospitalId !== user.hospitalId) return false;
  if (user.role === "PATIENT") return appt.patientId === user.patientId;
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
    const expectedPassword = found?.password || "demo123";
    if (!found || body.password !== expectedPassword) return json(res, 401, { success: false, message: "Invalid email or password." });
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
    const user = { id, hospitalId, name, email, role, password: String(body.password), active: true };
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
  if (url.pathname === "/api/bootstrap") {
    return json(res, 200, {
      success: true,
      roles,
      user: safeUser(user),
      hospitals: user.role === "SUPER_ADMIN" ? db.hospitals : tenantRows(db.hospitals, user),
      users: (user.role === "SUPER_ADMIN" ? db.users : tenantRows(db.users, user)).map(safeUser),
      departments: tenantRows(db.departments, user),
      doctors: tenantRows(db.doctors, user),
      patients: tenantRows(db.patients, user),
      availability: user.role === "SUPER_ADMIN" ? db.availability : db.availability.filter((item) => tenantRows(db.doctors, user).some((doctor) => doctor.id === item.doctorId)),
      plans: db.plans,
      payments: user.role === "SUPER_ADMIN" ? db.payments.map(paymentView) : [],
      settings: user.role === "SUPER_ADMIN" ? db.settings : null,
      notifications: visibleNotifications(user),
      appointments: tenantRows(db.appointments, user).map(appointmentView),
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
  const slotMatch = url.pathname.match(/^\/api\/appointments\/doctor\/([^/]+)\/slots$/);
  if (slotMatch) return json(res, 200, { success: true, slots: generateSlots(slotMatch[1], url.searchParams.get("date") || new Date().toISOString().slice(0, 10)) });
  if (url.pathname === "/api/appointments" && req.method === "POST") {
    if (!canBook(user)) return json(res, 403, { success: false, message: "Subscription is read-only. Renew before booking." });
    const body = await parseBody(req);
    const doctor = db.doctors.find((item) => item.id === body.doctorId);
    const patient = db.patients.find((item) => item.id === body.patientId);
    if (!doctor || !patient || (user.role !== "SUPER_ADMIN" && doctor.hospitalId !== user.hospitalId)) return json(res, 400, { success: false, message: "Invalid doctor or patient." });
    if (user.role === "PATIENT" && patient.id !== user.patientId) return json(res, 403, { success: false, message: "Patients can book only for their own account." });
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
    const reportPhotoDataUrl = String(body.reportPhotoDataUrl || "");
    if (reportPhotoDataUrl && (!reportPhotoDataUrl.startsWith("data:image/") || reportPhotoDataUrl.length > 2_000_000)) return json(res, 400, { success: false, message: "Report photo must be a valid image below 1.5 MB." });
    const appt = {
      id: `appt_${crypto.randomUUID().slice(0, 8)}`,
      code: `MED-${Date.now().toString().slice(-6)}`,
      hospitalId: doctor.hospitalId,
      patientId: patient.id,
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
    return json(res, 200, { success: true, appointment: appointmentView(appt) });
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

http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) return api(req, res);
  return sendStatic(req, res);
}).listen(PORT, () => {
  console.log(`MediSlot running at http://localhost:${PORT}`);
});

