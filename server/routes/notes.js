const router = require("express").Router();
const auth = require("../middleware");
const { Note } = require("../models");

router.use(auth);
router.get("/", async (req, res) => res.json(await Note.find({ user: req.userId }).sort({ createdAt: -1 })));
router.post("/", async (req, res) => res.status(201).json(await Note.create({ user: req.userId, text: req.body.text })));
router.delete("/:id", async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!note) return res.status(404).json({ message: "Note not found" });
  res.json({ message: "Deleted" });
});
module.exports = router;
