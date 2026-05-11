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
  // Student user_id=3 (student@university.edu), student_id=1
  const studentId = 1;
  const completed = await q(
    "SELECT g.grade_id, g.letter_grade FROM grades g JOIN course_sections cs ON g.section_id = cs.section_id WHERE g.student_id = ? AND cs.course_id = ? AND g.letter_grade NOT IN ('F', '')",
    [studentId, 4]
  );
  console.log("Student 1 - completed prereq (course_id=4):", JSON.stringify(completed));

  const token = jwt.sign({ id: 3, email: "student@university.edu", role: "student" }, "university_jwt_secret_key_2024", { expiresIn: "1h" });

  // Try enrolling in section 1 (course_id=1, requires course_id=4)
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
