import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Project from "./models/Project.js";
import Task from "./models/Task.js";
import Comment from "./models/Comment.js";

async function run() {
  await connectDB();
  await Promise.all([
    Comment.deleteMany({}),
    Task.deleteMany({}),
    Project.deleteMany({}),
    User.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash("Demo@123", 10);
  const [admin, manager, alice, bob, viewer] = await User.insertMany([
    { name: "Ada Admin", email: "admin@demo.com", role: "admin", passwordHash },
    {
      name: "Max Manager",
      email: "manager@demo.com",
      role: "project_manager",
      passwordHash,
    },
    {
      name: "Alice Member",
      email: "alice@demo.com",
      role: "team_member",
      passwordHash,
    },
    {
      name: "Bob Member",
      email: "bob@demo.com",
      role: "team_member",
      passwordHash,
    },
    {
      name: "Vera Viewer",
      email: "viewer@demo.com",
      role: "viewer",
      passwordHash,
    },
  ]);

  const p1 = await Project.create({
    name: "Website Redesign",
    description:
      "Refresh the company website with a new look and faster pages.",
    createdBy: admin._id,
    members: [
      { user: manager._id, role: "manager" },
      { user: alice._id, role: "member" },
      { user: bob._id, role: "member" },
      { user: viewer._id, role: "viewer" },
    ],
  });
  await Project.create({
    name: "Mobile App Launch",
    description: "Plan and ship v1 of the mobile app.",
    createdBy: admin._id,
    members: [
      { user: manager._id, role: "manager" },
      { user: alice._id, role: "member" },
    ],
  });

  const tasks = await Task.insertMany([
    {
      project: p1._id,
      title: "Design new homepage",
      description: "Wireframes and hi-fi mockups.",
      status: "in_progress",
      priority: "high",
      assignee: alice._id,
      createdBy: manager._id,
      dueDate: new Date(Date.now() + 5 * 864e5),
    },
    {
      project: p1._id,
      title: "Set up CI pipeline",
      description: "Run lint and tests on every push.",
      status: "todo",
      priority: "medium",
      assignee: bob._id,
      createdBy: manager._id,
    },
    {
      project: p1._id,
      title: "Write copy for About page",
      status: "todo",
      priority: "low",
      assignee: null,
      createdBy: manager._id,
    },
    {
      project: p1._id,
      title: "Optimise images",
      status: "in_review",
      priority: "medium",
      assignee: alice._id,
      createdBy: manager._id,
      dueDate: new Date(Date.now() - 2 * 864e5),
    },
    {
      project: p1._id,
      title: "Accessibility audit",
      status: "done",
      priority: "high",
      assignee: bob._id,
      createdBy: manager._id,
    },
  ]);

  await Comment.insertMany([
    {
      task: tasks[0]._id,
      author: manager._id,
      body: "Please share the first draft by Friday.",
    },
    {
      task: tasks[0]._id,
      author: alice._id,
      body: "On it. Wireframes are done, starting on visuals.",
    },
  ]);

  console.log("Seed complete. All demo users use password: Demo@123");
  console.log(
    "admin@demo.com | manager@demo.com | alice@demo.com | bob@demo.com | viewer@demo.com",
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
