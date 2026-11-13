const router = require("express").Router();
const auth = require("../middleware");
const { Session } = require("../models");

router.use(auth);

router.get("/", async (req, res) => {
  const filter = { user: req.userId };
  if (req.query.date) filter.date = req.query.date;
  else if (req.query.from) filter.date = { $gte: req.query.from };   // used by the weekly report
  res.json(await Session.find(filter).sort({ createdAt: 1 }));
});

router.post("/", async (req, res) => {
  const { subject, minutes, date } = req.body;
  res.status(201).json(await Session.create({ user: req.userId, subject, minutes, date }));
});

module.exports = router;
