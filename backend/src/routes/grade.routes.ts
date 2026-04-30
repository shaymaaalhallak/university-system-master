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

const getStudentId = async (userId: number): Promise<number | null> => {
  const rows = await query(
    "SELECT student_id FROM students WHERE user_id = ?",
    [userId],
  );
  return rows.length > 0 ? rows[0].student_id : null;
};

const getProfessorId = async (userId: number): Promise<number | null> => {
  const rows = await query(
    "SELECT professor_id FROM professors WHERE user_id = ?",
    [userId],
  );
  return rows.length > 0 ? rows[0].professor_id : null;
};

type GradeComponent = {
  component_id: number;
  section_id: number;
  component_name: string;
  weight: number;
  display_order: number;
};

const scoreToLetter = (score: number): string => {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 60) return "D";
  return "F";
};

const letterToPoints = (letter: string): number => {
  const map: Record<string, number> = {
    "A+": 4.0,
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    "D+": 1.3,
    D: 1.0,
    "D-": 0.7,
    F: 0.0,
  };
  return map[letter?.trim().toUpperCase()] ?? 0.0;
};

const ensureProfessorCanAccessSection = async (
  userId: number,
  sectionId: number | string,
) => {
  const professorId = await getProfessorId(userId);
  if (!professorId) return false;

  const rows = await query(
    "SELECT section_id FROM course_sections WHERE section_id = ? AND professor_id = ?",
    [sectionId, professorId],
  );

  return rows.length > 0;
};

const getSectionComponents = async (
  sectionId: number | string,
): Promise<GradeComponent[]> => {
  const rows = await query(
    `SELECT component_id, section_id, component_name, weight, display_order
     FROM grade_components
     WHERE section_id = ?
     ORDER BY display_order, component_id`,
    [sectionId],
  );

  return rows.map((row: any) => ({
    component_id: Number(row.component_id),
    section_id: Number(row.section_id),
    component_name: row.component_name,
    weight: Number(row.weight),
    display_order: Number(row.display_order),
  }));
};

const validateComponents = (
  components: Array<{ name: string; weight: number }>,
) => {
  if (!Array.isArray(components) || components.length === 0) {
    return "Add at least one grade component.";
  }

  const normalized = components.map((component) => ({
    name: String(component.name || "").trim(),
    weight: Number(component.weight),
  }));

  if (normalized.some((component) => !component.name)) {
    return "Each grade component must have a name.";
  }

  if (
    normalized.some(
      (component) => !Number.isFinite(component.weight) || component.weight < 0,
    )
  ) {
    return "Each grade component must have a valid weight.";
  }

  const total = normalized.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  if (total !== 100) {
    return "All component weights together must equal 100.";
  }

  return null;
};

const syncLegacyGradeControlFields = async (
  sectionId: number | string,
  userId: number,
  components: GradeComponent[],
) => {
  const first = components[0] ?? { component_name: "Assignments", weight: 0 };
  const second = components[1] ?? { component_name: "Midterm", weight: 0 };
  const third = components[2] ?? { component_name: "Final Exam", weight: 0 };

  await query(
    `INSERT INTO grade_entry_control
       (section_id, is_enabled, assignment_label, midterm_label, final_label,
        assignment_weight, midterm_weight, final_weight, enabled_by)
     VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       is_enabled = is_enabled,
       assignment_label = VALUES(assignment_label),
       midterm_label = VALUES(midterm_label),
       final_label = VALUES(final_label),
       assignment_weight = VALUES(assignment_weight),
       midterm_weight = VALUES(midterm_weight),
       final_weight = VALUES(final_weight),
       enabled_by = VALUES(enabled_by)`,
    [
      sectionId,
      first.component_name,
      second.component_name,
      third.component_name,
      first.weight,
      second.weight,
      third.weight,
      userId,
    ],
  );
};

const calculateAndUpdateGPA = async (studentId: number) => {
  const gradeRows = await query(
    `SELECT g.letter_grade, c.credits, cs.semester, cs.year
     FROM grades g
     JOIN course_sections cs ON g.section_id = cs.section_id
     JOIN courses c ON cs.course_id = c.course_id
     WHERE g.student_id = ? AND g.letter_grade IS NOT NULL AND g.letter_grade != ''`,
    [studentId],
  );

  if (gradeRows.length === 0) {
    await query("UPDATE students SET gpa = ? WHERE student_id = ?", [
      "0.00",
      studentId,
    ]);
    return {
      gpa: "0.00",
      totalCredits: 0,
      semesterGPA: {},
      standing: "",
      canGraduate: false,
    };
  }

  let totalWeightedPoints = 0;
  let totalCredits = 0;
  const semesterMap: Record<string, { weighted: number; credits: number }> = {};

  for (const row of gradeRows) {
    const points = letterToPoints(row.letter_grade);
    const credits = Number(row.credits);
    totalWeightedPoints += points * credits;
    totalCredits += credits;

    const key = `${row.year} ${row.semester}`;
    if (!semesterMap[key]) semesterMap[key] = { weighted: 0, credits: 0 };
    semesterMap[key].weighted += points * credits;
    semesterMap[key].credits += credits;
  }

  const cumulativeGPA =
    totalCredits > 0 ? (totalWeightedPoints / totalCredits).toFixed(2) : "0.00";
  const semesterGPA: Record<string, string> = {};
  for (const [key, val] of Object.entries(semesterMap)) {
    semesterGPA[key] =
      val.credits > 0 ? (val.weighted / val.credits).toFixed(2) : "0.00";
  }

  const gpaNum = Number(cumulativeGPA);
  let standing = "";
  if (gpaNum >= 3.5) standing = "Excellent";
  else if (gpaNum >= 3.0) standing = "Very Good";
  else if (gpaNum >= 2.5) standing = "Good";
  else if (gpaNum >= 2.0) standing = "Pass";
  else standing = "Below graduation threshold";

  await query("UPDATE students SET gpa = ? WHERE student_id = ?", [
    cumulativeGPA,
    studentId,
  ]);

  return {
    gpa: cumulativeGPA,
    totalCredits,
    semesterGPA,
    standing,
    canGraduate: gpaNum >= 2.0,
  };
};

const buildStudentGradeRecords = async (studentId: number) => {
  const grades = await query(
    `SELECT g.grade_id AS id, g.section_id, g.total_score, g.letter_grade,
            c.course_id, c.course_code, c.course_title, c.credits,
            cs.semester, cs.year
     FROM grades g
     JOIN course_sections cs ON g.section_id = cs.section_id
     JOIN courses c ON cs.course_id = c.course_id
     WHERE g.student_id = ?
     ORDER BY cs.year DESC, cs.semester`,
    [studentId],
  );

  const componentScores = await query(
    `SELECT g.grade_id, gc.component_id, gc.component_name, gc.weight, gc.display_order, gcs.score
     FROM grades g
     JOIN grade_component_scores gcs ON g.grade_id = gcs.grade_id
     JOIN grade_components gc ON gcs.component_id = gc.component_id
     WHERE g.student_id = ?
     ORDER BY gc.display_order, gc.component_id`,
    [studentId],
  );

  const byGradeId = new Map<number, any[]>();
  componentScores.forEach((row: any) => {
    const key = Number(row.grade_id);
    const list = byGradeId.get(key) ?? [];
    list.push({
      componentId: Number(row.component_id),
      name: row.component_name,
      weight: Number(row.weight),
      score: Number(row.score),
      order: Number(row.display_order),
    });
    byGradeId.set(key, list);
  });

  return grades.map((grade: any) => ({
    ...grade,
    components: byGradeId.get(Number(grade.id)) ?? [],
  }));
};

router.get(
  "/my",
  verifyToken,
  requireRole("student"),
  async (req: Request, res: Response) => {
    try {
      const studentId = await getStudentId(req.user!.id);
      if (!studentId)
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });

      return res.json({
        success: true,
        data: await buildStudentGradeRecords(studentId),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

router.get(
  "/my-gpa",
  verifyToken,
  requireRole("student"),
  async (req: Request, res: Response) => {
    try {
      const studentId = await getStudentId(req.user!.id);
      if (!studentId)
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });

      return res.json({
        success: true,
        data: await calculateAndUpdateGPA(studentId),
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

router.get(
  "/:studentId/gpa",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const requestedId = Number(req.params.studentId);

      if (req.user!.role === "student") {
        const studentId = await getStudentId(req.user!.id);
        if (studentId !== requestedId) {
          return res
            .status(403)
            .json({ success: false, message: "Access denied" });
        }
      }

      return res.json({
        success: true,
        data: await calculateAndUpdateGPA(requestedId),
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

router.get(
  "/section/:sectionId/setup",
  verifyToken,
  requireRole("professor", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { sectionId } = req.params;

      if (req.user!.role === "professor") {
        const allowed = await ensureProfessorCanAccessSection(
          req.user!.id,
          sectionId,
        );
        if (!allowed) {
          return res
            .status(403)
            .json({ success: false, message: "You do not teach this section" });
        }
      }

      const sectionRows = await query(
        `SELECT cs.section_id, cs.course_id, cs.semester, cs.year, cs.room_number, cs.schedule_time,
              c.course_code, c.course_title
       FROM course_sections cs
       JOIN courses c ON cs.course_id = c.course_id
       WHERE cs.section_id = ?`,
        [sectionId],
      );

      if (sectionRows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Section not found" });
      }

      const components = await getSectionComponents(sectionId);
      const students = await query(
        `SELECT s.student_id, u.first_name, u.last_name, u.email,
              g.grade_id, g.total_score, g.letter_grade
       FROM (
         SELECT student_id, section_id, MAX(enrollment_id) AS latest_enrollment_id
         FROM enrollments
         WHERE section_id = ? AND status = 'active'
         GROUP BY student_id, section_id
       ) active_enrollments
       JOIN enrollments e ON e.enrollment_id = active_enrollments.latest_enrollment_id
       JOIN students s ON e.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       LEFT JOIN (
         SELECT g1.*
         FROM grades g1
         INNER JOIN (
           SELECT student_id, section_id, MAX(grade_id) AS latest_grade_id
           FROM grades
           GROUP BY student_id, section_id
         ) latest_grade
           ON latest_grade.latest_grade_id = g1.grade_id
       ) g ON g.student_id = s.student_id AND g.section_id = e.section_id
       WHERE e.section_id = ? AND e.status = 'active'
       ORDER BY u.last_name, u.first_name`,
        [sectionId, sectionId],
      );

      const componentScores = await query(
        `SELECT g.student_id, gcs.component_id, gcs.score
       FROM grades g
       JOIN grade_component_scores gcs ON g.grade_id = gcs.grade_id
       WHERE g.section_id = ?`,
        [sectionId],
      );

      const scoreMap = new Map<string, number>();
      componentScores.forEach((row: any) => {
        scoreMap.set(
          `${row.student_id}:${row.component_id}`,
          Number(row.score),
        );
      });

      const studentRows = students.map((student: any) => ({
        ...student,
        componentScores: Object.fromEntries(
          components.map((component) => [
            String(component.component_id),
            scoreMap.get(`${student.student_id}:${component.component_id}`) ??
              0,
          ]),
        ),
      }));

      return res.json({
        success: true,
        data: {
          section: sectionRows[0],
          components: components.map((component) => ({
            componentId: component.component_id,
            name: component.component_name,
            weight: component.weight,
            order: component.display_order,
          })),
          students: studentRows,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

router.put(
  "/section/:sectionId/setup",
  verifyToken,
  requireRole("professor", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { sectionId } = req.params;

      if (req.user!.role === "professor") {
        const allowed = await ensureProfessorCanAccessSection(
          req.user!.id,
          sectionId,
        );
        if (!allowed) {
          return res
            .status(403)
            .json({ success: false, message: "You do not teach this section" });
        }
      }

      const components = (req.body.components ?? []).map(
        (component: any, index: number) => ({
          name: String(component.name || "").trim(),
          weight: Number(component.weight),
          order: Number.isFinite(Number(component.order))
            ? Number(component.order)
            : index + 1,
        }),
      );

      const validationError = validateComponents(components);
      if (validationError) {
        return res
          .status(400)
          .json({ success: false, message: validationError });
      }

      const existingGrades = await query(
        "SELECT grade_id FROM grades WHERE section_id = ?",
        [sectionId],
      );
      if (existingGrades.length > 0) {
        await query(
          `DELETE gcs FROM grade_component_scores gcs
         JOIN grades g ON gcs.grade_id = g.grade_id
         WHERE g.section_id = ?`,
          [sectionId],
        );
      }

      await query("DELETE FROM grade_components WHERE section_id = ?", [
        sectionId,
      ]);

      for (const component of components) {
        await query(
          `INSERT INTO grade_components (section_id, component_name, weight, display_order)
         VALUES (?, ?, ?, ?)`,
          [sectionId, component.name, component.weight, component.order],
        );
      }

      const savedComponents = await getSectionComponents(sectionId);
      await syncLegacyGradeControlFields(
        sectionId,
        req.user!.id,
        savedComponents,
      );

      return res.json({
        success: true,
        message: "Grade structure saved successfully",
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

router.get(
  "/",
  verifyToken,
  requireRole("admin", "professor"),
  async (req: Request, res: Response) => {
    try {
      const { studentId, sectionId } = req.query;
      let sql = `
      SELECT g.grade_id, g.student_id, g.section_id, g.total_score, g.letter_grade,
             u.first_name, u.last_name,
             c.course_code, c.course_title, c.credits,
             cs.semester, cs.year
      FROM grades g
      JOIN students s ON g.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      JOIN course_sections cs ON g.section_id = cs.section_id
      JOIN courses c ON cs.course_id = c.course_id
      WHERE 1=1
    `;
      const params: any[] = [];

      if (studentId) {
        sql += " AND g.student_id = ?";
        params.push(studentId);
      }
      if (sectionId) {
        sql += " AND g.section_id = ?";
        params.push(sectionId);
      }

      if (req.user!.role === "professor") {
        const professorId = await getProfessorId(req.user!.id);
        if (!professorId) {
          return res
            .status(404)
            .json({ success: false, message: "Professor profile not found" });
        }

        sql += " AND cs.professor_id = ?";
        params.push(professorId);
      }

      sql += " ORDER BY u.last_name, cs.year DESC";

      const gradeRows = await query(sql, params);
      const gradeIds = gradeRows.map((row: any) => Number(row.grade_id));

      let componentRows: any[] = [];
      if (gradeIds.length > 0) {
        componentRows = await query(
          `SELECT gcs.grade_id, gc.component_id, gc.component_name, gc.weight, gc.display_order, gcs.score
         FROM grade_component_scores gcs
         JOIN grade_components gc ON gcs.component_id = gc.component_id
         WHERE gcs.grade_id IN (${gradeIds.map(() => "?").join(",")})
         ORDER BY gc.display_order, gc.component_id`,
          gradeIds,
        );
      }

      const byGrade = new Map<number, any[]>();
      componentRows.forEach((row: any) => {
        const key = Number(row.grade_id);
        const list = byGrade.get(key) ?? [];
        list.push({
          componentId: Number(row.component_id),
          name: row.component_name,
          weight: Number(row.weight),
          score: Number(row.score),
          order: Number(row.display_order),
        });
        byGrade.set(key, list);
      });

      return res.json({
        success: true,
        data: gradeRows.map((row: any) => ({
          ...row,
          components: byGrade.get(Number(row.grade_id)) ?? [],
        })),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

router.post(
  "/",
  verifyToken,
  requireRole("professor", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { studentId, sectionId, componentScores } = req.body;

      if (!studentId || !sectionId) {
        return res.status(400).json({
          success: false,
          message: "studentId and sectionId are required",
        });
      }

      if (req.user!.role === "professor") {
        const allowed = await ensureProfessorCanAccessSection(
          req.user!.id,
          sectionId,
        );
        if (!allowed) {
          return res
            .status(403)
            .json({ success: false, message: "You do not teach this section" });
        }
        const entryControlRows = await query(
          "SELECT COALESCE(is_enabled, 0) AS is_enabled FROM grade_entry_control WHERE section_id = ? LIMIT 1",
          [sectionId],
        );
        const isEnabled = Number(entryControlRows[0]?.is_enabled ?? 0) === 1;
        if (!isEnabled) {
          return res.status(403).json({
            success: false,
            message:
              "Grade entry is closed for this section. Ask an admin to open it.",
          });
        }
      }

      const components = await getSectionComponents(sectionId);
      if (components.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Define the grade structure for this section first",
        });
      }

      const totalWeight = components.reduce(
        (sum, component) => sum + Number(component.weight),
        0,
      );
      if (totalWeight !== 100) {
        return res.status(400).json({
          success: false,
          message:
            "This section's grade structure is invalid. Total weight must equal 100.",
        });
      }

      const studentEnrollment = await query(
        "SELECT enrollment_id FROM enrollments WHERE student_id = ? AND section_id = ? AND status = 'active'",
        [studentId, sectionId],
      );
      if (studentEnrollment.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Student is not enrolled in this section",
        });
      }

      const scoreMap = new Map<number, number>();
      (Array.isArray(componentScores) ? componentScores : []).forEach(
        (entry: any) => {
          const componentId = Number(entry.componentId);
          const score = Math.max(0, Math.min(100, Number(entry.score) || 0));
          if (componentId) scoreMap.set(componentId, score);
        },
      );

      const weightedTotal = components.reduce((sum, component) => {
        const score = scoreMap.get(component.component_id) ?? 0;
        return sum + score * (component.weight / 100);
      }, 0);

      const totalScore = Math.round(weightedTotal);
      const letterGrade = scoreToLetter(totalScore);

      const legacyScores = components
        .slice(0, 3)
        .map((component) => scoreMap.get(component.component_id) ?? 0);
      while (legacyScores.length < 3) legacyScores.push(0);

      const existingGradeRows = await query(
        `SELECT grade_id
       FROM grades
       WHERE student_id = ? AND section_id = ?
       ORDER BY grade_id DESC
       LIMIT 1`,
        [studentId, sectionId],
      );

      let gradeId = Number(existingGradeRows[0]?.grade_id ?? 0);
      if (gradeId) {
        await query(
          `UPDATE grades
         SET assignment_score = ?, midterm_score = ?, final_score = ?, total_score = ?, letter_grade = ?
         WHERE grade_id = ?`,
          [
            legacyScores[0],
            legacyScores[1],
            legacyScores[2],
            totalScore,
            letterGrade,
            gradeId,
          ],
        );
      } else {
        const gradeResult: any = await query(
          `INSERT INTO grades (student_id, section_id, assignment_score, midterm_score, final_score, total_score, letter_grade)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            studentId,
            sectionId,
            legacyScores[0],
            legacyScores[1],
            legacyScores[2],
            totalScore,
            letterGrade,
          ],
        );
        gradeId = Number(gradeResult.insertId || 0);
      }

      for (const component of components) {
        const score = scoreMap.get(component.component_id) ?? 0;
        await query(
          `INSERT INTO grade_component_scores (grade_id, component_id, score)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score)`,
          [gradeId, component.component_id, score],
        );
      }

      await calculateAndUpdateGPA(Number(studentId));

      return res.json({
        success: true,
        message: "Grades saved",
        data: {
          totalScore,
          letterGrade,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

export default router;
