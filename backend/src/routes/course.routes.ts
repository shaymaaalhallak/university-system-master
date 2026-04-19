import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) =>
      err ? reject(err) : resolve(results),
    ),
  );

// GET /api/courses — All authenticated users
router.get("/", verifyToken, async (req: Request, res: Response) => {
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
    const params: any[] = [];

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
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/courses/sections — All course sections (with professor and schedule info)
router.get("/sections", verifyToken, async (req: Request, res: Response) => {
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
    const params: any[] = [];

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
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
// GET /api/courses/study-plans — list study plans
router.get(
  "/study-plans",
  verifyToken,
  requireRole("admin"),
  async (_req: Request, res: Response) => {
    try {
      const rows = await query(
        `SELECT sp.plan_id, sp.plan_name, sp.department_id, sp.program_id, sp.created_at,
              d.department_name, p.program_name,
              COUNT(spc.id) AS courses_count
       FROM study_plans sp
       LEFT JOIN departments d ON sp.department_id = d.department_id
       LEFT JOIN programs p ON sp.program_id = p.program_id
       LEFT JOIN study_plan_courses spc ON sp.plan_id = spc.plan_id
       GROUP BY sp.plan_id, sp.plan_name, sp.department_id, sp.program_id, sp.created_at, d.department_name, p.program_name
       ORDER BY sp.plan_name`,
      );
      return res.json({ success: true, data: rows });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);
// POST /api/courses/study-plans — create study plan
router.post(
  "/study-plans",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { planName, departmentId, programId } = req.body;
      if (!planName)
        return res
          .status(400)
          .json({ success: false, message: "planName is required" });
      const insert: any = await query(
        "INSERT INTO study_plans (plan_name, department_id, program_id) VALUES (?, ?, ?)",
        [planName, departmentId || null, programId || null],
      );
      return res
        .status(201)
        .json({ success: true, data: { planId: insert.insertId } });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// GET /api/courses/study-plans/:id — plan details with year/semester mapping
router.get(
  "/study-plans/:id",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const planRows = await query(
        `SELECT sp.plan_id, sp.plan_name, sp.department_id, sp.program_id, d.department_name, p.program_name
       FROM study_plans sp
       LEFT JOIN departments d ON sp.department_id = d.department_id
       LEFT JOIN programs p ON sp.program_id = p.program_id
       WHERE sp.plan_id = ?`,
        [req.params.id],
      );
      if (!planRows.length)
        return res
          .status(404)
          .json({ success: false, message: "Plan not found" });

      const items = await query(
        `SELECT spc.id, spc.course_id, spc.year_no, spc.semester_no, spc.is_required,
              c.course_code, c.course_title, c.credits
       FROM study_plan_courses spc
       JOIN courses c ON spc.course_id = c.course_id
       WHERE spc.plan_id = ?
       ORDER BY spc.year_no ASC, spc.semester_no ASC, c.course_code ASC`,
        [req.params.id],
      );

      return res.json({ success: true, data: { ...planRows[0], items } });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// PUT /api/courses/study-plans/:id — update plan
router.put(
  "/study-plans/:id",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { planName, departmentId, programId } = req.body;
      await query(
        "UPDATE study_plans SET plan_name = ?, department_id = ?, program_id = ? WHERE plan_id = ?",
        [planName, departmentId || null, programId || null, req.params.id],
      );
      return res.json({ success: true, message: "Study plan updated" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// POST /api/courses/study-plans/:id/courses — add course to plan
router.post(
  "/study-plans/:id/courses",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { courseId, yearNo, semesterNo, isRequired } = req.body;
      if (!courseId || !yearNo || !semesterNo) {
        return res.status(400).json({
          success: false,
          message: "courseId, yearNo and semesterNo are required",
        });
      }
      await query(
        `INSERT INTO study_plan_courses (plan_id, course_id, year_no, semester_no, is_required)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE year_no = VALUES(year_no), semester_no = VALUES(semester_no), is_required = VALUES(is_required)`,
        [
          req.params.id,
          courseId,
          yearNo,
          semesterNo,
          isRequired === false ? 0 : 1,
        ],
      );
      return res
        .status(201)
        .json({ success: true, message: "Course added to study plan" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// PUT /api/courses/study-plans/:id/courses/:courseId — move/update course in plan
router.put(
  "/study-plans/:id/courses/:courseId",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { yearNo, semesterNo, isRequired } = req.body;
      await query(
        "UPDATE study_plan_courses SET year_no = ?, semester_no = ?, is_required = ? WHERE plan_id = ? AND course_id = ?",
        [
          yearNo,
          semesterNo,
          isRequired === false ? 0 : 1,
          req.params.id,
          req.params.courseId,
        ],
      );
      return res.json({ success: true, message: "Study plan course updated" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// DELETE /api/courses/study-plans/:id/courses/:courseId — remove course from plan
router.delete(
  "/study-plans/:id/courses/:courseId",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      await query(
        "DELETE FROM study_plan_courses WHERE plan_id = ? AND course_id = ?",
        [req.params.id, req.params.courseId],
      );
      return res.json({
        success: true,
        message: "Course removed from study plan",
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// GET /api/courses/:id/study-plans — show which plans use this course
router.get(
  "/:id/study-plans",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const rows = await query(
        `SELECT sp.plan_id, sp.plan_name, spc.year_no, spc.semester_no, spc.is_required
       FROM study_plan_courses spc
       JOIN study_plans sp ON spc.plan_id = sp.plan_id
       WHERE spc.course_id = ?
       ORDER BY sp.plan_name, spc.year_no, spc.semester_no`,
        [req.params.id],
      );
      return res.json({ success: true, data: rows });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// GET /api/courses/:id — Single course with prerequisites and sections
router.get("/:id", verifyToken, async (req: Request, res: Response) => {
  try {
    const courses = await query(
      `SELECT c.*, d.department_name, pr.program_name
       FROM courses c
       LEFT JOIN departments d ON c.department_id = d.department_id
       LEFT JOIN programs pr ON c.program_id = pr.program_id
       WHERE c.course_id = ?`,
      [req.params.id],
    );
    if (courses.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Get prerequisites
    const prereqs = await query(
      `SELECT p.required_course_id, c.course_code, c.course_title
       FROM prerequisites p
       JOIN courses c ON p.required_course_id = c.course_id
       WHERE p.course_id = ?`,
      [req.params.id],
    );

    return res.json({
      success: true,
      data: { ...courses[0], prerequisites: prereqs },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/courses — Admin only
router.post(
  "/",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const {
        courseCode,
        courseTitle,
        credits,
        description,
        departmentId,
        programId,
      } = req.body;
      const result: any = await query(
        "INSERT INTO courses (course_code, course_title, credits, description, department_id, program_id) VALUES (?, ?, ?, ?, ?, ?)",
        [
          courseCode,
          courseTitle,
          credits,
          description,
          departmentId || null,
          programId || null,
        ],
      );
      return res
        .status(201)
        .json({ success: true, data: { courseId: result.insertId } });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// PUT /api/courses/:id — Admin only
router.put(
  "/:id",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const {
        courseCode,
        courseTitle,
        credits,
        description,
        departmentId,
        programId,
      } = req.body;
      await query(
        "UPDATE courses SET course_code=?, course_title=?, credits=?, description=?, department_id=?, program_id=? WHERE course_id=?",
        [
          courseCode,
          courseTitle,
          credits,
          description,
          departmentId,
          programId,
          req.params.id,
        ],
      );
      return res.json({ success: true, message: "Course updated" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// DELETE /api/courses/:id — Admin only
router.delete(
  "/:id",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      await query("DELETE FROM courses WHERE course_id = ?", [req.params.id]);
      return res.json({ success: true, message: "Course deleted" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// POST /api/courses/sections — Admin creates a section
router.post(
  "/sections",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const {
        courseId,
        professorId,
        semester,
        year,
        roomNumber,
        scheduleTime,
      } = req.body;
      const result: any = await query(
        "INSERT INTO course_sections (course_id, professor_id, semester, year, room_number, schedule_time) VALUES (?, ?, ?, ?, ?, ?)",
        [courseId, professorId, semester, year, roomNumber, scheduleTime],
      );
      // Auto-create grade_entry_control row (disabled by default)
      await query(
        "INSERT INTO grade_entry_control (section_id, is_enabled) VALUES (?, 0)",
        [result.insertId],
      );
      return res
        .status(201)
        .json({ success: true, data: { sectionId: result.insertId } });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// POST /api/courses/:id/prerequisites — Admin adds a prerequisite
router.post(
  "/:id/prerequisites",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { requiredCourseId } = req.body;
      await query(
        "INSERT IGNORE INTO prerequisites (course_id, required_course_id) VALUES (?, ?)",
        [req.params.id, requiredCourseId],
      );
      return res.json({ success: true, message: "Prerequisite added" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// DELETE /api/courses/:id/prerequisites/:reqId — Admin removes a prerequisite
router.delete(
  "/:id/prerequisites/:reqId",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      await query(
        "DELETE FROM prerequisites WHERE course_id = ? AND required_course_id = ?",
        [req.params.id, req.params.reqId],
      );
      return res.json({ success: true, message: "Prerequisite removed" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

export default router;
