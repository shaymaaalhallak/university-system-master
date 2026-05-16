const mysql = require("mysql2");
const db = mysql.createPool({
  host: "localhost", user: "root", password: "",
  database: "university_db", port: 3306,
  waitForConnections: true, connectionLimit: 1,
});

async function fix() {
  await db.promise().query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    await db.promise().query("DROP TABLE IF EXISTS student_invoices");
    console.log("Dropped student_invoices");
  } catch (e) {
    console.log("DROP failed:", e.message);
    await db.promise().query("ALTER TABLE student_invoices DISCARD TABLESPACE");
    console.log("Discarded tablespace");
    await db.promise().query("DROP TABLE IF EXISTS student_invoices");
    console.log("Dropped after discard");
  }
  await db.promise().query(`CREATE TABLE student_invoices (
    id int(11) NOT NULL AUTO_INCREMENT,
    student_id int(11) NOT NULL,
    semester varchar(20) NOT NULL,
    year int(11) NOT NULL,
    total_credits int(11) NOT NULL DEFAULT 0,
    price_per_credit decimal(10,2) NOT NULL DEFAULT 0.00,
    total_amount decimal(10,2) NOT NULL DEFAULT 0.00,
    discount_amount decimal(10,2) NOT NULL DEFAULT 0.00,
    penalty_amount decimal(10,2) NOT NULL DEFAULT 0.00,
    final_amount decimal(10,2) NOT NULL DEFAULT 0.00,
    paid_amount decimal(10,2) NOT NULL DEFAULT 0.00,
    status enum('pending','paid','partial','overdue') DEFAULT 'pending',
    generated_at timestamp DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY inv_student (student_id),
    KEY inv_semester (semester,year),
    CONSTRAINT inv_student_fk FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("Created student_invoices");
  await db.promise().query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("OK");
  db.end();
}
fix().catch(e => { console.error(e.message); db.end(); });
