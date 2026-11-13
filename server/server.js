require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(["/api/auth/login", "/api/auth/register"], require("express-rate-limit")({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many attempts. Try again in a few minutes." },
}));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/sessions", require("./routes/sessions"));
app.use("/api/notes", require("./routes/notes"));
app.use("/api", (req, res) => res.status(404).json({ message: "Route not found" }));

// Central error handler (Express 5 forwards async errors here automatically)
app.use((err, req, res, next) => {
  if (err.name === "ValidationError") err.status = 400;
  if (err.name === "CastError") { err.status = 400; err.message = "Invalid id"; }
  if (err.code === 11000) { err.status = 409; err.message = "That email is already registered"; }
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : "Server error" });
});

const { PORT = 3000, MONGO_URI, JWT_SECRET } = process.env;
if (!MONGO_URI || !JWT_SECRET) {
  console.error("Missing MONGO_URI or JWT_SECRET. Copy .env.example to .env and fill it in.");
  process.exit(1);
}
mongoose.connect(MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`StudyHub running at http://localhost:${PORT}`)))
  .catch((err) => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
