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
const query = (sql, params = []) => new Promise((resolve, reject) => db_1.default.query(sql, params, (err, results) => (err ? reject(err) : resolve(results))));
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
const getStudentByUserId = async (userId) => queryFirst("SELECT student_id FROM students WHERE user_id = ?", [userId]);
const normalizeToken = (value) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
// ===================================================
// GET /api/users/students
// ===================================================
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
// ===================================================
// GET /api/users/students/meta
// ===================================================
router.get("/students/meta", auth_1.verifyToken, (0, auth_1.requireRole)("admin", "professor"), async (_req, res) => {
    try {
        const [departments, programs] = await Promise.all([
            safeList("SELECT department_id, department_name FROM departments ORDER BY department_name"),
            safeList("SELECT program_id, program_name, department_id FROM programs ORDER BY program_name"),
        ]);
        const [counts, unpaid] = await Promise.all([
            safeList(`
          SELECT
            COUNT(*) AS totalStudents,
            SUM(CASE WHEN u.status='active' THEN 1 ELSE 0 END) AS activeStudents,
            SUM(CASE WHEN u.status='blocked' THEN 1 ELSE 0 END) AS blockedStudents
          FROM users u
          JOIN students s ON u.user_id=s.user_id
          WHERE u.role='student'
        `),
            safeList(`
          SELECT COUNT(DISTINCT p.student_id) AS unpaidStudents
          FROM payments p
          WHERE p.status='pending'
        `),
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
    catch {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// ===================================================
// POST /api/users/students
// ===================================================
router.post("/students", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { firstName: rawFirstName, first_name, lastName: rawLastName, last_name, email: rawEmail, password: rawPassword, phone: rawPhone, departmentId: rawDepartmentId, department_id, programId: rawProgramId, program_id, enrollmentYear: rawEnrollmentYear, enrollment_year, semester: rawSemester, } = req.body;
        const firstName = String(rawFirstName ?? first_name ?? "").trim();
        const lastName = String(rawLastName ?? last_name ?? "").trim();
        const incomingEmail = String(rawEmail ?? "").trim().toLowerCase();
        const incomingPassword = String(rawPassword ?? "").trim();
        const phone = rawPhone ? String(rawPhone).trim() : null;
        const departmentId = rawDepartmentId ?? department_id ?? null;
        const programId = rawProgramId ?? program_id ?? null;
        const enrollmentYear = rawEnrollmentYear ?? enrollment_year;
        const semester = rawSemester;
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
            return res.status(400).json({
                success: false,
                message: "Please enter valid email",
            });
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
                const existing = await safeList("SELECT user_id FROM users WHERE email=?", [email]);
                if (!existing.length)
                    break;
                email = `${generatedEmailBase}${suffix}@university.edu`;
                suffix++;
            }
        }
        else {
            const existing = await safeList("SELECT user_id FROM users WHERE email=?", [email]);
            if (existing.length) {
                return res.status(400).json({
                    success: false,
                    message: "Email already exists",
                });
            }
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const userInsert = await query(`INSERT INTO users
        (first_name,last_name,email,password,phone,role,status)
        VALUES (?,?,?,?,?,'student','active')`, [firstName, lastName, email, hashedPassword, phone]);
        const userId = userInsert.insertId;
        const studentInsert = await query(`INSERT INTO students
        (user_id,department_id,program_id,enrollment_year,semester)
        VALUES (?,?,?,?,?)`, [
            userId,
            departmentId,
            programId,
            year,
            Number(semester) || 1,
        ]);
        return res.status(201).json({
            success: true,
            message: "Student created successfully",
            data: {
                userId,
                studentId: studentInsert.insertId,
                email,
                password,
            },
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// ===================================================
// GET /api/users/professors
// ===================================================
router.get("/professors", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { search } = req.query;
        let sql = `
        SELECT u.user_id,u.first_name,u.last_name,u.email,u.phone,u.status,u.created_at,
               p.professor_id,p.department_id,p.title,p.hire_date,p.cv_url,
               d.department_name
        FROM users u
        JOIN professors p ON u.user_id=p.user_id
        LEFT JOIN departments d ON p.department_id=d.department_id
        WHERE u.role='professor'
      `;
        const params = [];
        if (search) {
            sql +=
                " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)";
            const like = `%${search}%`;
            params.push(like, like, like);
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
// ===================================================
// keep your old routes below
// ===================================================
// GET /api/users/:id
router.get("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const users = await query(`SELECT user_id, first_name, last_name, email, phone, role, status, block_reason, created_at
       FROM users WHERE user_id = ?`, [req.params.id]);
        if (!users.length) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.json({
            success: true,
            data: users[0],
        });
    }
    catch {
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});
// RESET PASSWORD
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
        await query("UPDATE users SET password=? WHERE user_id=?", [
            hashed,
            req.params.id,
        ]);
        return res.json({
            success: true,
            message: "Password reset successfully",
        });
    }
    catch {
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});
// DELETE USER
router.delete("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query("DELETE FROM users WHERE user_id=?", [req.params.id]);
        return res.json({
            success: true,
            message: "User deleted",
        });
    }
    catch {
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});
exports.default = router;
