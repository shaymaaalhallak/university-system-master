const mysql = require("mysql2");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const http = require("http");

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost", user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "university_db",
  port: Number(process.env.DB_PORT) || 3306, waitForConnections: true, connectionLimit: 10,
});
const q = (sql, p) => new Promise((r, j) => db.query(sql, p, (e, res) => e ? j(e) : r(res)));

(async () => {
  // Find all students with their grades
  const students = await q("SELECT s.student_id, u.user_id, u.email, s.program_id, s.department_id FROM students s JOIN users u ON s.user_id = u.user_id");

  for (const s of students) {
    const completed = await q(
      "SELECT g.grade_id FROM grades g JOIN course_sections cs ON g.section_id = cs.section_id WHERE g.student_id = ? AND cs.course_id = ? AND g.letter_grade NOT IN ('F', '')",
      [s.student_id, 4]
    );
    console.log(`student_id=${s.student_id} (${s.email}): completed prereq for course 4 = ${completed.length > 0}`);
    
    // Check active enrollments for course_id=1
    const enrolled = await q(
      "SELECT e.enrollment_id FROM enrollments e JOIN course_sections cs ON e.section_id = cs.section_id WHERE e.student_id = ? AND cs.course_id = ? AND e.status = 'active'",
      [s.student_id, 1]
    );
    if (enrolled.length > 0) {
      console.log(`  -> Currently enrolled in course 1, enrollment_id=${enrolled[0].enrollment_id}`);
    }
  }

  // Test enrollment by alihassan (user_id=18, student_id=7, program_id=3)
  const alihassanGrades = await q("SELECT g.*, cs.course_id FROM grades g JOIN course_sections cs ON g.section_id = cs.section_id WHERE g.student_id = 7");
  console.log("\nAli Hassan grades:", JSON.stringify(alihassanGrades, null, 2));

  const token = jwt.sign({ id: 18, email: "alihassan2025@university.edu", role: "student" }, "university_jwt_secret_key_2024", { expiresIn: "1h" });

  const enrollData = JSON.stringify({ sectionId: 1 });
  const enrollReq = http.request("http://localhost:5000/api/enrollments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(enrollData),
      "Authorization": "Bearer " + token
    }
  }, (res) => {
    let data = "";
    res.on("data", chunk => data += chunk);
    res.on("end", () => {
      console.log("Enroll status:", res.statusCode);
      console.log("Enroll response:", data);
      process.exit(0);
    });
  });
  enrollReq.on("error", (e) => { console.error("Error:", e.message); process.exit(1); });
  enrollReq.write(enrollData);
  enrollReq.end();
})().catch(e => { console.error(e); process.exit(1); });
