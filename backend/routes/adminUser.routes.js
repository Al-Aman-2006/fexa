const express = require("express");
const router = express.Router();
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  blockUser,
  unblockUser,
} = require("../controllers/adminUser.controller");
const adminMiddleware = require("../middlewares/admin.middleware");

// All admin user routes require admin authentication
router.use(adminMiddleware);

router.get("/", getUsers);
router.post("/", createUser);
router.put("/:userId", updateUser);
router.delete("/:userId", deleteUser);
router.patch("/:userId/block", blockUser);
router.patch("/:userId/unblock", unblockUser);

module.exports = router;
