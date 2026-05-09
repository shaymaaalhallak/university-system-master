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
const getExistingColumn = async (
  tableName: string,
  candidates: string[],
): Promise<string | null> => {
  for (const c of candidates) {
    if (await columnExists(tableName, c)) return c;
  }
  return null;
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
    console.log("[SECTIONS] Request received. User:", req.user?.id, "Role:", req.user?.role);
    const { semester, year, courseId, professorId } = req.query;
    const hasGradeEntryControl = await tableExists("grade_entry_control");
    const gradeJoin = hasGradeEntryControl
      ? "LEFT JOIN grade_entry_control gec ON gec.section_id = cs.section_id"
      : "";
    const gradeEnabledExpr = hasGradeEntryControl
      ? "gec.is_enabled AS grade_entry_enabled"
      : "0 AS grade_entry_enabled";
    let sql = `
      SELECT cs.section_id, cs.course_id, cs.professor_id, cs.semester, cs.year,
             cs.room_number, cs.schedule_time,
             c.course_code, c.course_title, c.credits,
             u.first_name, u.last_name,
             (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = cs.section_id AND e.status = 'active') AS enrolled_count,
             ${gradeEnabledExpr}
      FROM course_sections cs
      JOIN courses c ON cs.course_id = c.course_id
      JOIN professors p ON cs.professor_id = p.professor_id
      JOIN users u ON p.user_id = u.user_id
      ${gradeJoin}
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
      console.log("[SECTIONS] Student program_id=", student.program_id, "department_id=", student.department_id, "semester=", student.semester);

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

      const allCourseIds = new Set<number>();

      if (hasStudyPlans && hasStudyPlanCourses) {
        // 1. Get courses from student's PROGRAM-SPECIFIC plans
        if (hasProgramColumn && student.program_id) {
          const programPlans = await query(
            `SELECT plan_id FROM study_plans WHERE program_id = ?`,
            [Number(student.program_id)],
          );
          console.log("[SECTIONS] Program-specific plans:", programPlans);
          if (programPlans.length > 0) {
            const planIds = programPlans.map((p: any) => p.plan_id);
            const ph = planIds.map(() => "?").join(",");
            const programCourses = await query(
              `SELECT DISTINCT course_id FROM study_plan_courses WHERE plan_id IN (${ph})`,
              planIds,
            );
            programCourses.forEach((c: any) => allCourseIds.add(Number(c.course_id)));
          }
        }

        // 2. Get courses from department-common plans (department_id matches, program_id IS NULL)
        if (hasDepartmentColumn && student.department_id) {
          const deptPlans = await query(
            `SELECT plan_id FROM study_plans WHERE program_id IS NULL AND department_id = ?`,
            [Number(student.department_id)],
          );
          console.log("[SECTIONS] Department-common plans:", deptPlans);
          if (deptPlans.length > 0) {
            const planIds = deptPlans.map((p: any) => p.plan_id);
            const ph = planIds.map(() => "?").join(",");
            const deptCourses = await query(
              `SELECT DISTINCT course_id FROM study_plan_courses WHERE plan_id IN (${ph})`,
              planIds,
            );
            deptCourses.forEach((c: any) => allCourseIds.add(Number(c.course_id)));
          }
        }

        // 3. Get courses from UNIVERSAL common plans (program_id IS NULL AND department_id IS NULL)
        const universalPlans = await query(
          `SELECT plan_id FROM study_plans WHERE program_id IS NULL AND department_id IS NULL`,
          [],
        );
        console.log("[SECTIONS] Universal common plans:", universalPlans);
        if (universalPlans.length > 0) {
          const planIds = universalPlans.map((p: any) => p.plan_id);
          const ph = planIds.map(() => "?").join(",");
          const universalCourses = await query(
            `SELECT DISTINCT course_id FROM study_plan_courses WHERE plan_id IN (${ph})`,
            planIds,
          );
          universalCourses.forEach((c: any) => allCourseIds.add(Number(c.course_id)));
          console.log("[SECTIONS] Universal common course IDs:", Array.from(allCourseIds));
        }

        // 4. ALWAYS add courses from the courses table that are common to this department
        //    (courses where program_id IS NULL but department_id matches student's department)
        //    This catches common courses that may not be in any study plan
        const directCommonCourses = await query(
          `SELECT course_id FROM courses WHERE department_id = ? AND program_id IS NULL`,
          [Number(student.department_id)],
        );
        console.log("[SECTIONS] Direct common courses (dept match, no program):", directCommonCourses.length);
        directCommonCourses.forEach((c: any) => allCourseIds.add(Number(c.course_id)));
      }

      // Apply the combined filter
      if (allCourseIds.size > 0) {
        const ids = Array.from(allCourseIds);
        const ph = ids.map(() => "?").join(",");
        sql += ` AND cs.course_id IN (${ph})`;
        params.push(...ids);
        appliedStudyPlanFilter = true;
        console.log("[SECTIONS] Total allowed course IDs for student:", ids);
      } else {
        // Fallback: filter by program/department on the courses table itself
        const courseFilterParts: string[] = [];
        const courseFilterParams: any[] = [];

        if (student.program_id) {
          courseFilterParts.push("c.program_id = ?");
          courseFilterParams.push(Number(student.program_id));
        }
        if (student.department_id) {
          courseFilterParts.push("(c.department_id = ? AND c.program_id IS NULL)");
          courseFilterParams.push(Number(student.department_id));
        }

        if (courseFilterParts.length > 0) {
          sql += ` AND (${courseFilterParts.join(" OR ")})`;
          params.push(...courseFilterParams);
          appliedStudyPlanFilter = true;
          console.log("[SECTIONS] Applied program/department fallback filter");
        }
      }
    }

    sql += " ORDER BY cs.year DESC, cs.semester";

    let sections = await query(sql, params);
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
        hasStudyPlanCourses,
      ] = await Promise.all([
        columnExists("study_plans", "department_id"),
        columnExists("study_plans", "program_id"),
        columnExists("study_plans", "plan_name"),
        columnExists("study_plans", "created_at"),
        tableExists("study_plan_courses"),
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
      const coursesJoin = hasStudyPlanCourses
        ? "LEFT JOIN study_plan_courses spc ON sp.plan_id = spc.plan_id"
        : "";
      const coursesCountExpr = hasStudyPlanCourses ? "COUNT(spc.id)" : "0";
      const rows = await query(
        `SELECT sp.plan_id, ${planNameExpr} AS plan_name, ${departmentExpr} AS department_id, ${programExpr} AS program_id, ${createdAtExpr} AS created_at,
              ${departmentNameExpr} AS department_name, ${programNameExpr} AS program_name,
              ${coursesCountExpr} AS courses_count
       FROM study_plans sp
       
      ${deptJoin}
       ${progJoin}
       ${coursesJoin}
       GROUP BY sp.plan_id, ${planNameExpr}, ${departmentExpr}, ${programExpr}, ${createdAtExpr}, ${departmentNameExpr}, ${programNameExpr}
       ORDER BY ${planNameExpr}`,
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
            \`plan_name\` varchar(150) NOT NULL,
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
      console.log("[MY-PLAN] Student: program_id=", student.program_id, "department_id=", student.department_id);

      const conditions: string[] = [];
      const params: any[] = [];

      if (student.program_id) {
        conditions.push("program_id = ?");
        params.push(Number(student.program_id));
      }
      if (student.department_id) {
        conditions.push("(program_id IS NULL AND department_id = ?)");
        params.push(Number(student.department_id));
      }
      conditions.push("(program_id IS NULL AND department_id IS NULL)");

      console.log("[MY-PLAN] Conditions:", conditions.join(" OR "));
      console.log("[MY-PLAN] Params:", params);

      const plans = await query(
        `SELECT plan_id, ${planNameExpr} AS plan_name, department_id, program_id
         FROM study_plans
         WHERE ${conditions.join(" OR ")}`,
        params,
      );
      console.log("[MY-PLAN] Found plans:", plans);

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
      const hasIsFlexible = await columnExists(
        "study_plan_courses",
        "is_flexible",
      );
      const yearColumn = await getExistingColumn("study_plan_courses", ["year_no", "year"]) || "year_no";
      const semesterColumn = await getExistingColumn("study_plan_courses", ["semester_no", "semester"]) || "semester_no";

      const items = await query(
        `SELECT spc.plan_id, spc.course_id, spc.${yearColumn} AS year_no, spc.${semesterColumn} AS semester_no, spc.is_required, spc.course_bucket,
                c.course_code, c.course_title, c.credits
         ${hasIsFlexible ? ", spc.is_flexible" : ", 0 AS is_flexible"}
         FROM study_plan_courses spc
         JOIN courses c ON c.course_id = spc.course_id
         WHERE spc.plan_id IN (${planIds.map(() => "?").join(",")})
         ORDER BY spc.${yearColumn}, spc.${semesterColumn}, c.course_code`,
        planIds,
      );

      for (const item of items) {
        const prereqs = await query(
          `SELECT c.course_code, c.course_title
           FROM prerequisites p
           JOIN courses c ON p.required_course_id = c.course_id
           WHERE p.course_id = ?`,
          [item.course_id],
        );
        item.prerequisites = prereqs;
      }

      const grouped = new Map<string, any[]>();
      items.forEach((item: any) => {
        const key = item.is_flexible
          ? `0-0`
          : `${item.year_no}-${item.semester_no}`;
        const list = grouped.get(key) || [];
        list.push(item);
        grouped.set(key, list);
      });

      const semesters = Array.from(grouped.entries()).map(([key, list]) => {
        const [yearNo, semesterNo] = key.split("-").map(Number);
        return {
          yearNo,
          semesterNo,
          calendarYear: yearNo === 0 ? null :
            Number(student.enrollment_year || new Date().getFullYear()) +
            yearNo -
            1,
          isFlexible: yearNo === 0 && semesterNo === 0,
          courses: list.map((item: any) => ({
            courseId: item.course_id,
            code: item.course_code,
            name: item.course_title,
            credits: Number(item.credits || 0),
            bucket: item.course_bucket || "major",
            prerequisites: item.prerequisites || [],
          })),
        };
      });

      return res.json({
        success: true,
        data: {
          enrollmentYear: student.enrollment_year,
          programName: student.program_name,
          departmentName: student.department_name,
          planNames: plans.map((p: any) => p.plan_name),
          semesters,
        },
      });
    } catch (error) {
      console.error("[MY-PLAN] Error:", error);
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
      const planIdColumn =
        (await getExistingColumn("study_plans", ["plan_id", "id"])) ||
        "plan_id";
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
        `SELECT sp.${planIdColumn} AS plan_id, ${planNameExpr} AS plan_name, ${departmentExpr} AS department_id, ${programExpr} AS program_id, ${departmentNameExpr} AS department_name, ${programNameExpr} AS program_name
       FROM study_plans sp
        ${deptJoin}
       ${progJoin}
       WHERE sp.${planIdColumn} = ?`,
        [req.params.id],
      );
      if (!planRows.length)
        return res
          .status(404)
          .json({ success: false, message: "Plan not found" });

      let items: any[] = [];
      if (await tableExists("study_plan_courses")) {
        const spcPlanIdColumn = await getExistingColumn("study_plan_courses", [
          "plan_id",
          "study_plan_id",
        ]);
        const yearColumn = await getExistingColumn("study_plan_courses", [
          "year_no",
          "year",
        ]);
        const semesterColumn = await getExistingColumn("study_plan_courses", [
          "semester_no",
          "semester",
        ]);
        if (!spcPlanIdColumn || !yearColumn || !semesterColumn) {
          return res.json({
            success: true,
            data: { ...planRows[0], items: [] },
          });
        }
        const hasCourseBucket = await columnExists(
          "study_plan_courses",
          "course_bucket",
        );
        const hasIsFlexible = await columnExists(
          "study_plan_courses",
          "is_flexible",
        );
        items = await query(
          `SELECT spc.id, spc.course_id, spc.${yearColumn} AS year_no, spc.${semesterColumn} AS semester_no, spc.is_required, ${
            hasCourseBucket ? "spc.course_bucket" : "'major' AS course_bucket"
          }, ${
            hasIsFlexible ? "spc.is_flexible" : "0 AS is_flexible"
          },
                c.course_code, c.course_title, c.credits
           FROM study_plan_courses spc
           JOIN courses c ON spc.course_id = c.course_id
           WHERE spc.${spcPlanIdColumn} = ?
           ORDER BY spc.${yearColumn} ASC, spc.${semesterColumn} ASC, c.course_code ASC`,
          [req.params.id],
        );

        for (const item of items) {
          const prereqs = await query(
            `SELECT c.course_code, c.course_title
             FROM prerequisites p
             JOIN courses c ON p.required_course_id = c.course_id
             WHERE p.course_id = ?`,
            [item.course_id],
          );
          item.prerequisites = prereqs;
        }
      }

      return res.json({ success: true, data: { ...planRows[0], items } });

      return res.json({ success: true, data: { ...planRows[0], items } });
    } catch (error) {
      console.error("Study-plan details error:", error);
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
      const planIdColumn =
        (await getExistingColumn("study_plan_courses", [
          "plan_id",
          "study_plan_id",
        ])) || "plan_id";
      const yearColumn =
        (await getExistingColumn("study_plan_courses", ["year_no", "year"])) ||
        "year_no";
      const semesterColumn =
        (await getExistingColumn("study_plan_courses", [
          "semester_no",
          "semester",
        ])) || "semester_no";
      const hasIsRequired = await columnExists(
        "study_plan_courses",
        "is_required",
      );
      const hasCourseBucket = await columnExists(
        "study_plan_courses",
        "course_bucket",
      );
      const hasIsFlexible = await columnExists(
        "study_plan_courses",
        "is_flexible",
      );
      const existing = await query(
        `SELECT id FROM study_plan_courses WHERE ${planIdColumn} = ? AND course_id = ? LIMIT 1`,
        [req.params.id, courseId],
      );
      if (existing.length) {
        const sets = [`${yearColumn} = ?`, `${semesterColumn} = ?`];
        const params: any[] = [yearNo, semesterNo];
        if (hasIsRequired) {
          sets.push("is_required = ?");
          params.push(isRequired === false ? 0 : 1);
        }
        if (hasCourseBucket) {
          sets.push("course_bucket = ?");
          params.push(String(req.body.courseBucket || "major"));
        }
        if (hasIsFlexible) {
          sets.push("is_flexible = ?");
          params.push(req.body.isFlexible === true ? 1 : 0);
        }
        params.push(req.params.id, courseId);
        await query(
          `UPDATE study_plan_courses SET ${sets.join(", ")} WHERE ${planIdColumn} = ? AND course_id = ?`,
          params,
        );
      } else {
        const cols = [planIdColumn, "course_id", yearColumn, semesterColumn];
        const qs = ["?", "?", "?", "?"];
        const params: any[] = [req.params.id, courseId, yearNo, semesterNo];
        if (hasIsRequired) {
          cols.push("is_required");
          qs.push("?");
          params.push(isRequired === false ? 0 : 1);
        }
        if (hasCourseBucket) {
          cols.push("course_bucket");
          qs.push("?");
          params.push(String(req.body.courseBucket || "major"));
        }
        if (hasIsFlexible) {
          cols.push("is_flexible");
          qs.push("?");
          params.push(req.body.isFlexible === true ? 1 : 0);
        }
        await query(
          `INSERT INTO study_plan_courses (${cols.join(", ")}) VALUES (${qs.join(", ")})`,
          params,
        );
      }
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
          String(courseBucket || "major"),
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
      console.log("[STUDY-PLAN-USAGE] Request for course_id:", req.params.id, "by user:", req.user?.id, "role:", req.user?.role);
      const hasPlanNameColumn = await columnExists("study_plans", "plan_name");
      const planNameExpr = hasPlanNameColumn ? "sp.plan_name" : "sp.name";
      const hasIsFlexible = await columnExists(
        "study_plan_courses",
        "is_flexible",
      );
      const hasCourseBucket = await columnExists(
        "study_plan_courses",
        "course_bucket",
      );
      const yearCol = await getExistingColumn("study_plan_courses", ["year_no", "year"]) || "year_no";
      const semesterCol = await getExistingColumn("study_plan_courses", ["semester_no", "semester"]) || "semester_no";
      const rows = await query(
        `SELECT sp.plan_id, ${planNameExpr} AS plan_name, spc.${yearCol} AS year_no, spc.${semesterCol} AS semester_no, spc.is_required,
         ${hasIsFlexible ? "spc.is_flexible" : "0 AS is_flexible"},
         ${hasCourseBucket ? "spc.course_bucket" : "'major' AS course_bucket"},
         sp.program_id, sp.department_id
        FROM study_plan_courses spc
        JOIN study_plans sp ON spc.plan_id = sp.plan_id
        WHERE spc.course_id = ?
          ORDER BY ${planNameExpr}, spc.${yearCol}, spc.${semesterCol}`,
        [req.params.id],
      );
      console.log("[STUDY-PLAN-USAGE] Found rows:", rows.length);
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error("[STUDY-PLAN-USAGE] Error:", error);
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
        "INSERT INTO grade_entry_control (section_id, is_enabled, entry_mode) VALUES (?, 0, 'exam')",
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
