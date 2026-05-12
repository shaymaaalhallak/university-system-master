const http = require("http");
const jwt = require("jsonwebtoken");

// Generate a valid admin token
const token = jwt.sign(
  { id: 5, email: "admin@university.edu", role: "admin" },
  "university_jwt_secret_key_2024",
  { expiresIn: "1h" }
);

// Test creating a section
const data = JSON.stringify({
  courseId: 1,
  sectionName: "A",
  semester: "Spring",
  year: 2026,
  room: "101",
  days: ["Monday", "Wednesday", "Friday"],
  startTime: "09:00",
  endTime: "11:00",
});

console.log("=== Testing POST section ===");
const req = http.request(
  "http://localhost:5000/api/users/professors/2/sections",  // user_id=2 → professor_id=1
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
      Authorization: "Bearer " + token,
    },
  },
  (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Response:", body);
      if (res.statusCode === 201) {
        const sectionId = JSON.parse(body).data.sectionId;
        console.log("\nSection created! ID:", sectionId);

        // Now test GET professor details to see rooms data
        console.log("\n=== Testing GET professor details ===");
        const req2 = http.request(
          "http://localhost:5000/api/users/professors/2",
          {
            method: "GET",
            headers: {
              Authorization: "Bearer " + token,
            },
          },
          (res2) => {
            let b2 = "";
            res2.on("data", (c) => (b2 += c));
            res2.on("end", () => {
              const result = JSON.parse(b2);
              if (result.success) {
                console.log("Rooms count:", result.data.rooms?.length || 0);
                console.log("First rooms:", JSON.stringify(result.data.rooms?.slice(0, 3)));
                const latestSection = result.data.sections[result.data.sections.length - 1];
                console.log("\nLatest section:", JSON.stringify(latestSection));
              } else {
                console.log("Error:", result.message);
              }
              process.exit(0);
            });
          }
        );
        req2.end();
      } else {
        process.exit(0);
      }
    });
  }
);
req.write(data);
req.end();
