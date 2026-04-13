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
// GET /api/courses — All authenticated users
router.get("/", auth_1.verifyToken, async (req, res) => {
    try {
        const { departmentId, semester, programId, year } = req.query;
        let sql = `
      SELECT c.course_id, c.course_code, c.course_title, c.credits, c.description,
             c.department_id, c.program_id,
             d.department_name, pr.program_name
      FROM courses c
      LEFT JOIN departments d ON c.department_id = d.department_id
      LEFT JOIN programs pr ON c.program_id = pr.program_id
      WHERE 1=1
    `;
        const params = [];
        if (departmentId) {
            sql += " AND c.department_id = ?";
            params.push(departmentId);
        }
        if (programId) {
            sql += " AND c.program_id = ?";
            params.push(programId);
        }
        sql += " ORDER BY c.course_code ASC";
        const courses = await query(sql, params);
        return res.json({ success: true, data: courses });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/courses/sections — All course sections (with professor and schedule info)
router.get("/sections", auth_1.verifyToken, async (req, res) => {
    try {
        const { semester, year, courseId, professorId } = req.query;
        let sql = `
      SELECT cs.section_id, cs.course_id, cs.professor_id, cs.semester, cs.year,
             cs.room_number, cs.schedule_time,
             c.course_code, c.course_title, c.credits,
             u.first_name, u.last_name,
             (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = cs.section_id AND e.status = 'active') AS enrolled_count,
             gec.is_enabled AS grade_entry_enabled
      FROM course_sections cs
      JOIN courses c ON cs.course_id = c.course_id
      JOIN professors p ON cs.professor_id = p.professor_id
      JOIN users u ON p.user_id = u.user_id
      LEFT JOIN grade_entry_control gec ON gec.section_id = cs.section_id
      WHERE 1=1
    `;
        const params = [];
        if (semester) {
            sql += " AND cs.semester = ?";
            params.push(semester);
        }
        if (year) {
            sql += " AND cs.year = ?";
            params.push(year);
        }
        if (courseId) {
            sql += " AND cs.course_id = ?";
            params.push(courseId);
        }
        if (professorId) {
            sql += " AND cs.professor_id = ?";
            params.push(professorId);
        }
        sql += " ORDER BY cs.year DESC, cs.semester";
        const sections = await query(sql, params);
        return res.json({ success: true, data: sections });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/courses/:id — Single course with prerequisites and sections
router.get("/:id", auth_1.verifyToken, async (req, res) => {
    try {
        const courses = await query(`SELECT c.*, d.department_name, pr.program_name
       FROM courses c
       LEFT JOIN departments d ON c.department_id = d.department_id
       LEFT JOIN programs pr ON c.program_id = pr.program_id
       WHERE c.course_id = ?`, [req.params.id]);
        if (courses.length === 0) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }
        // Get prerequisites
        const prereqs = await query(`SELECT p.required_course_id, c.course_code, c.course_title
       FROM prerequisites p
       JOIN courses c ON p.required_course_id = c.course_id
       WHERE p.course_id = ?`, [req.params.id]);
        return res.json({
            success: true,
            data: { ...courses[0], prerequisites: prereqs },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/courses — Admin only
router.post("/", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { courseCode, courseTitle, credits, description, departmentId, programId } = req.body;
        const result = await query("INSERT INTO courses (course_code, course_title, credits, description, department_id, program_id) VALUES (?, ?, ?, ?, ?, ?)", [courseCode, courseTitle, credits, description, departmentId || null, programId || null]);
        return res.status(201).json({ success: true, data: { courseId: result.insertId } });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// PUT /api/courses/:id — Admin only
router.put("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { courseCode, courseTitle, credits, description, departmentId, programId } = req.body;
        await query("UPDATE courses SET course_code=?, course_title=?, credits=?, description=?, department_id=?, program_id=? WHERE course_id=?", [courseCode, courseTitle, credits, description, departmentId, programId, req.params.id]);
        return res.json({ success: true, message: "Course updated" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// DELETE /api/courses/:id — Admin only
router.delete("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query("DELETE FROM courses WHERE course_id = ?", [req.params.id]);
        return res.json({ success: true, message: "Course deleted" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/courses/sections — Admin creates a section
router.post("/sections", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { courseId, professorId, semester, year, roomNumber, scheduleTime } = req.body;
        const result = await query("INSERT INTO course_sections (course_id, professor_id, semester, year, room_number, schedule_time) VALUES (?, ?, ?, ?, ?, ?)", [courseId, professorId, semester, year, roomNumber, scheduleTime]);
        // Auto-create grade_entry_control row (disabled by default)
        await query("INSERT INTO grade_entry_control (section_id, is_enabled) VALUES (?, 0)", [result.insertId]);
        return res.status(201).json({ success: true, data: { sectionId: result.insertId } });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/courses/:id/prerequisites — Admin adds a prerequisite
router.post("/:id/prerequisites", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { requiredCourseId } = req.body;
        await query("INSERT IGNORE INTO prerequisites (course_id, required_course_id) VALUES (?, ?)", [req.params.id, requiredCourseId]);
        return res.json({ success: true, message: "Prerequisite added" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// DELETE /api/courses/:id/prerequisites/:reqId — Admin removes a prerequisite
router.delete("/:id/prerequisites/:reqId", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query("DELETE FROM prerequisites WHERE course_id = ? AND required_course_id = ?", [req.params.id, req.params.reqId]);
        return res.json({ success: true, message: "Prerequisite removed" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
