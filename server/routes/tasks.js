const router = require("express").Router();
const auth = require("../middleware");
const { Task } = require("../models");

router.use(auth);
const pick = ({ title, subject, due, priority, done }) =>
  Object.fromEntries(Object.entries({ title, subject, due, priority, done }).filter(([, v]) => v !== undefined));

router.get("/", async (req, res) => res.json(await Task.find({ user: req.userId }).sort({ createdAt: -1 })));

router.post("/", async (req, res) => res.status(201).json(await Task.create({ ...pick(req.body), user: req.userId })));

router.put("/:id", async (req, res) => {
  const task = await Task.findOneAndUpdate({ _id: req.params.id, user: req.userId }, pick(req.body), { new: true, runValidators: true });
  if (!task) return res.status(404).json({ message: "Task not found" });
  res.json(task);
});

router.delete("/", async (req, res) => {   // clears all completed tasks
  const { deletedCount } = await Task.deleteMany({ user: req.userId, done: true });
  res.json({ deletedCount });
});

router.delete("/:id", async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!task) return res.status(404).json({ message: "Task not found" });
  res.json({ message: "Deleted" });
});

module.exports = router;
