const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const owner = { type: Schema.Types.ObjectId, ref: "User", required: true, index: true };

const User = model("User", new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, "Enter a valid email"] },
  password: { type: String, required: true },
  dailyGoal: { type: Number, default: 60, min: [5, "Daily goal must be between 5 and 720 minutes"], max: [720, "Daily goal must be between 5 and 720 minutes"] }
}, { timestamps: true }));

const Task = model("Task", new Schema({
  user: owner,
  title: { type: String, required: true, trim: true, minlength: [3, "Title needs at least 3 characters"], maxlength: 200 },
  subject: { type: String, trim: true, default: "General", maxlength: 60 },
  due: { type: String, default: "", match: [/^(\d{4}-\d{2}-\d{2})?$/, "Due date must be YYYY-MM-DD"] },
  priority: { type: Number, enum: [1, 2, 3], default: 2 },
  done: { type: Boolean, default: false }
}, { timestamps: true }));

const Session = model("Session", new Schema({
  user: owner,
  subject: { type: String, trim: true, default: "General" },
  minutes: { type: Number, required: true, min: 1, max: 600 },
  date: { type: String, required: true }
}, { timestamps: true }));

const Note = model("Note", new Schema({
  user: owner,
  text: { type: String, required: true, trim: true, maxlength: [1000, "Note is too long (max 1000 characters)"] }
}, { timestamps: true }));

module.exports = { User, Task, Session, Note };
