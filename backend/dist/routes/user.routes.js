"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const query = (sql, params = []) => new Promise((resolve, reject) => db_1.default.query(sql, params, (err, results) => err ? reject(err) : resolve(results)));
// GET /api/users/students — Admin/Professor only
const queryFirst = async (sql, params = []) => {
    const rows = await query(sql, params);
    return rows.length ? rows[0] : null;
};
const safeList = async (sql, params = []) => {
    try {
        const rows = await query(sql, params);
        return Array.isArray(rows) ? rows : [];
    }
    catch (error) {
        if (error?.code === "ER_NO_SUCH_TABLE" ||
            error?.code === "ER_BAD_FIELD_ERROR" ||
            /doesn't exist/i.test(error?.message || "") ||
            /unknown column/i.test(error?.message || "")) {
            return [];
        }
        throw error;
    }
};
const tableExists = async (tableName) => {
    const row = await queryFirst(`SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [tableName]);
    return Boolean(row && row.cnt > 0);
};
const columnExists = async (tableName, columnName) => {
    const row = await queryFirst(`SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`, [tableName, columnName]);
    return Boolean(row && row.cnt > 0);
};
const getStudentByUserId = async (userId) => queryFirst("SELECT student_id FROM students WHERE user_id = ?", [userId]);
const getProfessorByUserId = async (userId) => queryFirst("SELECT professor_id FROM professors WHERE user_id = ?", [userId]);
const normalizeToken = (value) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
const randomFrom = (chars) => chars[Math.floor(Math.random() * chars.length)];
const generateProfessorPassword = (firstName, lastName) => {
    const base = normalizeToken(`${firstName}${lastName}`).slice(0, 16) || "professor";
    const upper = randomFrom("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    const digit = randomFrom("0123456789");
    const symbol = randomFrom("@#$%&*");
    const special = randomFrom("!?_-+=");
    return `${base}${upper}${digit}${symbol}${special}`;
};
// ============================ STUDENTS ============================
// GET /api/users/students — Admin/Professor
router.get("/students", auth_1.verifyToken, (0, auth_1.requireRole)("admin", "professor"), async (req, res) => {
    try {
        const { search, departmentId, programId, semester, status } = req.query;
        const hasDepartmentsTable = await tableExists("departments");
        const hasProgramsTable = await tableExists("programs");
        const departmentSelect = hasDepartmentsTable
            ? "d.department_name"
            : "NULL AS department_name";
        const departmentJoin = hasDepartmentsTable
            ? "LEFT JOIN departments d ON s.department_id = d.department_id"
            : "";
        const programSelect = hasProgramsTable
            ? ", p.program_name"
            : ", NULL AS program_name";
        const programJoin = hasProgramsTable
            ? "LEFT JOIN programs p ON s.program_id = p.program_id"
            : "";
        let sql = `
      SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.status, u.created_at,
            
             s.student_id, s.department_id, s.program_id, s.enrollment_year, s.semester, NULL AS gpa,
             ${departmentSelect}
             ${programSelect}
      FROM users u
      JOIN students s ON u.user_id = s.user_id
      ${departmentJoin}
      ${programJoin}
      WHERE u.role = 'student'
    `;
        const params = [];
        if (search) {
            sql +=
                " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)";
            const like = `%${search}%`;
            params.push(like, like, like);
        }
        if (departmentId) {
            sql += " AND s.department_id = ?";
            params.push(departmentId);
        }
        if (programId) {
            sql += " AND s.program_id = ?";
            params.push(programId);
        }
        if (semester) {
            sql += " AND s.semester = ?";
            params.push(semester);
        }
        if (status) {
            sql += " AND u.status = ?";
            params.push(status);
        }
        sql += " ORDER BY u.first_name ASC, u.last_name ASC";
        const students = await safeList(sql, params);
        return res.json({ success: true, data: students });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/users/students/meta
router.get("/students/meta", auth_1.verifyToken, (0, auth_1.requireRole)("admin", "professor"), async (_req, res) => {
    try {
        const hasDepartmentsTable = await tableExists("departments");
        const hasProgramsTable = await tableExists("programs");
        const [departments, programs, counts, unpaid] = await Promise.all([
            hasDepartmentsTable
                ? safeList("SELECT department_id, department_name FROM departments ORDER BY department_name")
                : Promise.resolve([]),
            hasProgramsTable
                ? safeList("SELECT program_id, program_name, department_id FROM programs ORDER BY program_name")
                : Promise.resolve([]),
            safeList(`SELECT
            COUNT(*) AS totalStudents,
            SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) AS activeStudents,
            SUM(CASE WHEN u.status = 'blocked' THEN 1 ELSE 0 END) AS blockedStudents
         FROM users u
         JOIN students s ON u.user_id = s.user_id
         WHERE u.role = 'student'`),
            safeList(`SELECT COUNT(DISTINCT p.student_id) AS unpaidStudents
         FROM payments p
         WHERE p.status = 'pending'`),
        ]);
        return res.json({
            success: true,
            data: {
                departments,
                programs,
                stats: {
                    totalStudents: counts?.[0]?.totalStudents || 0,
                    activeStudents: counts?.[0]?.activeStudents || 0,
                    blockedStudents: counts?.[0]?.blockedStudents || 0,
                    unpaidStudents: unpaid?.[0]?.unpaidStudents || 0,
                },
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/students
router.post("/students", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { firstName: rawFirstName, first_name, lastName: rawLastName, last_name, email: rawEmail, password: rawPassword, phone: rawPhone, departmentId: rawDepartmentId, department_id, programId: rawProgramId, program_id, enrollmentYear: rawEnrollmentYear, enrollment_year, semester: rawSemester, } = req.body;
        const firstName = String(rawFirstName ?? first_name ?? "").trim();
        const lastName = String(rawLastName ?? last_name ?? "").trim();
        const incomingEmail = String(rawEmail ?? "")
            .trim()
            .toLowerCase();
        const phone = rawPhone ? String(rawPhone).trim() : null;
        const departmentId = rawDepartmentId ?? department_id ?? null;
        const programId = rawProgramId ?? program_id ?? null;
        const enrollmentYear = rawEnrollmentYear ?? enrollment_year;
        const semester = rawSemester;
        const incomingPassword = String(rawPassword ?? "").trim();
        const year = Number(enrollmentYear) || new Date().getFullYear();
        const tokenName = normalizeToken(`${firstName}${lastName}`) || "student";
        const generatedEmailBase = `${tokenName}${year}`;
        const generatedPassword = `${tokenName}${year}`;
        let email = incomingEmail || `${generatedEmailBase}@university.edu`;
        const password = incomingPassword || generatedPassword;
        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: "First name and last name are required",
            });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res
                .status(400)
                .json({ success: false, message: "Please enter a valid email" });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }
        if (!incomingEmail) {
            let suffix = 1;
            while (true) {
                const existing = await safeList("SELECT user_id FROM users WHERE email = ?", [email]);
                if (!existing.length)
                    break;
                email = `${generatedEmailBase}${suffix}@university.edu`;
                suffix += 1;
            }
        }
        else {
            const existing = await safeList("SELECT user_id FROM users WHERE email = ?", [email]);
            if (existing.length) {
                return res
                    .status(400)
                    .json({ success: false, message: "Email already in use" });
            }
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const userInsert = await query("INSERT INTO users (first_name, last_name, email, password, phone, role, status) VALUES (?, ?, ?, ?, ?, 'student', 'active')", [firstName, lastName, email, hashedPassword, phone]);
        const userId = userInsert.insertId;
        const semesterValue = Number(semester) || 1;
        const studentInsert = await query("INSERT INTO students (user_id, department_id, program_id, enrollment_year, semester) VALUES (?, ?, ?, ?, ?)", [userId, departmentId || null, programId || null, year, semesterValue]);
        return res.status(201).json({
            success: true,
            message: "Student created successfully",
            data: {
                userId,
                studentId: studentInsert.insertId,
                generatedEmail: email,
                generatedPassword: incomingPassword ? null : password,
            },
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/users/students/:id
router.get("/students/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin", "professor"), async (req, res) => {
    try {
        const { id } = req.params;
        const hasDepartmentsTable = await tableExists("departments");
        const hasProgramsTable = await tableExists("programs");
        const departmentSelect = hasDepartmentsTable
            ? "d.department_name"
            : "NULL AS department_name";
        const departmentJoin = hasDepartmentsTable
            ? "LEFT JOIN departments d ON s.department_id = d.department_id"
            : "";
        const programSelect = hasProgramsTable
            ? ", p.program_name"
            : ", NULL AS program_name";
        const programJoin = hasProgramsTable
            ? "LEFT JOIN programs p ON s.program_id = p.program_id"
            : "";
        const profile = await queryFirst(`SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.status, u.block_reason, u.created_at,
              s.student_id, s.department_id, s.program_id, s.enrollment_year, s.semester, NULL AS gpa,
              ${departmentSelect}
              ${programSelect}
       FROM users u
       JOIN students s ON u.user_id = s.user_id
       ${departmentJoin}
       ${programJoin}
       WHERE u.user_id = ? AND u.role = 'student'`, [id]);
        if (!profile) {
            return res
                .status(404)
                .json({ success: false, message: "Student not found" });
        }
        const studentId = profile.student_id;
        const [enrollments, grades, attendance, payments, examRequests, library, notifications, activityLogs,] = await Promise.all([
            safeList(`SELECT e.enrollment_id, e.status, e.enrolled_at,
                  cs.section_id, cs.semester AS section_semester, cs.year,
                  c.course_code, c.course_title
           FROM enrollments e
           JOIN course_sections cs ON e.section_id = cs.section_id
           JOIN courses c ON cs.course_id = c.course_id
           WHERE e.student_id = ?
           ORDER BY e.enrolled_at DESC`, [studentId]),
            safeList(`SELECT g.grade_id, g.enrollment_id, g.midterm_score, g.final_score, g.assignment_score,
                  g.total_score, g.letter_grade,
                  c.course_code, c.course_title
           FROM grades g
           JOIN enrollments e ON g.enrollment_id = e.enrollment_id
           JOIN course_sections cs ON e.section_id = cs.section_id
           JOIN courses c ON cs.course_id = c.course_id
           WHERE e.student_id = ?
           ORDER BY g.grade_id DESC`, [studentId]),
            safeList(`SELECT attendance_id, course_id, date, status
           FROM attendance
           WHERE student_id = ?
           ORDER BY date DESC`, [studentId]),
            safeList(`SELECT payment_id, amount, payment_type, payment_method, payment_date, status
           FROM payments
           WHERE student_id = ?
           ORDER BY payment_date DESC`, [studentId]),
            safeList(`SELECT exemption_id, exam_id, reason, status, admin_note, requested_at
           FROM exam_exemptions
           WHERE student_id = ?
           ORDER BY requested_at DESC`, [studentId]),
            safeList(`SELECT borrow_id, book_id, borrow_date, due_date, return_date, status
           FROM borrow_records
           WHERE student_id = ?
           ORDER BY borrow_date DESC`, [studentId]),
            safeList(`SELECT id, title, message, is_read, created_at
           FROM notifications
           WHERE user_id = ?
           ORDER BY created_at DESC`, [id]),
            safeList(`SELECT log_id, action, ip_address, user_agent, created_at
           FROM audit_logs
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT 100`, [id]),
        ]);
        return res.json({
            success: true,
            data: {
                profile,
                enrollments,
                grades,
                attendance,
                payments,
                examRequests,
                library,
                notifications,
                activityLogs,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// PUT /api/users/students/:id
router.put("/students/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, phone, departmentId, programId, enrollmentYear, semester, } = req.body;
        await query("UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE user_id = ? AND role = 'student'", [firstName, lastName, email, phone || null, id]);
        await query("UPDATE students SET department_id = ?, program_id = ?, enrollment_year = ?, semester = ? WHERE user_id = ?", [
            departmentId || null,
            programId || null,
            enrollmentYear || null,
            semester || null,
            id,
        ]);
        return res.json({ success: true, message: "Student updated" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/students/:id/enroll
router.post("/students/:id/enroll", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { sectionId } = req.body;
        if (!sectionId) {
            return res
                .status(400)
                .json({ success: false, message: "sectionId is required" });
        }
        const student = await getStudentByUserId(Number(req.params.id));
        if (!student) {
            return res
                .status(404)
                .json({ success: false, message: "Student profile not found" });
        }
        await query("INSERT INTO enrollments (student_id, section_id, status) VALUES (?, ?, 'active') ON DUPLICATE KEY UPDATE status = 'active'", [student.student_id, sectionId]);
        return res.json({
            success: true,
            message: "Student enrolled successfully",
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/students/:id/drop
router.post("/students/:id/drop", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { enrollmentId } = req.body;
        if (!enrollmentId) {
            return res
                .status(400)
                .json({ success: false, message: "enrollmentId is required" });
        }
        await query("UPDATE enrollments SET status = 'dropped' WHERE enrollment_id = ?", [enrollmentId]);
        return res.json({ success: true, message: "Enrollment dropped" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/students/:id/notifications
router.post("/students/:id/notifications", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const hasNotificationsTable = await tableExists("notifications");
        if (!hasNotificationsTable) {
            return res.status(400).json({
                success: false,
                message: "Notifications table is not available",
            });
        }
        const { title, message } = req.body;
        if (!title || !message) {
            return res
                .status(400)
                .json({ success: false, message: "title and message are required" });
        }
        await query("INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, 0)", [req.params.id, title, message]);
        return res
            .status(201)
            .json({ success: true, message: "Notification sent" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/students/:id/exam-requests/:requestId/status
router.post("/students/:id/exam-requests/:requestId/status", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { status, adminNote } = req.body;
        if (!status || !["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "status must be approved or rejected",
            });
        }
        await query("UPDATE exam_exemptions SET status = ?, admin_note = ? WHERE exemption_id = ?", [status, adminNote || null, req.params.requestId]);
        return res.json({ success: true, message: "Request updated" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/students/:id/payments
router.post("/students/:id/payments", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const student = await getStudentByUserId(Number(req.params.id));
        if (!student) {
            return res
                .status(404)
                .json({ success: false, message: "Student profile not found" });
        }
        const { amount, paymentType, paymentMethod, paymentDate, status } = req.body;
        if (!amount) {
            return res
                .status(400)
                .json({ success: false, message: "amount is required" });
        }
        const insert = await query("INSERT INTO payments (student_id, amount, payment_type, payment_method, payment_date, status) VALUES (?, ?, ?, ?, ?, ?)", [
            student.student_id,
            amount,
            paymentType || "tuition",
            paymentMethod || "admin_entry",
            paymentDate || new Date(),
            status || "completed",
        ]);
        return res
            .status(201)
            .json({ success: true, data: { paymentId: insert.insertId } });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/students/:id/payments/:paymentId/pay
router.post("/students/:id/payments/:paymentId/pay", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { paymentMethod } = req.body;
        await query("UPDATE payments SET status = 'completed', payment_method = ?, payment_date = CURDATE() WHERE payment_id = ?", [paymentMethod || "admin_entry", req.params.paymentId]);
        return res.json({ success: true, message: "Payment marked as paid" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// ============================ PROFESSORS ============================
// GET /api/users/professors
router.get("/professors", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { search, departmentId, title } = req.query;
        const hasDepartmentsTable = await tableExists("departments");
        const hasProgramsTable = await tableExists("programs");
        const departmentSelect = hasDepartmentsTable
            ? "d.department_name"
            : "NULL AS department_name";
        const departmentJoin = hasDepartmentsTable
            ? "LEFT JOIN departments d ON p.department_id = d.department_id"
            : "";
        const programSelect = hasProgramsTable
            ? ", pgr.program_name AS degree_program_name"
            : ", NULL AS degree_program_name";
        const programJoin = hasProgramsTable
            ? "LEFT JOIN programs pgr ON p.degree_program_id = pgr.program_id"
            : "";
        let sql = `
      SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.status, u.created_at,
             p.professor_id, p.department_id, p.degree_program_id, p.title, p.hire_date, p.cv_url,
             ${departmentSelect}
             ${programSelect}
      FROM users u
      JOIN professors p ON u.user_id = p.user_id
      ${programJoin}
      ${departmentJoin}
      WHERE u.role = 'professor'
    `;
        const params = [];
        if (search) {
            sql +=
                " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)";
            const like = `%${search}%`;
            params.push(like, like, like);
        }
        if (departmentId) {
            sql += " AND p.department_id = ?";
            params.push(departmentId);
        }
        if (title) {
            sql += " AND p.title = ?";
            params.push(title);
        }
        sql += " ORDER BY u.first_name ASC";
        const professors = await query(sql, params);
        return res.json({ success: true, data: professors });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/users/professors/meta
router.get("/professors/meta", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (_req, res) => {
    try {
        const hasDepartmentsTable = await tableExists("departments");
        const hasProgramsTable = await tableExists("programs");
        const [departments, programs, titles, stats] = await Promise.all([
            hasDepartmentsTable
                ? safeList("SELECT department_id, department_name FROM departments ORDER BY department_name")
                : Promise.resolve([]),
            hasProgramsTable
                ? safeList("SELECT program_id, program_name, department_id FROM programs ORDER BY program_name")
                : Promise.resolve([]),
            safeList(`SELECT DISTINCT COALESCE(title, 'Professor') AS title
         FROM professors
         WHERE title IS NOT NULL AND title <> ''
         ORDER BY title`),
            safeList(`SELECT COUNT(*) AS totalProfessors
         FROM users u
         JOIN professors p ON u.user_id = p.user_id
         WHERE u.role = 'professor'`),
        ]);
        return res.json({
            success: true,
            data: {
                departments,
                programs,
                titles,
                stats: { totalProfessors: stats?.[0]?.totalProfessors || 0 },
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/professors
router.post("/professors", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { firstName, lastName, phone, departmentId, degreeProgramId, title, hireDate, } = req.body;
        if (!firstName || !lastName || !degreeProgramId) {
            return res.status(400).json({
                success: false,
                message: "First name, last name and degree program are required",
            });
        }
        const selectedProgram = await safeList("SELECT program_id FROM programs WHERE program_id = ? LIMIT 1", [degreeProgramId]);
        if (!selectedProgram.length) {
            return res.status(400).json({
                success: false,
                message: "Selected degree program does not exist",
            });
        }
        const emailBase = `${normalizeToken(firstName)}.${normalizeToken(lastName)}`.replace(/\.+/g, ".");
        let generatedEmail = `${emailBase}@pr.university.edu`;
        let suffix = 1;
        while (true) {
            const existing = await safeList("SELECT user_id FROM users WHERE email = ?", [generatedEmail]);
            if (!existing.length)
                break;
            generatedEmail = `${emailBase}${suffix}@pr.university.edu`;
            suffix += 1;
        }
        const rawPassword = generateProfessorPassword(String(firstName), String(lastName));
        const hashedPassword = await bcryptjs_1.default.hash(rawPassword, 10);
        const userInsert = await query("INSERT INTO users (first_name, last_name, email, password, must_change_password, phone, role, status) VALUES (?, ?, ?, ?, 1, ?, 'professor', 'active')", [firstName, lastName, generatedEmail, hashedPassword, phone || null]);
        const userId = userInsert.insertId;
        const profileInsert = await query("INSERT INTO professors (user_id, department_id, degree_program_id, title, hire_date) VALUES (?, ?, ?, ?, ?)", [
            userId,
            departmentId || null,
            degreeProgramId,
            title || "Professor",
            hireDate || new Date(),
        ]);
        return res.status(201).json({
            success: true,
            message: "Professor created successfully",
            data: {
                userId,
                professorId: profileInsert.insertId,
                generatedEmail,
                generatedPassword: rawPassword,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/users/professors/:id
router.get("/professors/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const hasDepartmentsTable = await tableExists("departments");
        const hasProgramsTable = await tableExists("programs");
        const hasSectionNameColumn = await columnExists("course_sections", "section_name");
        const hasScheduleTimeColumn = await columnExists("course_sections", "schedule_time");
        const hasRoomNumberColumn = await columnExists("course_sections", "room_number");
        const hasScheduleColumn = await columnExists("course_sections", "schedule");
        const hasRoomColumn = await columnExists("course_sections", "room");
        const departmentSelect = hasDepartmentsTable
            ? "d.department_name"
            : "NULL AS department_name";
        const departmentJoin = hasDepartmentsTable
            ? "LEFT JOIN departments d ON p.department_id = d.department_id"
            : "";
        const degreeSelect = hasProgramsTable
            ? ", pr.program_name AS degree_program_name"
            : ", NULL AS degree_program_name";
        const degreeJoin = hasProgramsTable
            ? "LEFT JOIN programs pr ON p.degree_program_id = pr.program_id"
            : "";
        const profile = await queryFirst(`SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.status,
                           p.professor_id, p.department_id, p.degree_program_id, p.title, p.hire_date,
              ${departmentSelect}
              ${degreeSelect}
       FROM users u
       JOIN professors p ON u.user_id = p.user_id
       ${degreeJoin}
       ${departmentJoin}
       WHERE u.user_id = ? AND u.role = 'professor'`, [id]);
        if (!profile) {
            return res
                .status(404)
                .json({ success: false, message: "Professor not found" });
        }
        const professorId = profile.professor_id;
        const hasEligibilityTable = await tableExists("professor_course_eligibility");
        const [sections, eligibility, availableCourses, studentsInClasses, gradingControl, assignmentsExams, schedule, performance, notifications, activityLogs,] = await Promise.all([
            safeList(`SELECT cs.section_id, cs.course_id,
          ${hasSectionNameColumn ? "COALESCE(cs.section_name, CONCAT('S', cs.section_id))" : "CONCAT('S', cs.section_id)"} AS section_name,
      cs.semester, cs.year,
      ${hasRoomNumberColumn ? "cs.room_number" : hasRoomColumn ? "cs.room" : "NULL"} AS room,
      ${hasScheduleTimeColumn ? "cs.schedule_time" : hasScheduleColumn ? "cs.schedule" : "NULL"} AS schedule,
      ${hasScheduleTimeColumn ? "cs.schedule_time" : hasScheduleColumn ? "cs.schedule" : "NULL"} AS schedule_time,
      c.course_code, c.course_title
         FROM course_sections cs
         JOIN courses c ON cs.course_id = c.course_id
         WHERE cs.professor_id = ?
         ORDER BY cs.year DESC, cs.semester`, [professorId]),
            hasEligibilityTable
                ? safeList(`SELECT pce.course_id, COALESCE(pce.eligibility_type, 'secondary') AS eligibility_type,
                  c.course_code, c.course_title
           FROM professor_course_eligibility pce
           JOIN courses c ON pce.course_id = c.course_id
           WHERE pce.professor_id = ?
           ORDER BY c.course_code`, [professorId])
                : Promise.resolve([]),
            hasEligibilityTable
                ? safeList(`SELECT c.course_id, c.course_code, c.course_title
       FROM courses c
       LEFT JOIN professor_course_eligibility pce
         ON pce.course_id = c.course_id AND pce.professor_id = ?
       WHERE c.department_id = ?
         AND (pce.course_id IS NOT NULL OR NOT EXISTS (
           SELECT 1 FROM professor_course_eligibility pce2 WHERE pce2.professor_id = ?
         ))
       ORDER BY c.course_code`, [professorId, profile.department_id || 0, professorId])
                : safeList("SELECT course_id, course_code, course_title FROM courses WHERE department_id = ? ORDER BY course_code", [profile.department_id || 0]),
            safeList(`SELECT e.enrollment_id, e.status, u.user_id AS student_user_id, u.first_name, u.last_name, u.email,
                c.course_code, c.course_title
         FROM enrollments e
         JOIN students s ON e.student_id = s.student_id
         JOIN users u ON s.user_id = u.user_id
         JOIN course_sections cs ON e.section_id = cs.section_id
         JOIN courses c ON cs.course_id = c.course_id
         WHERE cs.professor_id = ?
         ORDER BY u.first_name, u.last_name`, [professorId]),
            safeList(`SELECT cs.section_id,
       ${hasScheduleTimeColumn ? "cs.schedule_time" : hasScheduleColumn ? "cs.schedule" : "NULL"} AS schedule,
       ${hasRoomNumberColumn ? "cs.room_number" : hasRoomColumn ? "cs.room" : "NULL"} AS room,
       cs.semester, cs.year, c.course_code
FROM course_sections cs
JOIN courses c ON cs.course_id = c.course_id
WHERE cs.professor_id = ?
ORDER BY cs.year DESC, cs.semester`, [professorId]),
            Promise.all([
                safeList(`SELECT assignment_id, title, due_date, created_at
           FROM assignments
           WHERE created_by = ?
           ORDER BY created_at DESC`, [id]),
                safeList(`SELECT exam_id, exam_date, start_time, end_time, room, section_id
           FROM exams
           WHERE professor_id = ?
           ORDER BY exam_date DESC`, [professorId]),
            ]).then(([assignments, exams]) => ({ assignments, exams })),
            safeList(`SELECT cs.section_id, cs.schedule, cs.room, cs.semester, cs.year, c.course_code
         FROM course_sections cs
         JOIN courses c ON cs.course_id = c.course_id
         WHERE cs.professor_id = ?
         ORDER BY cs.year DESC, cs.semester`, [professorId]),
            safeList(`SELECT
            AVG(g.total_score) AS average_grade,
            SUM(CASE WHEN g.total_score >= 60 THEN 1 ELSE 0 END) AS passed_count,
            COUNT(*) AS total_count
         FROM grades g
         JOIN enrollments e ON g.enrollment_id = e.enrollment_id
         JOIN course_sections cs ON e.section_id = cs.section_id
         WHERE cs.professor_id = ?`, [professorId]),
            safeList(`SELECT id, title, message, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC`, [id]),
            safeList(`SELECT log_id, action, ip_address, user_agent, created_at
         FROM audit_logs
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 100`, [id]),
        ]);
        return res.json({
            success: true,
            data: {
                profile,
                sections,
                eligibility,
                availableCourses,
                studentsInClasses,
                gradingControl,
                assignmentsExams,
                schedule,
                performance: performance?.[0] || {
                    average_grade: null,
                    passed_count: 0,
                    total_count: 0,
                },
                notifications,
                activityLogs,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// PUT /api/users/professors/:id
router.put("/professors/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, phone, departmentId, degreeProgramId, title, hireDate, } = req.body;
        await query("UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE user_id = ? AND role = 'professor'", [
            firstName,
            lastName,
            String(email || "").toLowerCase(),
            phone || null,
            id,
        ]);
        await query("UPDATE professors SET department_id = ?, degree_program_id = ?, title = ?, hire_date = ? WHERE user_id = ?", [
            departmentId || null,
            degreeProgramId || null,
            title || null,
            hireDate || null,
            id,
        ]);
        return res.json({ success: true, message: "Professor updated" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/professors/:id/sections
router.post("/professors/:id/sections", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const professor = await getProfessorByUserId(Number(req.params.id));
        if (!professor) {
            return res
                .status(404)
                .json({ success: false, message: "Professor profile not found" });
        }
        const { courseId, sectionName, semester, year, room, schedule } = req.body;
        if (!courseId || !sectionName || !semester || !year) {
            return res.status(400).json({
                success: false,
                message: "courseId, sectionName, semester and year are required",
            });
        }
        const profile = await queryFirst("SELECT department_id FROM professors WHERE professor_id = ?", [professor.professor_id]);
        const sameProgramCourse = await safeList("SELECT course_id FROM courses WHERE course_id = ? AND department_id = ? LIMIT 1", [courseId, profile?.department_id || 0]);
        if (!sameProgramCourse.length) {
            return res.status(400).json({
                success: false,
                message: "Course must belong to professor department",
            });
        }
        const hasEligibilityTable = await tableExists("professor_course_eligibility");
        if (hasEligibilityTable) {
            const anyEligible = await safeList("SELECT course_id FROM professor_course_eligibility WHERE professor_id = ? LIMIT 1", [professor.professor_id]);
            if (anyEligible.length > 0) {
                const isEligible = await safeList("SELECT course_id FROM professor_course_eligibility WHERE professor_id = ? AND course_id = ? LIMIT 1", [professor.professor_id, courseId]);
                if (!isEligible.length) {
                    return res.status(400).json({
                        success: false,
                        message: "Course is not eligible for this professor",
                    });
                }
            }
        }
        const hasSectionNameColumn = await columnExists("course_sections", "section_name");
        const hasRoomNumberColumn = await columnExists("course_sections", "room_number");
        const hasRoomColumn = await columnExists("course_sections", "room");
        const hasScheduleTimeColumn = await columnExists("course_sections", "schedule_time");
        const hasScheduleColumn = await columnExists("course_sections", "schedule");
        const columns = ["course_id"];
        const values = [courseId];
        if (hasSectionNameColumn) {
            columns.push("section_name");
            values.push(sectionName);
        }
        columns.push("professor_id", "semester", "year");
        values.push(professor.professor_id, semester, year);
        if (hasRoomNumberColumn) {
            columns.push("room_number");
            values.push(room || null);
        }
        else if (hasRoomColumn) {
            columns.push("room");
            values.push(room || null);
        }
        if (hasScheduleTimeColumn) {
            columns.push("schedule_time");
            values.push(schedule || null);
        }
        else if (hasScheduleColumn) {
            columns.push("schedule");
            values.push(schedule || null);
        }
        const insertSql = `INSERT INTO course_sections (${columns.join(", ")}) VALUES (${columns
            .map(() => "?")
            .join(", ")})`;
        const insert = await query(insertSql, values);
        return res
            .status(201)
            .json({ success: true, data: { sectionId: insert.insertId } });
    }
    catch (error) {
        console.error("Failed to add professor section:", error);
        return res.status(500).json({
            success: false,
            message: error?.sqlMessage || "Server error",
        });
    }
});
router.delete("/professors/:id/sections/:sectionId", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const professor = await getProfessorByUserId(Number(req.params.id));
        if (!professor) {
            return res
                .status(404)
                .json({ success: false, message: "Professor profile not found" });
        }
        await query("DELETE FROM course_sections WHERE section_id = ? AND professor_id = ?", [req.params.sectionId, professor.professor_id]);
        return res.json({ success: true, message: "Section removed" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/professors/:id/eligibility
router.post("/professors/:id/eligibility", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const hasEligibilityTable = await tableExists("professor_course_eligibility");
        if (!hasEligibilityTable) {
            return res.status(400).json({
                success: false,
                message: "professor_course_eligibility table is not available",
            });
        }
        const professor = await getProfessorByUserId(Number(req.params.id));
        if (!professor) {
            return res
                .status(404)
                .json({ success: false, message: "Professor profile not found" });
        }
        const { courseId, eligibilityType } = req.body;
        if (!courseId) {
            return res
                .status(400)
                .json({ success: false, message: "courseId is required" });
        }
        await query(`INSERT INTO professor_course_eligibility (professor_id, course_id, eligibility_type)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE eligibility_type = VALUES(eligibility_type)`, [professor.professor_id, courseId, eligibilityType || "secondary"]);
        return res.json({ success: true, message: "Eligibility saved" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// DELETE /api/users/professors/:id/eligibility/:courseId
router.delete("/professors/:id/eligibility/:courseId", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const professor = await getProfessorByUserId(Number(req.params.id));
        if (!professor) {
            return res
                .status(404)
                .json({ success: false, message: "Professor profile not found" });
        }
        await query("DELETE FROM professor_course_eligibility WHERE professor_id = ? AND course_id = ?", [professor.professor_id, req.params.courseId]);
        return res.json({ success: true, message: "Eligibility removed" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/professors/:id/email
router.post("/professors/:id/email", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const hasNotificationsTable = await tableExists("notifications");
        if (!hasNotificationsTable) {
            return res.status(400).json({
                success: false,
                message: "Notifications table is not available",
            });
        }
        const { subject, message } = req.body;
        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: "subject and message are required",
            });
        }
        await query("INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, 0)", [req.params.id, subject, message]);
        return res.status(201).json({ success: true, message: "Message sent" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// ============================ GENERIC USERS ============================
// GET /api/users/:id — Admin only
router.get("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const users = await query(`SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.role, u.status, u.block_reason, u.created_at
       FROM users u WHERE u.user_id = ?`, [req.params.id]);
        if (users.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        }
        return res.json({ success: true, data: users[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// PUT /api/users/:id — Admin generic update
router.put("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { firstName, lastName, phone } = req.body;
        await query("UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE user_id = ?", [firstName, lastName, phone, req.params.id]);
        return res.json({ success: true, message: "User updated" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/:id/block
router.post("/:id/block", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            return res
                .status(400)
                .json({ success: false, message: "Block reason is required" });
        }
        await query("UPDATE users SET status = 'blocked', block_reason = ? WHERE user_id = ?", [reason, req.params.id]);
        return res.json({ success: true, message: "User blocked successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/:id/unblock
router.post("/:id/unblock", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query("UPDATE users SET status = 'active', block_reason = NULL WHERE user_id = ?", [req.params.id]);
        return res.json({
            success: true,
            message: "User unblocked successfully",
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/:id/reset-password
router.post("/:id/reset-password", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }
        const hashed = await bcryptjs_1.default.hash(newPassword, 10);
        await query("UPDATE users SET password = ?, must_change_password = 1 WHERE user_id = ?", [hashed, req.params.id]);
        return res.json({
            success: true,
            message: "Password reset successfully",
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// DELETE /api/users/:id
router.delete("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query("DELETE FROM users WHERE user_id = ?", [req.params.id]);
        return res.json({ success: true, message: "User deleted" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
