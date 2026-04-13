"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const query = (sql, params = []) => new Promise((resolve, reject) => db_1.default.query(sql, params, (err, results) => (err ? reject(err) : resolve(results))));
const getStudentId = async (userId) => {
    const rows = await query("SELECT student_id FROM students WHERE user_id = ?", [userId]);
    return rows.length > 0 ? rows[0].student_id : null;
};
const getProfessorId = async (userId) => {
    const rows = await query("SELECT professor_id FROM professors WHERE user_id = ?", [userId]);
    return rows.length > 0 ? rows[0].professor_id : null;
};
const professorOwnsSection = async (userId, sectionId) => {
    const professorId = await getProfessorId(userId);
    if (!professorId) {
        return false;
    }
    const rows = await query("SELECT section_id FROM course_sections WHERE section_id = ? AND professor_id = ?", [sectionId, professorId]);
    return rows.length > 0;
};
// GET /api/attendance/my — Student views own attendance
router.get("/my", auth_1.verifyToken, (0, auth_1.requireRole)("student"), async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        if (!studentId)
            return res.status(404).json({ success: false, message: "Student profile not found" });
        const { sectionId } = req.query;
        let sql = `
      SELECT a.attendance_id AS id, a.section_id, a.date, a.status,
             c.course_code, c.course_title, c.credits,
             cs.semester, cs.year
      FROM attendance a
      JOIN course_sections cs ON a.section_id = cs.section_id
      JOIN courses c ON cs.course_id = c.course_id
      WHERE a.student_id = ?
    `;
        const params = [studentId];
        if (sectionId) {
            sql += " AND a.section_id = ?";
            params.push(sectionId);
        }
        sql += " ORDER BY a.date DESC";
        const rows = await query(sql, params);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/attendance/course/:sectionId/report — Summary for a section
router.get("/course/:sectionId/report", auth_1.verifyToken, async (req, res) => {
    try {
        const { sectionId } = req.params;
        if (req.user.role === "student") {
            const studentId = await getStudentId(req.user.id);
            if (!studentId)
                return res.status(404).json({ success: false, message: "Student profile not found" });
            const rows = await query(`SELECT
           COUNT(*) AS total,
           SUM(status = 'Present') AS present,
           SUM(status = 'Absent') AS absent,
           SUM(status = 'Late') AS late
         FROM attendance WHERE section_id = ? AND student_id = ?`, [sectionId, studentId]);
            const { total, present, absent, late } = rows[0];
            const percentage = total > 0 ? Math.round((Number(present) / Number(total)) * 100) : 0;
            const courseInfo = await query(`SELECT c.credits FROM course_sections cs JOIN courses c ON cs.course_id = c.course_id WHERE cs.section_id = ?`, [sectionId]);
            const absenceLimit = courseInfo.length > 0 && courseInfo[0].credits === 1 ? 5 : 10;
            return res.json({
                success: true,
                data: {
                    sectionId,
                    total: Number(total),
                    present: Number(present),
                    absent: Number(absent),
                    late: Number(late),
                    percentage,
                    absenceLimit,
                    atRisk: Number(absent) >= absenceLimit,
                },
            });
        }
        const rows = await query(`SELECT a.student_id, u.first_name, u.last_name,
              COUNT(*) AS total,
              SUM(a.status = 'Present') AS present,
              SUM(a.status = 'Absent') AS absent,
              SUM(a.status = 'Late') AS late
       FROM attendance a
       JOIN students s ON a.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE a.section_id = ?
       GROUP BY a.student_id
       ORDER BY u.last_name`, [sectionId]);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/attendance/section/:sectionId/students — Active students in a section
router.get("/section/:sectionId/students", auth_1.verifyToken, (0, auth_1.requireRole)("professor", "admin"), async (req, res) => {
    try {
        const { sectionId } = req.params;
        if (req.user.role === "professor") {
            const ownsSection = await professorOwnsSection(req.user.id, sectionId);
            if (!ownsSection) {
                return res.status(403).json({ success: false, message: "You do not teach this section" });
            }
        }
        const rows = await query(`SELECT s.student_id, u.user_id, u.first_name, u.last_name, u.email,
              e.enrollment_id, e.enrolled_at
       FROM enrollments e
       JOIN students s ON e.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE e.section_id = ? AND e.status = 'active'
       ORDER BY u.last_name, u.first_name`, [sectionId]);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/attendance — All attendance (Admin/Professor)
router.get("/", auth_1.verifyToken, (0, auth_1.requireRole)("admin", "professor"), async (req, res) => {
    try {
        const { studentId, sectionId, date } = req.query;
        let sql = `
      SELECT a.attendance_id AS id, a.student_id, a.section_id, a.date, a.status,
             u.first_name, u.last_name,
             c.course_code, c.course_title
      FROM attendance a
      JOIN students s ON a.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      JOIN course_sections cs ON a.section_id = cs.section_id
      JOIN courses c ON cs.course_id = c.course_id
      WHERE 1=1
    `;
        const params = [];
        if (studentId) {
            sql += " AND a.student_id = ?";
            params.push(studentId);
        }
        if (sectionId) {
            sql += " AND a.section_id = ?";
            params.push(sectionId);
        }
        if (date) {
            sql += " AND a.date = ?";
            params.push(date);
        }
        if (req.user.role === "professor") {
            const professorId = await getProfessorId(req.user.id);
            if (!professorId) {
                return res.status(404).json({ success: false, message: "Professor profile not found" });
            }
            sql += " AND cs.professor_id = ?";
            params.push(professorId);
        }
        sql += " ORDER BY a.date DESC LIMIT 200";
        const rows = await query(sql, params);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/attendance — Professor marks attendance for a session
// Body: { sectionId, date, records: [{ studentId, status }] }
router.post("/", auth_1.verifyToken, (0, auth_1.requireRole)("professor", "admin"), async (req, res) => {
    try {
        const { sectionId, date, records } = req.body;
        if (!sectionId || !date || !Array.isArray(records)) {
            return res.status(400).json({ success: false, message: "sectionId, date, and records array are required" });
        }
        if (req.user.role === "professor") {
            const ownsSection = await professorOwnsSection(req.user.id, sectionId);
            if (!ownsSection) {
                return res.status(403).json({ success: false, message: "You do not teach this section" });
            }
        }
        const enrolledStudents = await query("SELECT student_id FROM enrollments WHERE section_id = ? AND status = 'active'", [sectionId]);
        const allowedStudentIds = new Set(enrolledStudents.map((row) => Number(row.student_id)));
        for (const rec of records) {
            if (!allowedStudentIds.has(Number(rec.studentId))) {
                return res.status(400).json({
                    success: false,
                    message: `Student ${rec.studentId} is not actively enrolled in this section`,
                });
            }
            await query(`INSERT INTO attendance (section_id, student_id, date, status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`, [sectionId, rec.studentId, date, rec.status]);
        }
        return res.json({ success: true, message: `Attendance marked for ${records.length} students` });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
