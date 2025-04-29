const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const db = require("./db/db");
require("dotenv").config();



// Allow requests from your Netlify frontend
// app.use(cors({
//   origin: 'https://681063e2dc4ba50008fae55b--keykoders.netlify.app/', // 👈 change this to your actual Netlify URL
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   credentials: true
// }));


// Middleware
app.use(express.json());
const FRONTEND_URL = process.env.FRONTEND_URL || "https://681063e2dc4ba50008fae55b--keykoders.netlify.app";
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());

// Serve static images
// Serve static files (uploaded files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// JWT & bcrypt
const bcryptKey = bcrypt.genSaltSync(10);
const jwtSecret = "wertyuidfgh345678";

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'photo'
      ? 'uploads/photos'
      : file.fieldname === 'resume'
      ? 'uploads/resumes'
      : 'uploads/certificates';
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });
// Register Endpoint
app.post("/register", async (req, res) => {
  const { username, password, email } = req.body;
  const hashedPassword = bcrypt.hashSync(password, bcryptKey);

  try {
    const [existingUser] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    await db.execute(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    const [user] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    const token = jwt.sign({ id: user[0].id, name: user[0].username }, jwtSecret);

    res.json({ token, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating user" });
  }
});

// Login Endpoint
app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  email = email.toLowerCase();

  try {
    const [rows] = await db.execute("SELECT * FROM users WHERE LOWER(email) = ?", [email]);

    if (rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });

    const user = rows[0];
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { email: user.email, name: user.username, id: user.id },
      jwtSecret,
      { expiresIn: "1h" }
    );

    res.status(200).json({ token, userDoc: user, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get user by ID
app.get("/getuser/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, message: "User ID is required." });

  try {
    const [user] = await db.execute("SELECT * FROM users WHERE id = ?", [id]);
    if (user.length > 0) {
      res.status(200).json({ success: true, message: "User details retrieved successfully.", user: user[0] });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (error) {
    console.error("Error retrieving user:", error);
    res.status(500).json({ success: false, message: "An error occurred while retrieving the user." });
  }
});

// Nodemailer setup
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "gangeswaran.keykoders@gmail.com",
    pass: "qwzv ieql jtjx jgju",
  },
});

// Application form
app.post("/application-form", async (req, res) => {
  const { userID, jobTitle, formData } = req.body;
  const { name, email, skills, phone, address, resume, education } = formData;

  if (!userID) return res.status(400).json({ success: false, message: "Sign in to apply for a job." });

  const resumeLink = resume || "#";

  const mailOptions = {
    to: "petchimpetchimuthu@gmail.com",
    subject: "New Application Received",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; padding: 20px;">
        <h1 style="font-size: 24px;">New Application for ${jobTitle}</h1>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Address:</strong> ${address}</p>
        <p><strong>Education:</strong> ${education}</p>
        <p><strong>Skills:</strong> ${skills.join(", ")}</p>
        <p><a href="${resumeLink}">Download Resume</a></p>
      </div>
    `,
  };

  try {
    // await transporter.sendMail(mailOptions);

    await db.execute(
      "INSERT INTO applications (userID, jobTitle, name, email, skills, phone, address, resume, education) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [userID, jobTitle, name, email, JSON.stringify(skills), phone, address, resume, education]
    );

    res.status(200).json({ success: true, message: "Application submitted successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to submit the application");
  }
});

// Get Applications
app.get("/my-applications", async (req, res) => {
  const userID = parseInt(req.query.userID, 10);
  if (!userID) {
    return res.status(400).json({ success: false, message: "Invalid or missing user ID" });
  }

  try {
    const [rows] = await db.execute("SELECT * FROM applications WHERE userID = ?", [userID]);
    rows.forEach(row => {
      row.skills = JSON.parse(row.skills || "[]");
      row.resumeUrl = row.resume;
    });
    res.json({ success: true, applications: rows });
  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Add Course (with image upload)
app.post("/add-course", upload.single("courseImage"), (req, res) => {
  const { courseId, courseName, coursePrice, courseDuration, courseDescription } = req.body;
  const courseImage = req.file ? `/images/${req.file.filename}` : null;

  if (!courseId || !courseName || !coursePrice || !courseDuration || !courseDescription || !courseImage) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql = `
    INSERT INTO courses (courseId, courseName, coursePrice, courseDuration, courseDescription, courseImage)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [courseId, courseName, coursePrice, courseDuration, courseDescription, courseImage], (err, result) => {
    if (err) {
      console.error("❌ Error inserting course:", err);
      return res.status(500).json({ error: "Failed to add course" });
    }
    res.json({ message: "✅ Course added successfully!" });
  });
});


app.get("/courses", async (req, res) => {
  try {
    const [results] = await db.execute("SELECT * FROM courses");

    const coursesWithImages = results.map((course) => ({
      ...course,
      courseImage: course.courseImage ? `http://localhost:5000${course.courseImage}` : null,
    }));

    res.json(coursesWithImages);
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ error: "Database query error" });
  }
});




// API to handle form submission
app.post("/subscriptions", (req, res) => {
  const { name, email, phone, courseId, courseName, status } = req.body;
  const sql =
    "INSERT INTO subscriptions (name, email, phone, courseId, courseName, status) VALUES (?, ?, ?, ?, ?, ?)";
  const values = [name, email, phone, courseId, courseName, status];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Insert error:", err);
      return res.status(500).json({ message: "Failed to subscribe" });
    }
    res.status(200).json({ message: "Subscription successful" });
  });
});




// GET all subscriptions
app.get("/api/subscriptions", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM subscriptions");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching subscriptions:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.put('/api/subscriptions/:id', async (req, res) => {
  const subscriptionId = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  try {
    const [result] = await db.query(
      "UPDATE subscriptions SET status = ? WHERE id = ?",
      [status, subscriptionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    res.json({ message: "Subscription updated successfully" });
  } catch (err) {
    console.error("Database update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});




app.get('/courses/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM courses WHERE courseId = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching course:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



app.post("/api/subscriptions/check", (req, res) => {
  const { email, courseId } = req.body;

  const sql = `SELECT * FROM subscriptions WHERE email = ? AND courseId = ? AND status = 'approved'`;
  db.query(sql, [email, courseId], (err, results) => {
    if (err) return res.status(500).json({ isSubscribed: false });

    const isSubscribed = results.length > 0;
    res.json({ isSubscribed });
  });
});



app.get('/api/trainers', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM trainers');

    const trainers = results.map(trainer => ({
      ...trainer,
      photo_url: trainer.photo ? `http://localhost:${PORT}/uploads/${trainer.photo}` : null,
      resume_url: trainer.resume ? `http://localhost:${PORT}/uploads/${trainer.resume}` : null,
      certificate_url: trainer.certificate ? `http://localhost:${PORT}/uploads/${trainer.certificate}` : null,
    }));

    res.json(trainers);
  } catch (err) {
    console.error('Error fetching trainers:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST API: Add trainer
app.post('/api/trainers', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'certificate', maxCount: 1 }
]), (req, res) => {
  const {
    name, designation, mobile, email, area_of_expertise,
    total_experience, total_training_experience,
    linkedin_profile, fluency_english, fluency_tamil
  } = req.body;

  const photoUrl = req.files && req.files['photo'] ? 'uploads/photos/' + req.files['photo'][0].filename : null;
  const resumeUrl = req.files && req.files['resume'] ? 'uploads/resumes/' + req.files['resume'][0].filename : null;
  const certificateUrl = req.files && req.files['certificate'] ? 'uploads/certificates/' + req.files['certificate'][0].filename : null;

  // Clean the inputs before inserting into the database
  const totalExperience = parseFloat(total_experience.replace(/[^\d.-]/g, ''));
  const totalTrainingExperience = parseFloat(total_training_experience.replace(/[^\d.-]/g, ''));

  // Check if totalExperience or totalTrainingExperience is NaN and handle appropriately
  if (isNaN(totalExperience)) {
    return res.status(400).json({ message: 'Invalid value for total_experience' });
  }
  if (isNaN(totalTrainingExperience)) {
    return res.status(400).json({ message: 'Invalid value for total_training_experience' });
  }

  // Ensure fluency fields are boolean values (0 or 1)
  const fluencyEnglish = fluency_english === '1' ? 1 : 0;
  const fluencyTamil = fluency_tamil === '1' ? 1 : 0;

  const sql = `
    INSERT INTO trainers (
      name, designation, mobile, email, area_of_expertise,
      total_experience, total_training_experience, linkedin_profile,
      photo_url, resume_url, certificate_url,
      fluency_english, fluency_tamil
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  console.log('SQL:', sql);
  console.log('Values:', [
    name, designation, mobile, email, area_of_expertise,
    totalExperience, totalTrainingExperience, linkedin_profile,
    photoUrl, resumeUrl, certificateUrl, fluencyEnglish, fluencyTamil
  ]);

  db.execute(sql, [
    name, designation, mobile, email, area_of_expertise,
    totalExperience, totalTrainingExperience, linkedin_profile,
    photoUrl, resumeUrl, certificateUrl, fluencyEnglish, fluencyTamil
  ])
  .then(([result]) => {
    res.status(201).json({ message: 'Trainer added successfully', data: result });
  })
  .catch(err => {
    console.error('Error adding trainer:', err);
    res.status(500).json({ message: 'Error adding trainer', error: err.message });
  });
});



const executeQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.execute(query, params)
      .then(([rows]) => resolve(rows)) // Extract just rows
      .catch(err => reject(err));
  });
};



// API endpoint for searching students
app.get("/api/students/search", async (req, res) => {
  const {
    branch,
    district,
    college,
  } = req.query;

  // Construct SQL query based on filters
  let query = "SELECT * FROM nm_students WHERE 1=1";
  let params = [];
  
  
  
  if (branch) {
    query += " AND branch = ?";
    params.push(branch);
  }
  
  if (district) {
    query += " AND district = ?";
    params.push(district);
  }
  if (college) {
    query += " AND college = ?";
    params.push(college);
  }

  try {
    const students = await executeQuery(query, params);
    console.log(students);
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




const executQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.execute(query, params)
      .then(([rows]) => resolve(rows)) // Extract just rows
      .catch(err => reject(err));
  });
};


// GET Trainer Schedules API - using async/await style
app.get("/api/trainer-schedules", async (req, res) => {
  const {
    academicYear,
    collegeType,
    semester,
    course,
    trainerName,
  } = req.query;

  let query = "SELECT * FROM trainer_schedules WHERE 1=1";
  const params = [];

  if (academicYear) {
    query += " AND academic_year = ?";
    params.push(academicYear);
  }

  if (collegeType) {
    query += " AND college_type = ?";
    params.push(collegeType);
  }

  if (semester) {
    query += " AND semester = ?";
    params.push(Number(semester));
  }

  if (course) {
    query += " AND course_name = ?";
    params.push(course);
  }

  if (trainerName && trainerName.trim() !== "") {
    query += " AND trainer_name = ?";
    params.push(trainerName);
  }

  try {
    const schedules = await executQuery(query, params);
    console.log("Trainer Schedules:", schedules);
    res.status(200).json(schedules);
  } catch (error) {
    console.error("Error fetching trainer schedules:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});











// Start server
const PORT = process.env.PORT || 5000;
app.listen(5000, () => {
  console.log("🚀 Server is running on port 5000");
});
