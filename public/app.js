const navByRole = {
  SUPER_ADMIN: ["Overview", "Hospitals", "Users", "Subscriptions", "Settings"],
  HOSPITAL_ADMIN: ["Overview", "Analytics", "Doctors", "Departments", "Staff", "Patients", "Appointments", "Subscriptions"],
  DOCTOR: ["Overview", "Appointments", "Notifications", "Receptionists", "Availability"],
  RECEPTIONIST: ["Overview", "Notifications", "Work Setup", "Queue", "Walk-in"],
  PATIENT: ["Overview", "Book", "Notifications", "History"]
};

const state = {
  token: localStorage.getItem("medislot_token"),
  user: null,
  data: null,
  view: "Overview",
  selectedSlot: null,
  selectedNoteAppointment: null,
  receptionistSession: null,
  authMode: "login",
  selectedRole: "PATIENT"
};

const app = document.querySelector("#app");

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text;
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function money(value) {
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
}

function dateTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function appointmentDate(value) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function time(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function icon(name) {
  const icons = { Overview: "OV", Analytics: "AN", Appointments: "AP", Notifications: "NT", Book: "+", History: "HI", Queue: "QU", "Walk-in": "+", "Work Setup": "WS", Doctors: "DR", Departments: "DP", Staff: "SF", Patients: "PT", Receptionists: "RX", Availability: "AV", Hospitals: "HO", Users: "US", Subscriptions: "Rs", Plans: "Rs", Settings: "ST" };
  return icons[name] || "*";
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

async function login(role) {
  if (role) state.selectedRole = role;
  const result = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: document.querySelector("#loginEmail")?.value,
      password: document.querySelector("#loginPassword")?.value
    })
  });
  state.token = result.token;
  state.user = result.user;
  state.view = "Overview";
  localStorage.setItem("medislot_token", state.token);
  await load();
}

async function submitLogin(event) {
  event.preventDefault();
  try {
    await login();
  } catch (error) {
    toast(error.message);
  }
}

async function submitSignup(event) {
  event.preventDefault();
  try {
    const result = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        role: state.selectedRole,
        name: document.querySelector("#signupName").value,
        email: document.querySelector("#signupEmail").value,
        password: document.querySelector("#signupPassword").value,
        phone: document.querySelector("#signupPhone").value,
        specialisation: document.querySelector("#signupSpecialisation")?.value
      })
    });
    state.token = result.token;
    state.user = result.user;
    state.view = "Overview";
    localStorage.setItem("medislot_token", state.token);
    await load();
    toast("Account created.");
  } catch (error) {
    toast(error.message);
  }
}

async function load() {
  try {
    const result = await api("/api/bootstrap");
    state.user = result.user;
    state.data = result;
    state.receptionistSession = getReceptionistSession();
    if (state.user.role === "RECEPTIONIST" && !state.receptionistSession) state.view = "Work Setup";
    render();
  } catch {
    localStorage.removeItem("medislot_token");
    state.token = null;
    renderLogin();
  }
}

function logout() {
  localStorage.removeItem("medislot_token");
  state.token = null;
  state.user = null;
  state.data = null;
  renderLogin();
}

function renderLogin() {
  const roles = state.authMode === "signup" ? ["PATIENT"] : [];
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-showcase">
        <div class="auth-brand"><div class="logo">MS</div><div><h1>MediSlot</h1><p>Hospital appointment SaaS</p></div></div>
        <div class="showcase-copy">
          <div class="eyebrow">Role-based access</div>
          <h2>Run every appointment workflow from one clean hospital console.</h2>
          <p>Sign in with your registered email and MediSlot will open the right workspace for your account.</p>
        </div>
        <div class="showcase-stats">
          <div><strong>5</strong><span>User roles</span></div>
          <div><strong>Live</strong><span>Slot checks</span></div>
          <div><strong>24x7</strong><span>Booking flow</span></div>
        </div>
        <img src="/healthcare-ops.png" alt="MediSlot healthcare operations dashboard preview" />
      </section>
      <section class="auth-panel">
        <div class="auth-tabs">
          <button class="${state.authMode === "login" ? "active" : ""}" onclick="setAuthMode('login')">Login</button>
          <button class="${state.authMode === "signup" ? "active" : ""}" onclick="setAuthMode('signup')">Sign up</button>
        </div>
        ${roles.length ? `<div class="role-picker patient-only">${roles.map((role) => `<button class="${state.selectedRole === role ? "active" : ""}" onclick="selectAuthRole('${role}')"><span>${roleIcon(role)}</span><strong>${labelRole(role)}</strong></button>`).join("")}</div>` : ""}
        ${state.authMode === "login" ? renderLoginForm() : renderSignupForm()}
      </section>
    </main>
  `;
}

function renderLoginForm() {
  return `
    <form class="auth-form" onsubmit="submitLogin(event)">
      <div>
        <h2>Welcome back</h2>
        <p class="caption">Enter your account credentials to continue.</p>
      </div>
      <div class="field"><label>Email</label><input id="loginEmail" type="email" placeholder="name@hospital.com" autocomplete="email" required /></div>
      <div class="field"><label>Password</label><input id="loginPassword" type="password" placeholder="Enter password" autocomplete="current-password" required /></div>
      <button class="btn auth-submit" type="submit">Login</button>
    </form>
  `;
}

function renderSignupForm() {
  state.selectedRole = "PATIENT";
  return `
    <form class="auth-form" onsubmit="submitSignup(event)">
      <div>
        <h2>Create ${labelRole(state.selectedRole)} account</h2>
        <p class="caption">Public signup is for patients only. Staff accounts are created by authorized admins.</p>
      </div>
      <div class="field"><label>Full name</label><input id="signupName" placeholder="Enter full name" required /></div>
      <div class="field"><label>Email</label><input id="signupEmail" type="email" placeholder="name@example.com" required /></div>
      <div class="field"><label>Password</label><input id="signupPassword" type="password" placeholder="Create password" required /></div>
      <div class="field"><label>Phone</label><input id="signupPhone" placeholder="+91 ..." /></div>
      <button class="btn auth-submit" type="submit">Create account</button>
    </form>
  `;
}

function setAuthMode(mode) {
  state.authMode = mode;
  if (mode === "signup") state.selectedRole = "PATIENT";
  renderLogin();
}

function selectAuthRole(role) {
  state.selectedRole = state.authMode === "signup" ? "PATIENT" : role;
  renderLogin();
}

function roleIcon(role) {
  return { SUPER_ADMIN: "SA", HOSPITAL_ADMIN: "HA", DOCTOR: "DR", RECEPTIONIST: "RX", PATIENT: "PT" }[role];
}

function labelRole(role) {
  return role.split("_").map((word) => word[0] + word.slice(1).toLowerCase()).join(" ");
}

function setView(view) {
  state.view = view;
  render();
}

function render() {
  const nav = navByRole[state.user.role] || ["Overview"];
  if (!nav.includes(state.view)) state.view = "Overview";
  const unreadCount = (state.data.notifications || []).filter((item) => !item.read).length;
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><div class="logo">MS</div><div><h1>MediSlot</h1><p>${state.data.dashboard.hospital?.name || "Platform console"}</p></div></div>
        <nav class="nav" aria-label="Workspace navigation">
          <div class="nav-label">Workspace</div>
          ${nav.map((item) => navButton(item)).join("")}
        </nav>
        <div class="profile-card">
          <div class="avatar">${state.user.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
          <div class="caption">Signed in as</div>
          <strong>${state.user.name}</strong>
          <p class="caption">${labelRole(state.user.role)}</p>
          <button class="btn ghost" style="width:100%;margin-top:12px" onclick="logout()">Sign out</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div><h2>${state.view}</h2><p class="caption">${state.data.dashboard.hospital?.name || "MediSlot Platform"} | ${labelRole(state.user.role)}</p></div>
          <div class="top-actions">
            ${["DOCTOR", "RECEPTIONIST", "PATIENT"].includes(state.user.role) ? `<button class="notify-button" onclick="setView('Notifications')" aria-label="Notifications"><span>NT</span>${unreadCount ? `<b>${unreadCount}</b>` : ""}</button>` : ""}
            <div class="userbox"><div class="avatar">${state.user.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div><div><strong>${state.user.name}</strong><p class="caption">${state.user.email}</p></div></div>
          </div>
        </header>
        <section class="content">${renderView()}</section>
      </main>
      <nav class="mobile-nav">${nav.slice(0, 4).map((item) => `<button class="${state.view === item ? "active" : ""}" aria-label="${item}" onclick="setView('${item}')"><span aria-hidden="true">${icon(item)}</span><strong>${item}</strong></button>`).join("")}</nav>
    </div>
  `;
  if (state.view === "Book" || state.view === "Walk-in") setTimeout(loadSlots, 0);
  if (state.view === "Users") setTimeout(() => {
    renderDepartmentOptions();
    toggleStaffFields();
  }, 0);
  if (state.view === "Staff") setTimeout(toggleHospitalStaffFields, 0);
  if (state.view === "Subscriptions" && state.user.role === "SUPER_ADMIN") setTimeout(syncSubscriptionForm, 0);
}

function navButton(item) {
  return `<button class="nav-item ${state.view === item ? "active" : ""}" aria-label="${item}" onclick="setView('${item}')"><span class="nav-icon" aria-hidden="true">${icon(item)}</span><span class="nav-text">${item}</span></button>`;
}

function renderView() {
  if (state.view === "Overview") return renderOverview();
  if (state.view === "Work Setup") return renderReceptionistSetup();
  if (state.view === "Book" || state.view === "Walk-in") return renderBooking(state.view === "Walk-in");
  if (state.view === "Queue") return renderAppointments();
  if (state.view === "Appointments" || state.view === "History") return renderAppointments();
  if (state.view === "Notifications") return renderNotifications();
  if (state.view === "Subscriptions" || state.view === "Plans") return renderPlans();
  if (state.view === "Receptionists") return renderDoctorReceptionistPage();
  if (state.view === "Availability" && state.user.role === "DOCTOR") return renderDoctorAvailability();
  if (state.view === "Doctors" || state.view === "Availability") return renderDoctors();
  if (state.view === "Hospitals") return renderHospitals();
  if (state.view === "Users") return renderUsers();
  if (state.view === "Analytics") return renderHospitalAnalytics();
  if (state.view === "Departments") return renderDepartments();
  if (state.view === "Staff") return renderHospitalStaff();
  if (state.view === "Patients") return renderPatients();
  if (state.view === "Settings") return renderSettings();
  return renderOverview();
}

function renderOverview() {
  const workPanel = state.user.role === "RECEPTIONIST" ? renderReceptionistSummary() : "";
  const overviewRows = getVisibleAppointments(state.data.dashboard.appointments || state.data.appointments).slice(0, 6);
  const rightPanel = state.user.role === "DOCTOR"
    ? `<h3>Reception Team</h3>${renderDoctorReceptionists()}`
    : state.user.role === "RECEPTIONIST"
      ? renderReceptionistTools()
    : `<h3>${state.user.role === "SUPER_ADMIN" ? "Plan Distribution" : "Department Activity"}</h3>${barChart(state.data.dashboard.chart || statusChart())}`;
  return `
    ${workPanel}
    <div class="grid kpis">${state.data.dashboard.kpis.map(([label, value]) => `<article class="card kpi-card"><p class="caption">${label}</p><div class="metric">${value}</div><span class="trend">Live tenant data</span></article>`).join("")}</div>
    <div class="layout-2">
      <section class="card">
        <h3>${state.user.role === "RECEPTIONIST" ? "Today's Queue" : state.user.role === "DOCTOR" ? "My Appointments" : "Recent Appointments"}</h3>
        ${appointmentTable(overviewRows)}
      </section>
      <section class="card">
        ${rightPanel}
      </section>
    </div>
  `;
}

function renderReceptionistTools() {
  return `
    <h3>Reception Desk</h3>
    <div class="task-list">
      <button onclick="setView('Queue')"><span>QU</span><strong>Manage queue</strong><small>Complete, cancel, and print appointment slips.</small></button>
      <button onclick="setView('Walk-in')"><span>WI</span><strong>Walk-in booking</strong><small>Create emergency/walk-in appointments for your assigned doctor.</small></button>
      <button onclick="setView('Work Setup')"><span>DR</span><strong>Doctor assignment</strong><small>Choose shift time and the doctor you are working under.</small></button>
    </div>
  `;
}

function renderNotifications() {
  const notifications = state.data.notifications || [];
  const unreadCount = notifications.filter((item) => !item.read).length;
  return `
    <section class="card">
      <div class="section-head">
        <div>
          <h3>Notifications</h3>
          <p class="caption">${unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "All notifications are read."}</p>
        </div>
        ${notifications.length ? `<button class="btn secondary" onclick="markNotificationsRead()">Mark all read</button>` : ""}
      </div>
      ${notifications.length ? `
        <div class="notification-list">
          ${notifications.map((item) => `
            <article class="notification-item ${item.read ? "" : "unread"}">
              <div class="nav-icon">NT</div>
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.message)}</p>
                <span class="caption">${dateTime(item.createdAt)}</span>
              </div>
              ${item.read ? `<span class="status COMPLETED">Read</span>` : `<span class="status CONFIRMED">New</span>`}
            </article>
          `).join("")}
        </div>
      ` : `<div class="empty">No notifications yet.</div>`}
    </section>
  `;
}

async function markNotificationsRead() {
  try {
    await api("/api/notifications/read", { method: "PATCH", body: JSON.stringify({}) });
    await load();
    state.view = "Notifications";
    render();
  } catch (error) {
    toast(error.message);
  }
}

function renderDoctorReceptionists() {
  const assignments = state.data.receptionistAssignments || [];
  if (!assignments.length) return `<div class="empty">No receptionist is currently assigned to work under you.</div>`;
  return `
    <div class="reception-list">
      ${assignments.map((item) => `
        <div class="staff-chip">
          <div class="avatar">${(item.receptionistName || "R").split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
          <div>
            <strong>${item.receptionistName}</strong>
            <p class="caption">${item.startTime} to ${item.endTime} | ${item.receptionistEmail}</p>
          </div>
          <span class="status COMPLETED">On duty</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDoctorReceptionistPage() {
  const doctor = state.data.doctors.find((item) => item.id === state.user.doctorId);
  const assignments = state.data.receptionistAssignments || [];
  const todayRows = state.data.appointments.filter((appt) => appt.doctorId === state.user.doctorId && new Date(appt.start).toDateString() === new Date().toDateString());
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Receptionists Working Under You</h3>
        ${renderDoctorReceptionists()}
      </section>
      <section class="card">
        <h3>Doctor Work Context</h3>
        <div class="detail-list">
          <div><span class="caption">Doctor</span><strong>${doctor?.name || state.user.name}</strong></div>
          <div><span class="caption">Specialisation</span><strong>${doctor?.specialisation || "General"}</strong></div>
          <div><span class="caption">Assigned receptionists</span><strong>${assignments.length}</strong></div>
          <div><span class="caption">Today's appointments</span><strong>${todayRows.length}</strong></div>
        </div>
      </section>
    </div>
  `;
}

function getVisibleAppointments(rows) {
  if (state.user.role === "RECEPTIONIST" && state.receptionistSession?.doctorId) {
    return rows.filter((appt) => appt.doctorId === state.receptionistSession.doctorId);
  }
  return rows;
}

function statusChart() {
  const statuses = ["CONFIRMED", "WAITING", "EMERGENCY", "COMPLETED", "CANCELLED"];
  return statuses.map((status) => ({ label: status, value: state.data.appointments.filter((appt) => appt.status === status).length + 1 }));
}

function barChart(rows) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return `<div class="bars">${rows.map((row) => `<div class="bar-row"><strong>${row.label}</strong><div class="bar-track"><div class="bar-fill" style="width:${(row.value / max) * 100}%"></div></div><span>${row.value}</span></div>`).join("")}</div>`;
}

function appointmentTable(rows) {
  if (!rows.length) return `<div class="empty">No appointments found.</div>`;
  return `
    <div class="table-wrap">
      <table class="appointment-table">
        <colgroup><col class="col-code"><col class="col-patient"><col class="col-doctor"><col class="col-time"><col class="col-status"><col class="col-actions"></colgroup>
        <thead><tr><th>Code</th><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows.map((appt) => `
          <tr>
            <td><strong class="code-cell">${appt.code}</strong></td>
            <td>${appt.patientName}</td>
            <td>${appt.doctorName}<br><span class="caption">${appt.departmentName}</span></td>
            <td><span class="date-stack"><strong>${appointmentDate(appt.start)}</strong><span>${time(appt.start)}</span></span></td>
            <td><span class="status ${appt.status}">${appt.status}</span></td>
            <td><div class="appointment-actions">
              ${state.user.role !== "PATIENT" && appt.status !== "COMPLETED" ? `<button class="btn secondary" onclick="updateStatus('${appt.id}','COMPLETED')">Complete</button>` : ""}
              ${state.user.role === "DOCTOR" ? `<button class="btn secondary" onclick="openNotes('${appt.id}')">Notes</button>` : ""}
              ${appt.status !== "CANCELLED" && appt.status !== "COMPLETED" ? `<button class="btn danger" onclick="cancelAppointment('${appt.id}')">Cancel</button>` : ""}
              <a class="btn ghost" target="_blank" href="/api/appointments/${appt.id}/slip?token=${encodeURIComponent(state.token || "")}">Slip</a>
            </div></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderAppointments() {
  let rows = getVisibleAppointments(state.data.appointments);
  if (state.user.role === "PATIENT") rows = rows.filter((appt) => appt.patientId === state.user.patientId);
  if (state.user.role === "DOCTOR") rows = rows.filter((appt) => appt.doctorId === state.user.doctorId);
  if (state.view === "Queue") rows = rows.filter((appt) => new Date(appt.start).toDateString() === new Date().toDateString());
  return `
    <section class="card"><h3>${state.view}</h3>${renderReceptionistSummary()}${appointmentTable(rows)}</section>
    ${state.user.role === "DOCTOR" ? renderConsultationNotes(rows) : ""}
  `;
}

function renderConsultationNotes(rows) {
  if (!rows.length) return "";
  const appointment = rows.find((appt) => appt.id === state.selectedNoteAppointment) || rows[0];
  state.selectedNoteAppointment = appointment.id;
  return `
    <section class="card note-panel">
      <div>
        <h3>Consultation Notes</h3>
        <p class="caption">${appointment.code} | ${appointment.patientName} | ${appointmentDate(appointment.start)} ${time(appointment.start)}</p>
      </div>
      <div class="report-summary">
        <div><span class="caption">Booked age</span><strong>${appointment.age || "Not provided"}</strong></div>
        <div><span class="caption">Previous report</span><p>${escapeHtml(appointment.previousReport || "No previous report notes added.")}</p></div>
        ${appointment.reportPhotoDataUrl ? `<a class="report-thumb" href="${appointment.reportPhotoDataUrl}" target="_blank"><img src="${appointment.reportPhotoDataUrl}" alt="${escapeHtml(appointment.reportPhotoName || "Previous report photo")}" /><span>${escapeHtml(appointment.reportPhotoName || "View report photo")}</span></a>` : `<div><span class="caption">Report photo</span><p>No photo uploaded.</p></div>`}
      </div>
      <form class="form" onsubmit="saveConsultationNotes(event, '${appointment.id}')">
        <div class="field">
          <label>Clinical notes</label>
          <textarea id="consultationNotes" rows="5" placeholder="Diagnosis, observation, prescription, follow-up...">${escapeHtml(appointment.notes || "")}</textarea>
        </div>
        <div class="field">
          <label>Appointment status</label>
          <select id="consultationStatus">
            ${["CONFIRMED", "WAITING", "EMERGENCY", "COMPLETED", "CANCELLED"].map((status) => `<option value="${status}" ${appointment.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </div>
        <button class="btn" type="submit">Save Consultation Notes</button>
      </form>
    </section>
  `;
}

function openNotes(id) {
  state.selectedNoteAppointment = id;
  state.view = "Appointments";
  render();
  setTimeout(() => document.querySelector("#consultationNotes")?.focus(), 0);
}

function renderBooking(isWalkIn = false) {
  const currentPatient = state.data.patients.find((patient) => patient.id === state.user.patientId);
  const defaultPatientName = state.user.role === "PATIENT" ? currentPatient?.name || state.user.name : "";
  const hospitals = getBookingHospitals(isWalkIn);
  const selectedHospitalId = hospitals[0]?.id || "";
  const doctors = state.user.role === "RECEPTIONIST" && state.receptionistSession?.doctorId
    ? state.data.doctors.filter((doctor) => doctor.id === state.receptionistSession.doctorId)
    : state.data.doctors.filter((doctor) => !selectedHospitalId || doctor.hospitalId === selectedHospitalId);
  return `
    <div class="layout-2">
      <section class="card">
        <h3>${isWalkIn ? "Walk-in Booking" : "Book Appointment"}</h3>
        <form class="form" onsubmit="bookAppointment(event, ${isWalkIn})">
          <input id="patientId" type="hidden" value="${state.user.patientId || ""}" />
          <div class="field"><label>Patient name</label><input id="bookingPatientName" placeholder="Enter patient name" value="${escapeHtml(defaultPatientName)}" required /></div>
          <div class="field"><label>Hospital</label><select id="bookingHospitalId" onchange="refreshBookingDoctors()">${hospitals.map((hospital) => `<option value="${hospital.id}">${escapeHtml(hospital.name)} | ${escapeHtml(hospital.city || "")}</option>`).join("")}</select></div>
          <div class="field"><label>Doctor</label><select id="doctorId" onchange="loadSlots()">${doctors.map((d) => `<option value="${d.id}">${escapeHtml(d.name)} | ${escapeHtml(d.specialisation)} | ${money(d.fee)}</option>`).join("")}</select></div>
          <div class="field"><label>Date</label><input id="date" type="date" value="${todayISO()}" onchange="loadSlots()" /></div>
          <div class="field"><label>Patient age</label><input id="bookingAge" type="number" min="1" max="130" placeholder="Enter patient age" required /></div>
          <div class="field"><label>Reason</label><textarea id="reason" rows="3" placeholder="Consultation reason"></textarea></div>
          <div class="field"><label>Previous report</label><textarea id="previousReport" rows="3" placeholder="Optional previous report notes"></textarea></div>
          <div class="field"><label>Report photo</label><input id="reportPhoto" type="file" accept="image/*" /><p class="caption">Optional image upload, stored with this appointment.</p></div>
          <div class="field"><label>Available slots</label><div id="slots" class="slot-grid"></div></div>
          <button class="btn" type="submit">${isWalkIn ? "Create Walk-in" : "Confirm Booking"}</button>
        </form>
      </section>
      <section class="card">
        <h3>${state.user.role === "RECEPTIONIST" ? "Receptionist Shift" : "Booking Rules"}</h3>
        ${state.user.role === "RECEPTIONIST" ? renderReceptionistSummary() : ""}
        <p class="caption">Slots are generated from doctor availability. The server checks active appointments before creating a booking, so confirmed, waiting, pending, and emergency slots cannot be double-booked.</p>
        <div class="empty">Subscription status: ${state.data.dashboard.hospital?.subscription || "Platform access"}</div>
      </section>
    </div>`;
}

function getBookingHospitals(isWalkIn = false) {
  if (state.user.role === "RECEPTIONIST" && state.receptionistSession?.doctorId) {
    const assignedDoctor = state.data.doctors.find((doctor) => doctor.id === state.receptionistSession.doctorId);
    return state.data.hospitals.filter((hospital) => hospital.id === assignedDoctor?.hospitalId);
  }
  const doctorHospitalIds = new Set(state.data.doctors.map((doctor) => doctor.hospitalId));
  return state.data.hospitals.filter((hospital) => doctorHospitalIds.has(hospital.id));
}

function getBookingDoctors(hospitalId) {
  if (state.user.role === "RECEPTIONIST" && state.receptionistSession?.doctorId) {
    return state.data.doctors.filter((doctor) => doctor.id === state.receptionistSession.doctorId);
  }
  return state.data.doctors.filter((doctor) => doctor.hospitalId === hospitalId);
}

function refreshBookingDoctors() {
  const hospitalId = document.querySelector("#bookingHospitalId")?.value || "";
  const doctorSelect = document.querySelector("#doctorId");
  if (!doctorSelect) return;
  const doctors = getBookingDoctors(hospitalId);
  doctorSelect.innerHTML = doctors.map((doctor) => `<option value="${doctor.id}">${escapeHtml(doctor.name)} | ${escapeHtml(doctor.specialisation)} | ${money(doctor.fee)}</option>`).join("");
  loadSlots();
}

function getReceptionistSession() {
  if (!state.user || state.user.role !== "RECEPTIONIST") return null;
  const assignment = state.data?.receptionistAssignments?.find((item) => item.receptionistId === state.user.id);
  if (assignment) return assignment;
  try {
    const saved = JSON.parse(localStorage.getItem(`medislot_receptionist_${state.user.id}`) || "{}");
    return saved.doctorId ? saved : null;
  } catch {
    return null;
  }
}

function renderReceptionistSummary() {
  if (state.user?.role !== "RECEPTIONIST") return "";
  const doctor = state.data?.doctors.find((item) => item.id === state.receptionistSession?.doctorId);
  if (!doctor) {
    return `<div class="work-banner"><strong>No doctor selected</strong><span>Choose a doctor and shift time before managing queue or walk-ins.</span><button class="btn secondary" onclick="setView('Work Setup')">Set Work</button></div>`;
  }
  return `<div class="work-banner"><strong>Working under ${doctor.name}</strong><span>${state.receptionistSession.startTime || "--:--"} to ${state.receptionistSession.endTime || "--:--"} | ${doctor.specialisation}</span><button class="btn secondary" onclick="setView('Work Setup')">Change</button></div>`;
}

function renderReceptionistSetup() {
  if (state.user.role !== "RECEPTIONIST") return `<section class="card"><h3>Work Setup</h3><div class="empty">This page is only for receptionists.</div></section>`;
  const selectedDoctorId = state.receptionistSession?.doctorId || state.data.doctors[0]?.id || "";
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Choose Doctor and Shift Time</h3>
        <form class="form" onsubmit="saveReceptionistSession(event)">
          <div class="field"><label>Doctor</label><select id="workDoctor">${state.data.doctors.map((doctor) => `<option value="${doctor.id}" ${doctor.id === selectedDoctorId ? "selected" : ""}>${doctor.name} | ${doctor.specialisation}</option>`).join("")}</select></div>
          <div class="time-row">
            <div class="field"><label>Shift start</label><input id="workStart" type="time" value="${state.receptionistSession?.startTime || "09:00"}" required /></div>
            <div class="field"><label>Shift end</label><input id="workEnd" type="time" value="${state.receptionistSession?.endTime || "17:00"}" required /></div>
          </div>
          <button class="btn" type="submit">Start Work</button>
        </form>
      </section>
      <section class="card">
        <h3>Active Assignment</h3>
        ${renderReceptionistSummary()}
        <p class="caption">Once set, the queue and walk-in booking screen focus on this doctor's appointments and slots.</p>
      </section>
    </div>
  `;
}

async function saveReceptionistSession(event) {
  event.preventDefault();
  const session = {
    doctorId: document.querySelector("#workDoctor").value,
    startTime: document.querySelector("#workStart").value,
    endTime: document.querySelector("#workEnd").value
  };
  try {
    const result = await api("/api/receptionist/assignment", {
      method: "POST",
      body: JSON.stringify(session)
    });
    state.receptionistSession = result.assignment;
    localStorage.setItem(`medislot_receptionist_${state.user.id}`, JSON.stringify(result.assignment));
    toast("Receptionist work setup saved.");
    await load();
    state.view = "Queue";
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function loadSlots() {
  state.selectedSlot = null;
  const doctorSelect = document.querySelector("#doctorId");
  const doctorId = doctorSelect ? doctorSelect.value : state.data.doctors[0]?.id;
  const date = document.querySelector("#date")?.value || todayISO();
  const target = document.querySelector("#slots");
  if (!target) return;
  if (!doctorId) {
    target.innerHTML = `<div class="empty">No doctors available for this hospital.</div>`;
    return;
  }
  const result = await api(`/api/appointments/doctor/${doctorId}/slots?date=${date}`);
  target.innerHTML = result.slots.map((slot) => `<button type="button" class="slot" ${slot.available ? "" : "disabled"} onclick="selectSlot('${slot.start}', this)">${time(slot.start)}</button>`).join("") || `<div class="empty">No slots for this date.</div>`;
}

function selectSlot(start, button) {
  state.selectedSlot = start;
  document.querySelectorAll(".slot").forEach((slot) => slot.classList.remove("active"));
  button.classList.add("active");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (!file.type.startsWith("image/")) return reject(new Error("Report photo must be an image."));
    if (file.size > 1_500_000) return reject(new Error("Report photo must be below 1.5 MB."));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read report photo."));
    reader.readAsDataURL(file);
  });
}

async function bookAppointment(event, isWalkIn) {
  event.preventDefault();
  if (!state.selectedSlot) return toast("Choose an available slot first.");
  try {
    const patientName = document.querySelector("#bookingPatientName").value.trim();
    if (!patientName) return toast("Enter patient name.");
    const age = Number(document.querySelector("#bookingAge").value);
    if (!Number.isFinite(age) || age < 1 || age > 130) return toast("Enter a valid patient age.");
    const reportPhotoInput = document.querySelector("#reportPhoto");
    const reportPhotoDataUrl = await fileToDataUrl(reportPhotoInput?.files?.[0]);
    await api("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        patientId: document.querySelector("#patientId")?.value || "",
        patientName,
        doctorId: document.querySelector("#doctorId").value,
        start: state.selectedSlot,
        reason: document.querySelector("#reason").value,
        age,
        previousReport: document.querySelector("#previousReport").value,
        reportPhotoName: reportPhotoInput?.files?.[0]?.name || "",
        reportPhotoDataUrl,
        priority: isWalkIn ? "EMERGENCY" : "NORMAL"
      })
    });
    toast(isWalkIn ? "Walk-in added to queue." : "Appointment confirmed.");
    await load();
  } catch (error) {
    toast(error.message);
  }
}

async function updateStatus(id, status) {
  await api(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  toast(`Appointment marked ${status.toLowerCase()}.`);
  await load();
}

async function cancelAppointment(id) {
  await api(`/api/appointments/${id}/cancel`, { method: "DELETE" });
  toast("Appointment cancelled and slot released.");
  await load();
}

async function saveConsultationNotes(event, id) {
  event.preventDefault();
  try {
    await api(`/api/appointments/${id}/notes`, {
      method: "PATCH",
      body: JSON.stringify({
        notes: document.querySelector("#consultationNotes").value,
        status: document.querySelector("#consultationStatus").value
      })
    });
    toast("Consultation notes saved.");
    await load();
    state.view = "Appointments";
    state.selectedNoteAppointment = id;
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function saveDoctorAvailability(event) {
  event.preventDefault();
  const days = [...document.querySelectorAll("input[name='availabilityDay']:checked")].map((input) => Number(input.value));
  try {
    await api(`/api/doctors/${state.user.doctorId}/availability`, {
      method: "PATCH",
      body: JSON.stringify({
        days,
        start: document.querySelector("#availabilityStart").value,
        end: document.querySelector("#availabilityEnd").value,
        duration: document.querySelector("#availabilityDuration").value
      })
    });
    toast("Availability saved.");
    await load();
    state.view = "Availability";
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function createEmergencyLeave(event) {
  event.preventDefault();
  try {
    const result = await api(`/api/doctors/${state.user.doctorId}/emergency-leave`, {
      method: "POST",
      body: JSON.stringify({
        date: document.querySelector("#emergencyLeaveDate").value,
        startTime: document.querySelector("#emergencyLeaveStart").value,
        endTime: document.querySelector("#emergencyLeaveEnd").value,
        reason: document.querySelector("#emergencyLeaveReason").value
      })
    });
    toast(`${result.rescheduled.length} appointment${result.rescheduled.length === 1 ? "" : "s"} rescheduled.`);
    await load();
    state.view = "Availability";
    render();
  } catch (error) {
    toast(error.message);
  }
}

function renderPlans() {
  if (state.user.role === "SUPER_ADMIN") return renderSuperAdminSubscriptions();
  return `<div class="grid plans">${state.data.plans.map((plan) => `<article class="card plan"><h3>${plan.name}</h3><div class="price">${money(plan.price)}<span class="caption"> / mo</span></div><p class="caption">${plan.maxDoctors} doctors | ${plan.maxStaff} staff</p><ul>${plan.features.map((f) => `<li>${f}</li>`).join("")}</ul><button class="btn" onclick="activatePlan('${plan.id}')">Activate ${plan.name}</button></article>`).join("")}</div>`;
}

async function activatePlan(planId) {
  const order = await api("/api/subscriptions/payment/create-order", { method: "POST", body: JSON.stringify({ planId }) });
  await api("/api/subscriptions/payment/verify", { method: "POST", body: JSON.stringify({ planId, orderId: order.order.id, razorpay_payment_id: "demo_payment", signature: "demo_signature" }) });
  toast("Demo payment verified. Subscription active.");
  await load();
}

function renderDoctors() {
  return `<div class="grid plans">${state.data.doctors.map((doctor) => `<article class="card doctor-card"><h3>${doctor.name}</h3><p>${doctor.specialisation}</p><p class="caption">${doctor.experience} yrs experience | ${money(doctor.fee)} consultation</p><span class="status COMPLETED">Available</span></article>`).join("")}</div>`;
}

function renderDoctorAvailability() {
  const doctor = state.data.doctors.find((item) => item.id === state.user.doctorId);
  const availability = state.data.availability?.find((item) => item.doctorId === state.user.doctorId) || { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "13:00", duration: 30 };
  const leaves = (state.data.emergencyLeaves || []).filter((item) => item.doctorId === state.user.doctorId).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Manage Availability</h3>
        <form class="form" onsubmit="saveDoctorAvailability(event)">
          <div class="day-grid">
            ${dayLabels.map((label, index) => `<label class="check-row"><input name="availabilityDay" type="checkbox" value="${index}" ${availability.days.includes(index) ? "checked" : ""} /> ${label}</label>`).join("")}
          </div>
          <div class="time-row">
            <div class="field"><label>Start time</label><input id="availabilityStart" type="time" value="${availability.start}" required /></div>
            <div class="field"><label>End time</label><input id="availabilityEnd" type="time" value="${availability.end}" required /></div>
          </div>
          <div class="field"><label>Slot duration</label><input id="availabilityDuration" type="number" min="5" step="5" value="${availability.duration}" required /></div>
          <button class="btn" type="submit">Save Availability</button>
        </form>
      </section>
      <section class="card">
        <h3>Emergency To Go</h3>
        <form class="form" onsubmit="createEmergencyLeave(event)">
          <div class="field"><label>Leave date</label><input id="emergencyLeaveDate" type="date" value="${todayISO()}" required /></div>
          <div class="time-row">
            <div class="field"><label>From</label><input id="emergencyLeaveStart" type="time" value="${availability.start}" required /></div>
            <div class="field"><label>To</label><input id="emergencyLeaveEnd" type="time" value="${availability.end}" required /></div>
          </div>
          <div class="field"><label>Reason</label><textarea id="emergencyLeaveReason" rows="3" placeholder="Emergency reason"></textarea></div>
          <button class="btn danger" type="submit">Activate Emergency Leave</button>
        </form>
        <p class="caption">Active appointments during this time will move to the next available slots and notify patients, receptionists, hospital admin, and other doctors.</p>
      </section>
      <section class="card">
        <h3>Current Schedule</h3>
        <div class="detail-list">
          <div><span class="caption">Doctor</span><strong>${doctor?.name || state.user.name}</strong></div>
          <div><span class="caption">Working days</span><strong>${availability.days.map((day) => dayLabels[day]).join(", ")}</strong></div>
          <div><span class="caption">Consulting hours</span><strong>${availability.start} to ${availability.end}</strong></div>
          <div><span class="caption">Slot duration</span><strong>${availability.duration} mins</strong></div>
        </div>
      </section>
      <section class="card">
        <h3>Emergency Leave History</h3>
        ${leaves.length ? `<div class="notification-list">${leaves.map((leave) => `<article class="notification-item"><div class="nav-icon">EM</div><div><strong>${dateTime(leave.start)} to ${time(leave.end)}</strong><p>${escapeHtml(leave.reason || "Emergency leave")}</p><span class="caption">Created ${dateTime(leave.createdAt)}</span></div><span class="status RESCHEDULED">Leave</span></article>`).join("")}</div>` : `<div class="empty">No emergency leave recorded.</div>`}
      </section>
    </div>
  `;
}

function renderHospitalAnalytics() {
  const appointments = state.data.appointments || [];
  const doctors = state.data.doctors || [];
  const patients = state.data.patients || [];
  const staff = (state.data.users || []).filter((user) => ["DOCTOR", "RECEPTIONIST"].includes(user.role));
  const completed = appointments.filter((appt) => appt.status === "COMPLETED").length;
  const activeQueue = appointments.filter((appt) => ["CONFIRMED", "WAITING", "EMERGENCY"].includes(appt.status)).length;
  return `
    <div class="grid kpis">
      ${[
        ["Doctors", doctors.length],
        ["Staff", staff.length],
        ["Patients", patients.length],
        ["Active queue", activeQueue]
      ].map(([label, value]) => `<article class="card kpi-card"><p class="caption">${label}</p><div class="metric">${value}</div><span class="trend">Hospital analytics</span></article>`).join("")}
    </div>
    <div class="layout-2">
      <section class="card">
        <h3>Department Activity</h3>
        ${barChart(state.data.departments.map((dept) => ({ label: dept.name, value: appointments.filter((appt) => appt.departmentName === dept.name).length + 1 })))}
      </section>
      <section class="card">
        <h3>Hospital Summary</h3>
        <div class="detail-list">
          <div><span class="caption">Completed appointments</span><strong>${completed}</strong></div>
          <div><span class="caption">Cancelled appointments</span><strong>${appointments.filter((appt) => appt.status === "CANCELLED").length}</strong></div>
          <div><span class="caption">Emergency queue</span><strong>${appointments.filter((appt) => appt.status === "EMERGENCY").length}</strong></div>
          <div><span class="caption">Subscription</span><strong>${state.data.dashboard.hospital?.subscription || "TRIAL"}</strong></div>
        </div>
      </section>
    </div>
  `;
}

function renderDepartments() {
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Add Department</h3>
        <form class="form" onsubmit="createDepartment(event)">
          <div class="field"><label>Department name</label><input id="departmentName" placeholder="Cardiology, Pediatrics..." required /></div>
          <button class="btn" type="submit">Create Department</button>
        </form>
      </section>
      <section class="card">
        <h3>Departments</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Doctors</th><th>Appointments</th></tr></thead>
            <tbody>${state.data.departments.map((dept) => `<tr><td><strong>${dept.name}</strong></td><td>${state.data.doctors.filter((doctor) => doctor.departmentId === dept.id).length}</td><td>${state.data.appointments.filter((appt) => appt.departmentName === dept.name).length}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderHospitalStaff() {
  const staff = (state.data.users || []).filter((user) => ["DOCTOR", "RECEPTIONIST"].includes(user.role));
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Add Hospital Staff</h3>
        <form class="form" onsubmit="createHospitalStaff(event)">
          <div class="field"><label>Role</label><select id="hospitalStaffRole" onchange="toggleHospitalStaffFields()"><option value="DOCTOR">Doctor</option><option value="RECEPTIONIST">Receptionist</option></select></div>
          <div class="field"><label>Full name</label><input id="hospitalStaffName" placeholder="Enter full name" required /></div>
          <div class="field"><label>Email</label><input id="hospitalStaffEmail" type="email" placeholder="staff@hospital.test" required /></div>
          <div class="field"><label>Password</label><input id="hospitalStaffPassword" type="password" placeholder="Create password" required /></div>
          <div id="hospitalDoctorFields">
            <div class="field"><label>Department</label><select id="hospitalStaffDepartment">${state.data.departments.map((dept) => `<option value="${dept.id}">${dept.name}</option>`).join("")}</select></div>
            <div class="field"><label>Specialisation</label><input id="hospitalStaffSpecialisation" placeholder="Cardiology, Dermatology..." /></div>
            <div class="field"><label>Consultation fee</label><input id="hospitalStaffFee" type="number" min="0" value="400" /></div>
            <div class="field"><label>Experience</label><input id="hospitalStaffExperience" type="number" min="0" value="1" /></div>
          </div>
          <button class="btn" type="submit">Create Staff Account</button>
        </form>
      </section>
      <section class="card">
        <h3>Doctors and Receptionists</h3>
        ${staffTable(staff)}
      </section>
    </div>
  `;
}

function renderPatients() {
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Add Patient</h3>
        <form class="form" onsubmit="createHospitalPatient(event)">
          <div class="field"><label>Full name</label><input id="patientName" placeholder="Patient full name" required /></div>
          <div class="field"><label>Email</label><input id="patientEmail" type="email" placeholder="patient@example.com" required /></div>
          <div class="field"><label>Password</label><input id="patientPassword" type="password" placeholder="Create patient login password" required /></div>
          <div class="time-row">
            <div class="field"><label>Age</label><input id="patientAge" type="number" min="0" value="30" /></div>
            <div class="field"><label>Gender</label><select id="patientGender"><option>Male</option><option>Female</option><option>Other</option><option>Not specified</option></select></div>
          </div>
          <div class="time-row">
            <div class="field"><label>Blood group</label><input id="patientBloodGroup" placeholder="O+, B+, NA" /></div>
            <div class="field"><label>Phone</label><input id="patientPhone" placeholder="+91 ..." /></div>
          </div>
          <button class="btn" type="submit">Create Patient</button>
        </form>
      </section>
      <section class="card">
        <h3>Patients</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Age</th><th>Gender</th><th>Blood</th><th>Phone</th></tr></thead>
            <tbody>${state.data.patients.map((patient) => `<tr><td><strong>${patient.name}</strong></td><td>${patient.age}</td><td>${patient.gender}</td><td>${patient.bloodGroup}</td><td>${patient.phone || "-"}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderUsers() {
  const staff = (state.data.users || []).filter((user) => ["DOCTOR", "RECEPTIONIST"].includes(user.role));
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Add Doctor or Receptionist</h3>
        <form class="form" onsubmit="createStaffUser(event)">
          <div class="field"><label>Role</label><select id="staffRole" onchange="toggleStaffFields()"><option value="DOCTOR">Doctor</option><option value="RECEPTIONIST">Receptionist</option></select></div>
          <div class="field"><label>Hospital</label><select id="staffHospital" onchange="renderDepartmentOptions()">${state.data.hospitals.map((hospital) => `<option value="${hospital.id}">${hospital.name}</option>`).join("")}</select></div>
          <div class="field"><label>Full name</label><input id="staffName" placeholder="Enter full name" required /></div>
          <div class="field"><label>Email</label><input id="staffEmail" type="email" placeholder="staff@hospital.test" required /></div>
          <div class="field"><label>Password</label><input id="staffPassword" type="password" placeholder="Create password" required /></div>
          <div id="doctorFields">
            <div class="field"><label>Department</label><select id="staffDepartment"></select></div>
            <div class="field"><label>Specialisation</label><input id="staffSpecialisation" placeholder="Cardiology, Dermatology..." /></div>
            <div class="field"><label>Consultation fee</label><input id="staffFee" type="number" min="0" value="400" /></div>
            <div class="field"><label>Experience</label><input id="staffExperience" type="number" min="0" value="1" /></div>
          </div>
          <button class="btn" type="submit">Create Staff Account</button>
        </form>
      </section>
      <section class="card">
        <h3>Doctors and Receptionists</h3>
        ${staffTable(staff)}
      </section>
    </div>
  `;
}

function staffTable(rows) {
  if (!rows.length) return `<div class="empty">No staff users found.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Hospital</th><th>Status</th></tr></thead>
        <tbody>${rows.map((user) => `<tr><td><strong>${user.name}</strong></td><td>${user.email}</td><td>${labelRole(user.role)}</td><td>${state.data.hospitals.find((hospital) => hospital.id === user.hospitalId)?.name || "Platform"}</td><td><span class="status COMPLETED">Active</span></td></tr>`).join("")}</tbody>
      </table>
    </div>`;
}

function renderDepartmentOptions() {
  const hospitalId = document.querySelector("#staffHospital")?.value;
  const target = document.querySelector("#staffDepartment");
  if (!target) return;
  const departments = state.data.departments.filter((dept) => dept.hospitalId === hospitalId);
  target.innerHTML = departments.map((dept) => `<option value="${dept.id}">${dept.name}</option>`).join("");
}

function toggleStaffFields() {
  const fields = document.querySelector("#doctorFields");
  if (!fields) return;
  fields.style.display = document.querySelector("#staffRole").value === "DOCTOR" ? "grid" : "none";
}

function toggleHospitalStaffFields() {
  const fields = document.querySelector("#hospitalDoctorFields");
  const role = document.querySelector("#hospitalStaffRole")?.value;
  if (!fields || !role) return;
  fields.style.display = role === "DOCTOR" ? "grid" : "none";
}

async function createStaffUser(event) {
  event.preventDefault();
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        role: document.querySelector("#staffRole").value,
        hospitalId: document.querySelector("#staffHospital").value,
        name: document.querySelector("#staffName").value,
        email: document.querySelector("#staffEmail").value,
        password: document.querySelector("#staffPassword").value,
        departmentId: document.querySelector("#staffDepartment")?.value,
        specialisation: document.querySelector("#staffSpecialisation")?.value,
        fee: document.querySelector("#staffFee")?.value,
        experience: document.querySelector("#staffExperience")?.value
      })
    });
    toast("Staff account created.");
    await load();
    state.view = "Users";
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function createDepartment(event) {
  event.preventDefault();
  try {
    await api("/api/hospital/departments", {
      method: "POST",
      body: JSON.stringify({ name: document.querySelector("#departmentName").value })
    });
    toast("Department created.");
    await load();
    state.view = "Departments";
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function createHospitalStaff(event) {
  event.preventDefault();
  try {
    await api("/api/hospital/staff", {
      method: "POST",
      body: JSON.stringify({
        role: document.querySelector("#hospitalStaffRole").value,
        name: document.querySelector("#hospitalStaffName").value,
        email: document.querySelector("#hospitalStaffEmail").value,
        password: document.querySelector("#hospitalStaffPassword").value,
        departmentId: document.querySelector("#hospitalStaffDepartment")?.value,
        specialisation: document.querySelector("#hospitalStaffSpecialisation")?.value,
        fee: document.querySelector("#hospitalStaffFee")?.value,
        experience: document.querySelector("#hospitalStaffExperience")?.value
      })
    });
    toast("Hospital staff account created.");
    await load();
    state.view = "Staff";
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function createHospitalPatient(event) {
  event.preventDefault();
  try {
    await api("/api/hospital/patients", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#patientName").value,
        email: document.querySelector("#patientEmail").value,
        password: document.querySelector("#patientPassword").value,
        age: document.querySelector("#patientAge").value,
        gender: document.querySelector("#patientGender").value,
        bloodGroup: document.querySelector("#patientBloodGroup").value,
        phone: document.querySelector("#patientPhone").value
      })
    });
    toast("Patient account created.");
    await load();
    state.view = "Patients";
    render();
  } catch (error) {
    toast(error.message);
  }
}

function renderHospitals() {
  if (state.user.role !== "SUPER_ADMIN") {
    return `<section class="card"><h3>Tenant Hospitals</h3><div class="empty">Only Super Admin can manage hospitals.</div></section>`;
  }
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Add Hospital</h3>
        <form class="form" onsubmit="createHospital(event)">
          <div class="field"><label>Hospital name</label><input id="hospitalName" placeholder="Hospital or clinic name" required /></div>
          <div class="time-row">
            <div class="field"><label>City</label><input id="hospitalCity" placeholder="City" required /></div>
            <div class="field"><label>State</label><input id="hospitalState" placeholder="State" required /></div>
          </div>
          <div class="field"><label>Initial plan</label><select id="hospitalPlan">${state.data.plans.map((plan) => `<option value="${plan.id}">${plan.name} | ${money(plan.price)}</option>`).join("")}</select></div>
          <div class="field"><label>Subscription</label><select id="hospitalSubscription"><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Cancelled</option></select></div>
          <button class="btn" type="submit">Create Hospital</button>
        </form>
      </section>
      <section class="card">
        <h3>Tenant Hospitals</h3>
        ${hospitalTable()}
      </section>
    </div>
  `;
}

function hospitalTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Hospital</th><th>Location</th><th>Plan</th><th>Status</th><th>Active</th></tr></thead>
        <tbody>${state.data.hospitals.map((hospital) => `
          <tr>
            <td><strong>${hospital.name}</strong></td>
            <td>${hospital.city}, ${hospital.state}</td>
            <td>${state.data.plans.find((plan) => plan.id === hospital.planId)?.name || "Starter"}</td>
            <td><span class="status ${hospital.subscription === "ACTIVE" ? "COMPLETED" : hospital.subscription === "CANCELLED" ? "CANCELLED" : "WAITING"}">${hospital.subscription}</span></td>
            <td>${hospital.active ? "Yes" : "No"}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderSuperAdminSubscriptions() {
  const revenue = (state.data.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Subscription Control</h3>
        <div class="form">
          <div class="field"><label>Hospital</label><select id="subscriptionHospital" onchange="syncSubscriptionForm()">${state.data.hospitals.map((hospital) => `<option value="${hospital.id}">${hospital.name}</option>`).join("")}</select></div>
          <div class="field"><label>Plan</label><select id="subscriptionPlan">${state.data.plans.map((plan) => `<option value="${plan.id}">${plan.name} | ${money(plan.price)}</option>`).join("")}</select></div>
          <div class="field"><label>Status</label><select id="subscriptionStatus"><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Cancelled</option></select></div>
          <label class="check-row"><input id="subscriptionActive" type="checkbox" /> Hospital login active</label>
          <div class="actions">
            <button class="btn" onclick="updateHospitalSubscription(true)">Update and Record Payment</button>
            <button class="btn secondary" onclick="updateHospitalSubscription(false)">Update Only</button>
          </div>
        </div>
      </section>
      <section class="card">
        <h3>Revenue</h3>
        <div class="metric">${money(revenue)}</div>
        <p class="caption">Captured platform subscription revenue</p>
        ${paymentTable()}
      </section>
    </div>
  `;
}

function paymentTable() {
  const payments = state.data.payments || [];
  if (!payments.length) return `<div class="empty">No subscription payments recorded.</div>`;
  return `
    <div class="table-wrap compact-table">
      <table>
        <thead><tr><th>Hospital</th><th>Plan</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>${payments.slice().reverse().map((payment) => `<tr><td>${payment.hospitalName || "Hospital"}</td><td>${payment.planName || "Plan"}</td><td>${money(payment.amount)}</td><td>${dateTime(payment.date)}</td></tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderSettings() {
  const settings = state.data.settings || {};
  return `
    <div class="layout-2">
      <section class="card">
        <h3>Platform Settings</h3>
        <form class="form" onsubmit="saveSettings(event)">
          <div class="field"><label>Platform name</label><input id="settingPlatformName" value="${settings.platformName || "MediSlot"}" required /></div>
          <div class="field"><label>Support email</label><input id="settingSupportEmail" type="email" value="${settings.supportEmail || ""}" required /></div>
          <div class="field"><label>Trial days</label><input id="settingTrialDays" type="number" min="0" value="${settings.trialDays ?? 14}" required /></div>
          <label class="check-row"><input id="settingPatientSignup" type="checkbox" ${settings.allowPatientSignup ? "checked" : ""} /> Allow patient signup</label>
          <label class="check-row"><input id="settingMaintenance" type="checkbox" ${settings.maintenanceMode ? "checked" : ""} /> Maintenance mode</label>
          <button class="btn" type="submit">Save Settings</button>
        </form>
      </section>
      <section class="card">
        <h3>Platform Controls</h3>
        <div class="detail-list">
          <div><span class="caption">Signup</span><strong>${settings.allowPatientSignup ? "Enabled" : "Disabled"}</strong></div>
          <div><span class="caption">Maintenance</span><strong>${settings.maintenanceMode ? "Enabled" : "Off"}</strong></div>
          <div><span class="caption">Support</span><strong>${settings.supportEmail || "Not set"}</strong></div>
        </div>
      </section>
    </div>
  `;
}

async function createHospital(event) {
  event.preventDefault();
  try {
    await api("/api/admin/hospitals", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#hospitalName").value,
        city: document.querySelector("#hospitalCity").value,
        state: document.querySelector("#hospitalState").value,
        planId: document.querySelector("#hospitalPlan").value,
        subscription: document.querySelector("#hospitalSubscription").value
      })
    });
    toast("Hospital created.");
    await load();
    state.view = "Hospitals";
    render();
  } catch (error) {
    toast(error.message);
  }
}

function syncSubscriptionForm() {
  const hospitalId = document.querySelector("#subscriptionHospital")?.value;
  const hospital = state.data?.hospitals.find((item) => item.id === hospitalId);
  if (!hospital) return;
  const plan = document.querySelector("#subscriptionPlan");
  const status = document.querySelector("#subscriptionStatus");
  const active = document.querySelector("#subscriptionActive");
  if (plan) plan.value = hospital.planId;
  if (status) status.value = hospital.subscription;
  if (active) active.checked = hospital.active !== false;
}

async function updateHospitalSubscription(recordPayment) {
  const hospitalId = document.querySelector("#subscriptionHospital")?.value;
  if (!hospitalId) return toast("Select a hospital first.");
  try {
    await api(`/api/admin/hospitals/${hospitalId}`, {
      method: "PATCH",
      body: JSON.stringify({
        planId: document.querySelector("#subscriptionPlan").value,
        subscription: document.querySelector("#subscriptionStatus").value,
        active: document.querySelector("#subscriptionActive").checked,
        recordPayment
      })
    });
    toast(recordPayment ? "Subscription updated and payment recorded." : "Subscription updated.");
    await load();
    state.view = "Subscriptions";
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  try {
    await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({
        platformName: document.querySelector("#settingPlatformName").value,
        supportEmail: document.querySelector("#settingSupportEmail").value,
        trialDays: document.querySelector("#settingTrialDays").value,
        allowPatientSignup: document.querySelector("#settingPatientSignup").checked,
        maintenanceMode: document.querySelector("#settingMaintenance").checked
      })
    });
    toast("Platform settings saved.");
    await load();
    state.view = "Settings";
    render();
  } catch (error) {
    toast(error.message);
  }
}

load();
document.addEventListener("change", (event) => {
  if (event.target?.id === "doctorId" || event.target?.id === "date") loadSlots();
});
