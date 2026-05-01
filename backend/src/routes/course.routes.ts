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
const tableExists = async (tableName: string): Promise<boolean> => {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
};
const columnExists = async (
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
};
const isColumnNullable = async (
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  const rows = await query(
    `SELECT IS_NULLABLE AS is_nullable
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  return String(rows?.[0]?.is_nullable || "YES").toUpperCase() === "YES";
};
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
    const baseSql = sql;
    const baseParams = [...params];
    let appliedStudyPlanFilter = false;

    if (req.user?.role === "student") {
      const studentRows = await query(
        "SELECT student_id, department_id, program_id, semester FROM students WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );
      if (!studentRows.length) {
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });
      }
      const student = studentRows[0];

      const [
        hasStudyPlans,
        hasStudyPlanCourses,
        hasProgramColumn,
        hasDepartmentColumn,
      ] = await Promise.all([
        tableExists("study_plans"),
        tableExists("study_plan_courses"),
        columnExists("study_plans", "program_id"),
        columnExists("study_plans", "department_id"),
      ]);

      if (hasStudyPlans && hasStudyPlanCourses) {
        const planScopeConditions: string[] = [];
        const planScopeParams: any[] = [];

        if (hasProgramColumn) {
          planScopeConditions.push("sp.program_id = ?");
          planScopeParams.push(Number(student.program_id || 0));
        }

        if (hasProgramColumn && hasDepartmentColumn) {
          planScopeConditions.push(
            "(sp.program_id IS NULL AND (sp.department_id = ? OR sp.department_id IS NULL))",
          );
          planScopeParams.push(Number(student.department_id || 0));
        } else if (!hasProgramColumn && hasDepartmentColumn) {
          planScopeConditions.push(
            "(sp.department_id = ? OR sp.department_id IS NULL)",
          );
          planScopeParams.push(Number(student.department_id || 0));
        }

        if (planScopeConditions.length > 0) {
          const allowedRows = await query(
            `SELECT 1
             FROM study_plan_courses spc
             JOIN study_plans sp ON sp.plan_id = spc.plan_id
             WHERE spc.semester_no = ?
               AND (${planScopeConditions.join(" OR ")})
             LIMIT 1`,
            [Number(student.semester || 1), ...planScopeParams],
          );

          if (allowedRows.length > 0) {
            sql += ` AND cs.course_id IN (
              SELECT DISTINCT spc.course_id
              FROM study_plan_courses spc
              JOIN study_plans sp ON sp.plan_id = spc.plan_id
              WHERE spc.semester_no = ?
                AND (${planScopeConditions.join(" OR ")})
            )`;
            params.push(Number(student.semester || 1), ...planScopeParams);
            appliedStudyPlanFilter = true;
          }
        }
      }
    }

    sql += " ORDER BY cs.year DESC, cs.semester";

    let sections = await query(sql, params);
    if (
      req.user?.role === "student" &&
      appliedStudyPlanFilter &&
      sections.length === 0
    ) {
      const fallbackSql = `${baseSql} ORDER BY cs.year DESC, cs.semester`;
      sections = await query(fallbackSql, baseParams);
    }
    return res.json({ success: true, data: sections });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/courses/study-plans — list study plans
router.get(
  "/study-plans/meta",
  verifyToken,
  requireRole("admin"),
  async (_req: Request, res: Response) => {
    try {
      const hasDepartments = await tableExists("departments");
      const hasPrograms = await tableExists("programs");
      const [departments, programs] = await Promise.all([
        hasDepartments
          ? query(
              "SELECT department_id, department_name FROM departments ORDER BY department_name",
            )
          : Promise.resolve([]),
        hasPrograms
          ? query(
              "SELECT program_id, program_name, department_id FROM programs ORDER BY program_name",
            )
          : Promise.resolve([]),
      ]);
      return res.json({ success: true, data: { departments, programs } });
    } catch (error) {
      console.error("Study-plan meta error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// GET /api/courses/study-plans — list study plans
router.get(
  "/study-plans",
  verifyToken,
  requireRole("admin"),
  async (_req: Request, res: Response) => {
    try {
      const [
        hasDepartmentColumn,
        hasProgramColumn,
        hasPlanNameColumn,
        hasCreatedAtColumn,
      ] = await Promise.all([
        columnExists("study_plans", "department_id"),
        columnExists("study_plans", "program_id"),
        columnExists("study_plans", "plan_name"),
        columnExists("study_plans", "created_at"),
      ]);
      const planNameExpr = hasPlanNameColumn ? "sp.plan_name" : "sp.name";
      const departmentExpr = hasDepartmentColumn ? "sp.department_id" : "NULL";
      const programExpr = hasProgramColumn ? "sp.program_id" : "NULL";
      const createdAtExpr = hasCreatedAtColumn ? "sp.created_at" : "NULL";
      const departmentNameExpr = hasDepartmentColumn
        ? "d.department_name"
        : "NULL";
      const programNameExpr = hasProgramColumn ? "p.program_name" : "NULL";
      const deptJoin = hasDepartmentColumn
        ? "LEFT JOIN departments d ON sp.department_id = d.department_id"
        : "";
      const progJoin = hasProgramColumn
        ? "LEFT JOIN programs p ON sp.program_id = p.program_id"
        : "";
      const rows = await query(
        `SELECT sp.plan_id, ${planNameExpr} AS plan_name, ${departmentExpr} AS department_id, ${programExpr} AS program_id, ${createdAtExpr} AS created_at,
              ${departmentNameExpr} AS department_name, ${programNameExpr} AS program_name,
              COUNT(spc.id) AS courses_count
       FROM study_plans sp
        ${deptJoin}
       ${progJoin}
       LEFT JOIN study_plan_courses spc ON sp.plan_id = spc.plan_id
      GROUP BY sp.plan_id, ${planNameExpr}, ${departmentExpr}, ${programExpr}, ${createdAtExpr}, ${departmentNameExpr}, ${programNameExpr}
      ORDER BY sp.plan_name`,
      );
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error("Study-plans list error:", error);
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
      if (!(await tableExists("study_plans"))) {
        await query(`
          CREATE TABLE \`study_plans\` (
            \`plan_id\` int(11) NOT NULL AUTO_INCREMENT,
            \`name\` varchar(150) NOT NULL,
            \`department_id\` int(11) DEFAULT NULL,
            \`program_id\` int(11) DEFAULT NULL,
            \`created_at\` timestamp DEFAULT current_timestamp(),
            PRIMARY KEY (\`plan_id\`),
            KEY \`idx_sp_department\` (\`department_id\`),
            KEY \`idx_sp_program\` (\`program_id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }
      const [hasDepartmentColumn, hasProgramColumn] = await Promise.all([
        columnExists("study_plans", "department_id"),
        columnExists("study_plans", "program_id"),
      ]);
      const [departmentIsNullable, programIsNullable] = await Promise.all([
        hasDepartmentColumn
          ? isColumnNullable("study_plans", "department_id")
          : Promise.resolve(true),
        hasProgramColumn
          ? isColumnNullable("study_plans", "program_id")
          : Promise.resolve(true),
      ]);
      const hasPlanNameColumn = await columnExists("study_plans", "plan_name");
      const planNameColumn = hasPlanNameColumn ? "plan_name" : "name";
      const normalizeId = (value: any): string | null => {
        if (value === undefined || value === null) return null;
        const text = String(value).trim();
        return text.length ? text : null;
      };
      let safeDepartmentId: string | null = normalizeId(departmentId);
      let safeProgramId: string | null = normalizeId(programId);

      if (safeDepartmentId !== null) {
        const departmentRows = await query(
          "SELECT department_id FROM departments WHERE department_id = ? LIMIT 1",
          [safeDepartmentId],
        );
        if (!departmentRows.length) safeDepartmentId = null;
      }
      if (safeProgramId !== null) {
        const programRows = await query(
          "SELECT program_id FROM programs WHERE program_id = ? LIMIT 1",
          [safeProgramId],
        );
        if (!programRows.length) safeProgramId = null;
      }
      if (
        hasDepartmentColumn &&
        !departmentIsNullable &&
        safeDepartmentId === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid department is required for this study-plans schema.",
        });
      }
      if (hasProgramColumn && !programIsNullable && safeProgramId === null) {
        return res.status(400).json({
          success: false,
          message: "A valid program is required for this study-plans schema.",
        });
      }
      const columns = [planNameColumn];
      const placeholders = ["?"];
      const values: any[] = [planName];

      if (hasDepartmentColumn) {
        columns.push("department_id");
        placeholders.push("?");
        values.push(safeDepartmentId);
      }
      if (hasProgramColumn) {
        columns.push("program_id");
        placeholders.push("?");
        values.push(safeProgramId);
      }

      let insert: any;
      try {
        insert = await query(
          `INSERT INTO study_plans (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
          values,
        );
      } catch (insertError: any) {
        if (columns.length > 1) {
          try {
            const fallbackColumns = [planNameColumn];
            const fallbackPlaceholders = ["?"];
            const fallbackValues: any[] = [planName];
            if (hasDepartmentColumn) {
              fallbackColumns.push("department_id");
              fallbackPlaceholders.push("?");
              fallbackValues.push(null);
            }
            if (hasProgramColumn) {
              fallbackColumns.push("program_id");
              fallbackPlaceholders.push("?");
              fallbackValues.push(null);
            }
            insert = await query(
              `INSERT INTO study_plans (${fallbackColumns.join(", ")}) VALUES (${fallbackPlaceholders.join(", ")})`,
              fallbackValues,
            );
          } catch (fallbackInsertError: any) {
            console.error(
              "Create study plan fallback insert error:",
              fallbackInsertError,
            );
            return res.status(400).json({
              success: false,
              message:
                fallbackInsertError?.sqlMessage ||
                fallbackInsertError?.message ||
                "Unable to create study plan",
            });
          }
        } else {
          console.error("Create study plan primary insert error:", insertError);
          return res.status(400).json({
            success: false,
            message:
              insertError?.sqlMessage ||
              insertError?.message ||
              "Unable to create study plan",
          });
        }
      }
      return res
        .status(201)
        .json({ success: true, data: { planId: insert.insertId } });
    } catch (error) {
      console.error("Create study plan error:", error);
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
      const [hasDepartmentColumn, hasProgramColumn, hasPlanNameColumn] =
        await Promise.all([
          columnExists("study_plans", "department_id"),
          columnExists("study_plans", "program_id"),
          columnExists("study_plans", "plan_name"),
        ]);
      const planNameExpr = hasPlanNameColumn ? "sp.plan_name" : "sp.name";
      const departmentExpr = hasDepartmentColumn ? "sp.department_id" : "NULL";
      const programExpr = hasProgramColumn ? "sp.program_id" : "NULL";
      const departmentNameExpr = hasDepartmentColumn
        ? "d.department_name"
        : "NULL";
      const programNameExpr = hasProgramColumn ? "p.program_name" : "NULL";
      const deptJoin = hasDepartmentColumn
        ? "LEFT JOIN departments d ON sp.department_id = d.department_id"
        : "";
      const progJoin = hasProgramColumn
        ? "LEFT JOIN programs p ON sp.program_id = p.program_id"
        : "";
      const planRows = await query(
        `SELECT sp.plan_id, ${planNameExpr} AS plan_name, ${departmentExpr} AS department_id, ${programExpr} AS program_id, ${departmentNameExpr} AS department_name, ${programNameExpr} AS program_name
       FROM study_plans sp
        ${deptJoin}
       ${progJoin}
       WHERE sp.plan_id = ?`,
        [req.params.id],
      );
      if (!planRows.length)
        return res
          .status(404)
          .json({ success: false, message: "Plan not found" });

      const items = await query(
        `SELECT spc.id, spc.course_id, spc.year_no, spc.semester_no, spc.is_required, spc.course_bucket,
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
// GET /api/courses/study-plans/my-program — student-visible plans for same specialization/program
router.get(
  "/study-plans/my-program",
  verifyToken,
  requireRole("student"),
  async (req: Request, res: Response) => {
    try {
      const hasPlanNameColumn = await columnExists("study_plans", "plan_name");
      const planNameExpr = hasPlanNameColumn ? "plan_name" : "name";
      const studentRows = await query(
        `SELECT s.student_id, s.department_id, s.program_id, s.enrollment_year,
                p.program_name, d.department_name
         FROM students s
         LEFT JOIN programs p ON s.program_id = p.program_id
         LEFT JOIN departments d ON s.department_id = d.department_id
         WHERE s.user_id = ? LIMIT 1`,
        [req.user!.id],
      );
      if (!studentRows.length) {
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });
      }

      const student = studentRows[0];
      const plans = await query(
        `SELECT plan_id, ${planNameExpr} AS plan_name, department_id, program_id
         FROM study_plans
         WHERE (program_id = ?)
            OR (program_id IS NULL AND (department_id = ? OR department_id IS NULL))
         ORDER BY CASE WHEN program_id = ? THEN 0 ELSE 1 END, plan_id`,
        [
          student.program_id || 0,
          student.department_id || 0,
          student.program_id || 0,
        ],
      );

      if (!plans.length) {
        return res.json({
          success: true,
          data: {
            enrollmentYear: student.enrollment_year,
            programName: student.program_name,
            departmentName: student.department_name,
            semesters: [],
          },
        });
      }

      const planIds = plans.map((p: any) => Number(p.plan_id));
      const items = await query(
        `SELECT spc.plan_id, spc.course_id, spc.year_no, spc.semester_no, spc.is_required, spc.course_bucket,
                c.course_code, c.course_title, c.credits
         FROM study_plan_courses spc
         JOIN courses c ON c.course_id = spc.course_id
         WHERE spc.plan_id IN (${planIds.map(() => "?").join(",")})
         ORDER BY spc.year_no, spc.semester_no, c.course_code`,
        planIds,
      );

      const grouped = new Map<string, any[]>();
      items.forEach((item: any) => {
        const key = `${item.year_no}-${item.semester_no}`;
        const list = grouped.get(key) || [];
        list.push(item);
        grouped.set(key, list);
      });

      const semesters = Array.from(grouped.entries()).map(([key, list]) => {
        const [yearNo, semesterNo] = key.split("-").map(Number);
        return {
          yearNo,
          semesterNo,
          calendarYear:
            Number(student.enrollment_year || new Date().getFullYear()) +
            yearNo -
            1,
          courses: list.map((item: any) => ({
            courseId: item.course_id,
            code: item.course_code,
            name: item.course_title,
            credits: Number(item.credits || 0),
            bucket: item.course_bucket || "major",
          })),
        };
      });

      return res.json({
        success: true,
        data: {
          enrollmentYear: student.enrollment_year,
          programName: student.program_name,
          departmentName: student.department_name,
          planNames: plans.map((p: any) => p.name),
          semesters,
        },
      });
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
      const hasPlanNameColumn = await columnExists("study_plans", "plan_name");
      const planNameColumn = hasPlanNameColumn ? "plan_name" : "name";
      await query(
        `UPDATE study_plans SET ${planNameColumn} = ?, department_id = ?, program_id = ? WHERE plan_id = ?`,
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
        `INSERT INTO study_plan_courses (plan_id, course_id, year_no, semester_no, is_required, course_bucket)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE year_no = VALUES(year_no), semester_no = VALUES(semester_no), is_required = VALUES(is_required), course_bucket = VALUES(course_bucket)`,
        [
          req.params.id,
          courseId,
          yearNo,
          semesterNo,
          isRequired === false ? 0 : 1,
          String(req.body.courseBucket || "major"),
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
      const { yearNo, semesterNo, isRequired, courseBucket } = req.body;
      await query(
        "UPDATE study_plan_courses SET year_no = ?, semester_no = ?, is_required = ?, course_bucket = ? WHERE plan_id = ? AND course_id = ?",
        [
          yearNo,
          semesterNo,
          isRequired === false ? 0 : 1,
          String(req.body.courseBucket || "major"),
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
      const hasPlanNameColumn = await columnExists("study_plans", "plan_name");
      const planNameExpr = hasPlanNameColumn ? "sp.plan_name" : "sp.name";
      const rows = await query(
        `SELECT sp.plan_id, ${planNameExpr} AS plan_name, spc.year_no, spc.semester_no, spc.is_required
       FROM study_plan_courses spc
       JOIN study_plans sp ON spc.plan_id = sp.plan_id
       WHERE spc.course_id = ?
       ORDER BY  ${planNameExpr}, spc.year_no, spc.semester_no`,
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
