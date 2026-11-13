const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware");
const { User, Task, Session, Note } = require("../models");

const pub = (u) => ({ id: u._id, name: u.name, email: u.email, dailyGoal: u.dailyGoal });
const sign = (u) => ({ token: jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "7d" }), user: pub(u) });
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw bad("Name, email and password are required");
  if (password.length < 6) throw bad("Password needs at least 6 characters");
  res.status(201).json(sign(await User.create({ name, email, password: await bcrypt.hash(password, 10) })));
});

router.post("/login", async (req, res) => {
  const { email = "", password = "" } = req.body;
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password, user.password))) throw bad("Wrong email or password", 401);
  res.json(sign(user));
});

// ----- logged-in user: profile, password, delete account -----
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw bad("Account not found", 401);
  res.json(pub(user));
});

router.put("/me", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw bad("Account not found", 401);
  const { name, dailyGoal } = req.body;
  if (name !== undefined) user.name = name;
  if (dailyGoal !== undefined) user.dailyGoal = Number(dailyGoal);
  await user.save();
  res.json(pub(user));
});

router.put("/password", auth, async (req, res) => {
  const { current = "", next: newPassword = "" } = req.body;
  const user = await User.findById(req.userId);
  if (!user || !(await bcrypt.compare(current, user.password))) throw bad("Current password is wrong");
  if (newPassword.length < 6) throw bad("New password needs at least 6 characters");
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: "Password updated" });
});

router.delete("/me", auth, async (req, res) => {
  const filter = { user: req.userId };
  await Promise.all([Task.deleteMany(filter), Session.deleteMany(filter), Note.deleteMany(filter), User.findByIdAndDelete(req.userId)]);
  res.json({ message: "Account deleted" });
});

module.exports = router;
