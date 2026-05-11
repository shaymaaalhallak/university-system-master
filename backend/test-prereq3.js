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
  // Test 1: Student WITHOUT prereq tries to enroll in course with prereq
  console.log("=== TEST 1: Student WITHOUT completed prereq ===");
  console.log("Student: alihassan2025@university.edu (user_id=18, student_id=7)");
  console.log("Course: section_id=1 (course_id=1 - Data Structures, requires course_id=4 - CS101)");
  
  // Verify they haven't completed the prereq
  const prereqCheck = await q(
    "SELECT g.grade_id, g.letter_grade FROM grades g JOIN course_sections cs ON g.section_id = cs.section_id WHERE g.student_id = 7 AND cs.course_id = 4 AND g.letter_grade NOT IN ('F', '')"
  );
  console.log("Completed prereq course_id=4:", prereqCheck.length > 0 ? JSON.stringify(prereqCheck) : "NO");
  
  // Drop any existing enrollment for section 1
  await q("UPDATE enrollments SET status = 'dropped' WHERE student_id = 7 AND section_id = 1").catch(() => {});

  // Try enrolling
  const token1 = jwt.sign({ id: 18, email: "alihassan2025@university.edu", role: "student" }, "university_jwt_secret_key_2024", { expiresIn: "1h" });
  
  await new Promise((resolve) => {
    const data = JSON.stringify({ sectionId: 1 });
    const req = http.request("http://localhost:5000/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), "Authorization": "Bearer " + token1 }
    }, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        console.log("Status:", res.statusCode);
        console.log("Response:", body);
        console.log("=> Prerequisite check ", res.statusCode === 400 ? "PASSED ✓" : "FAILED ✗");
        resolve();
      });
    });
    req.write(data);
    req.end();
  });

  // Test 2: Student WITH prereq tries to enroll - should succeed
  console.log("\n=== TEST 2: Student WITH completed prereq ===");
  console.log("Student: shaymaaalhallak2023@university.edu (user_id=6, student_id=2)");
  
  const prereqCheck2 = await q(
    "SELECT g.grade_id, g.letter_grade FROM grades g JOIN course_sections cs ON g.section_id = cs.section_id WHERE g.student_id = 2 AND cs.course_id = 4 AND g.letter_grade NOT IN ('F', '')"
  );
  console.log("Completed prereq course_id=4:", prereqCheck2.length > 0 ? JSON.stringify(prereqCheck2) : "NO");
  
  // Drop existing first
  await q("UPDATE enrollments SET status = 'dropped' WHERE student_id = 2 AND section_id = 1").catch(() => {});

  const token2 = jwt.sign({ id: 6, email: "shaymaaalhallak2023@university.edu", role: "student" }, "university_jwt_secret_key_2024", { expiresIn: "1h" });

  await new Promise((resolve) => {
    const data = JSON.stringify({ sectionId: 1 });
    const req = http.request("http://localhost:5000/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), "Authorization": "Bearer " + token2 }
    }, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        console.log("Status:", res.statusCode);
        console.log("Response:", body);
        console.log("=> Enrollment with prereq met: ", res.statusCode === 201 ? "SUCCESS ✓" : "UNEXPECTED ✗");
        resolve();
      });
    });
    req.write(data);
    req.end();
  });

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
