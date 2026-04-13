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
const getProfessorId = async (userId) => {
    const rows = await query("SELECT professor_id FROM professors WHERE user_id = ?", [userId]);
    return rows.length > 0 ? rows[0].professor_id : null;
};
// GET /api/professor/my-sections — Professor's own sections
router.get("/my-sections", auth_1.verifyToken, (0, auth_1.requireRole)("professor"), async (req, res) => {
    try {
        const rows = await query(`SELECT cs.section_id, cs.course_id, cs.semester, cs.year, cs.room_number, cs.schedule_time,
              c.course_code, c.course_title, c.credits,
              (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = cs.section_id AND e.status = 'active') AS enrolled_count,
              COALESCE(gec.is_enabled, 0) AS grade_entry_enabled
       FROM course_sections cs
       JOIN professors p ON cs.professor_id = p.professor_id
       JOIN courses c ON cs.course_id = c.course_id
       LEFT JOIN grade_entry_control gec ON gec.section_id = cs.section_id
       WHERE p.user_id = ?
       ORDER BY cs.year DESC, cs.semester, c.course_code`, [req.user.id]);
        const profileRows = await query("SELECT professor_id FROM professors WHERE user_id = ?", [req.user.id]);
        if (profileRows.length === 0) {
            return res.status(404).json({ success: false, message: "Professor profile not found" });
        }
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/professor/sections/:sectionId/students — Students enrolled in a section
router.get("/sections/:sectionId/students", auth_1.verifyToken, (0, auth_1.requireRole)("professor", "admin"), async (req, res) => {
    try {
        // If professor, verify they teach this section
        if (req.user.role === "professor") {
            const profId = await getProfessorId(req.user.id);
            const owns = await query("SELECT section_id FROM course_sections WHERE section_id = ? AND professor_id = ?", [req.params.sectionId, profId]);
            if (owns.length === 0) {
                return res.status(403).json({ success: false, message: "Access denied" });
            }
        }
        const rows = await query(`SELECT u.user_id, u.first_name, u.last_name, u.email,
              s.student_id, s.semester as student_semester, s.gpa,
              e.enrollment_id, e.enrolled_at, e.status AS enrollment_status,
              g.total_score, g.letter_grade,
              (SELECT SUM(a.status = 'Present') FROM attendance a WHERE a.student_id = s.student_id AND a.section_id = ?) AS present_count,
              (SELECT SUM(a.status = 'Absent') FROM attendance a WHERE a.student_id = s.student_id AND a.section_id = ?) AS absent_count
       FROM enrollments e
       JOIN students s ON e.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       LEFT JOIN grades g ON g.student_id = e.student_id AND g.section_id = e.section_id
       WHERE e.section_id = ? AND e.status = 'active'
       ORDER BY u.last_name`, [req.params.sectionId, req.params.sectionId, req.params.sectionId]);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/professor/cv — Get own CV (professor only)
router.get("/cv", auth_1.verifyToken, (0, auth_1.requireRole)("professor"), async (req, res) => {
    try {
        const rows = await query("SELECT cv_url, title, hire_date FROM professors WHERE user_id = ?", [req.user.id]);
        if (rows.length === 0)
            return res.status(404).json({ success: false, message: "Profile not found" });
        return res.json({ success: true, data: rows[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// PUT /api/professor/cv — Professor uploads/updates their CV URL
// (In production, use multer for file upload; here we accept a URL)
router.put("/cv", auth_1.verifyToken, (0, auth_1.requireRole)("professor"), async (req, res) => {
    try {
        const { cvUrl } = req.body;
        if (!cvUrl)
            return res.status(400).json({ success: false, message: "cvUrl is required" });
        await query("UPDATE professors SET cv_url = ? WHERE user_id = ?", [cvUrl, req.user.id]);
        return res.json({ success: true, message: "CV updated successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/professor/:professorId/cv — Admin views a professor's CV
router.get("/:professorId/cv", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const rows = await query(`SELECT p.cv_url, p.title, p.hire_date, u.first_name, u.last_name, u.email
       FROM professors p JOIN users u ON p.user_id = u.user_id
       WHERE p.professor_id = ?`, [req.params.professorId]);
        if (rows.length === 0)
            return res.status(404).json({ success: false, message: "Professor not found" });
        return res.json({ success: true, data: rows[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
