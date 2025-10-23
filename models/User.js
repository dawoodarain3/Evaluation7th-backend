const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Plan enum
const PLAN_ENUM = {
  FREE: 'Free',
  PRO: 'Pro'
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // hide password by default
    },
    plan: {
      type: String,
      required: [true, "Plan is required"],
      default: PLAN_ENUM.FREE,
      enum: Object.values(PLAN_ENUM),
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Static method to validate plan
userSchema.statics.isValidPlan = function(plan) {
  return Object.values(PLAN_ENUM).includes(plan);
};

const User = mongoose.model("User", userSchema);

module.exports = { User, PLAN_ENUM };