const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcrypt");
require("dotenv").config();

app.use(express.json());

app.use(cors());

const SECRET = "VINAY";

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  purchasedCourse: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
});

const adminSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  imageLink: String,
  published: Boolean,
});

const User = mongoose.model("User", userSchema);
const Admin = mongoose.model("Admin", adminSchema);
const Course = mongoose.model("Course", courseSchema);

const authenticateJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

//connect to mongodb
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Admin routes
app.get("admin/me", authenticateJwt, async (req, res) => {
  const admin = await Admin.findOne({ username: req.user.username });
  if (!admin) {
    res.status(403).json({ msg: "Admin doesnt exist" });
    return;
  }
  res.json({
    username: admin.username,
  });
});

app.post("/admin/signup", async (req, res) => {
  // logic to sign up admin
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(403).json({ message: "Admin already exists" });
    }

    // Hashing the password
    const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

    const result = await Admin.create({ username, password: hashedPassword });

    const token = jwt.sign({ username, role: "admin" }, SECRET, {
      expiresIn: "1h",
    });

    res.json({ message: "Admin created successfully", token });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    const existingAdmin = await Admin.findOne({ username });
    if (!existingAdmin) {
      return res.status(403).json({ message: "Invalid username or password" });
    }

    // Compare hashed passwords
    const passwordMatch = await bcrypt.compare(
      password,
      existingAdmin.password
    );

    if (passwordMatch) {
      const token = jwt.sign({ username, role: "admin" }, SECRET, {
        expiresIn: "1h",
      });
      return res.json({ message: "Admin Logged", token });
    } else {
      return res.status(403).json({ message: "Invalid username or password" });
    }
  } catch (error) {
    console.error("Error logging in admin:", error);
    return res
      .status(500)
      .json({ message: "Server error. Please try again later." });
  }
});

app.post("/admin/courses", authenticateJwt, async (req, res) => {
  // logic to create a course
  const course = new Course(req.body);
  await course.save();
  res.json({ message: "Course created successfully", courseId: course.id });
});

app.put("/admin/course/:courseId", authenticateJwt, async (req, res) => {
  // logic to edit a course
  const course = req.body;
  const courseId = req.params.courseId;
  const updateCourse = await Course.findByIdAndUpdate(courseId, course);
  res.json({ message: "Updated Successfully", updateCourse });
});

app.get("/admin/courses", authenticateJwt, async (req, res) => {
  // logic to get all courses
  const courses = await Course.find({});
  res.json(courses);
});

app.get("/admin/course/:courseId", async (req, res) => {
  const courseId = req.params.courseId;

  try {
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Return the course as JSON response
    res.status(200).json({ course });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ error: error.message }); // Send the specific error message for debugging
  }
});
app.delete("/admin/course/:courseId", async (req, res) => {
  const courseId = req.params.courseId;

  try {
    const deletedCourse = await Course.findByIdAndDelete(courseId);

    if (!deletedCourse) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json({ message: "Successfully Deleted" });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// User routes
app.post("/users/signup", async (req, res) => {
  // logic to sign up user
  const { username, password } = req.body;
  const existUser = await User.findOne({ username });

  if (existUser) {
    return res.status(403).json({ message: "User already exists" });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10); // Hashing with salt rounds 10

  // Create user with hashed password
  const result = await User.create({
    username,
    password: hashedPassword, // Store hashed password in the database
  });

  const token = jwt.sign({ username, role: "user" }, SECRET, {
    expiresIn: "1h",
  });
  res.json({ message: "Successfully Created User", token });
});

app.post("/users/login", async (req, res) => {
  // logic to log in user
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user) {
    return res.status(403).json({ message: "Invalid username or password" });
  }

  // Compare the provided password with the hashed password in the database
  const passwordMatch = await bcrypt.compare(password, user.password);

  if (passwordMatch) {
    const token = jwt.sign({ username, role: "user" }, SECRET, {
      expiresIn: "1h",
    });
    res.json({ message: "Logged in successfully", token });
  } else {
    res.status(403).json({ message: "Invalid username or password" });
  }
});

app.get("/users/courses", async (req, res) => {
  // logic to list all courses
  const courses = await Course.find({ published: true });
  res.json({ courses });
});

app.get("/users/course/:courseId", async (req, res) => {
  const courseId = req.params.courseId;

  try {
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Return the course as JSON response
    res.status(200).json({ course });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ error: error.message }); // Send the specific error message for debugging
  }
});

app.post("/users/courses/:courseId", authenticateJwt, async (req, res) => {
  // logic to purchase a course
  const courseId = req.params.courseId;
  const course = await Course.findById(courseId);
  if (course) {
    const user = await User.findOne({ username: req.user.username });
    if (user) {
      user.purchasedCourse.push(course);
      await user.save();
      res.json({ message: "Course purchased successfully" });
    } else {
      res.status(403).json({ message: "User not found" });
    }
  } else {
    res.status(404).json({ message: "Course not found" });
  }
});

app.get("/users/purchasedCourses", authenticateJwt, async (req, res) => {
  // logic to view purchased courses
  const user = await User.findOne({ username: req.user.username }).populate(
    "purchasedCourse"
  );
  // console.log(user);
  if (user) {
    res.json({ purchasedCourse: user.purchasedCourse || [] });
  } else {
    res.status(403).json({ message: "User not found" });
  }
});

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
