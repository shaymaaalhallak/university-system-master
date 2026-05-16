import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

const getStudentId = async (userId: number): Promise<number | null> => {
  const rows = await query("SELECT student_id FROM students WHERE user_id = ?", [userId]);
  return rows.length > 0 ? rows[0].student_id : null;
};

const getProfessorId = async (userId: number): Promise<number | null> => {
  const rows = await query("SELECT professor_id FROM professors WHERE user_id = ?", [userId]);
  return rows.length > 0 ? rows[0].professor_id : null;
};

// GET /api/schedule/my — Logged-in student or professor's weekly schedule
router.get("/my", verifyToken, async (req: Request, res: Response) => {
  try {
    let rows: any[] = [];

    if (req.user!.role === "student") {
      const studentId = await getStudentId(req.user!.id);
      if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });

      rows = await query(
        `SELECT cs.section_id,
                COALESCE(r.room_number, '') AS room_number,
                COALESCE((SELECT GROUP_CONCAT(CONCAT(LEFT(ss.day_of_week, 3), ' ', TIME_FORMAT(ss.start_time, '%H:%i'), '-', TIME_FORMAT(ss.end_time, '%H:%i')) SEPARATOR ', ') FROM section_schedule ss WHERE ss.section_id = cs.section_id), '') AS schedule_time,
                c.course_code, c.course_title, c.credits,
                u.first_name AS prof_first, u.last_name AS prof_last,
                cs.semester, cs.year
         FROM enrollments e
         JOIN course_sections cs ON e.section_id = cs.section_id
         JOIN courses c ON cs.course_id = c.course_id
         JOIN professors p ON cs.professor_id = p.professor_id
         JOIN users u ON p.user_id = u.user_id
         LEFT JOIN rooms r ON cs.room_id = r.room_id
         WHERE e.student_id = ? AND e.status = 'active'
         ORDER BY c.course_code`,
        [studentId]
      );
    } else if (req.user!.role === "professor") {
      const profId = await getProfessorId(req.user!.id);
      if (!profId) return res.status(404).json({ success: false, message: "Professor profile not found" });

      rows = await query(
        `SELECT cs.section_id,
                COALESCE(r.room_number, '') AS room_number,
                COALESCE((SELECT GROUP_CONCAT(CONCAT(LEFT(ss.day_of_week, 3), ' ', TIME_FORMAT(ss.start_time, '%H:%i'), '-', TIME_FORMAT(ss.end_time, '%H:%i')) SEPARATOR ', ') FROM section_schedule ss WHERE ss.section_id = cs.section_id), '') AS schedule_time,
                c.course_code, c.course_title, c.credits,
                cs.semester, cs.year,
                (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = cs.section_id AND e.status = 'active') AS enrolled_count
         FROM course_sections cs
         JOIN courses c ON cs.course_id = c.course_id
         LEFT JOIN rooms r ON cs.room_id = r.room_id
         WHERE cs.professor_id = ?
         ORDER BY c.course_code`,
        [profId]
      );
    } else {
      return res.status(403).json({ success: false, message: "Schedule is for students and professors only" });
    }

    // Parse schedule_time into structured days
    // Expected format: "Sun,Tue,Thu 09:00-10:30" or "Mon,Wed 14:00-15:30"
    const schedule = rows.map((row: any) => {
      let days: string[] = [];
      let timeSlot = row.schedule_time || "";

      const match = timeSlot.match(/^([A-Za-z,]+)\s+(.+)$/);
      if (match) {
        days = match[1].split(",").map((d: string) => d.trim());
        timeSlot = match[2];
      }

      return { ...row, days, timeSlot };
    });

    return res.json({ success: true, data: schedule });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
