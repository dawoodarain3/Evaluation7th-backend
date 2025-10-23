const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, PLAN_ENUM } = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Signup function
const signup = async (req, res) => {
  try {
    const { email, password, name, plan = PLAN_ENUM.FREE } = req.body;

    // Validate plan field
    if (!User.isValidPlan(plan)) {
      return res.status(400).json({
        success: false,
        message: `Plan must be either "${PLAN_ENUM.FREE}" or "${PLAN_ENUM.PRO}"`
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create new user (password will be hashed by pre-save middleware)
    const newUser = await User.create({
      email,
      password,
      name,
      plan
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Login function
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password using the comparePassword method
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, plan: user.plan },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Upgrade plan function
const upgradePlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user._id;

    // Validate plan field
    if (!User.isValidPlan(plan)) {
      return res.status(400).json({
        success: false,
        message: `Plan must be either "${PLAN_ENUM.FREE}" or "${PLAN_ENUM.PRO}"`
      });
    }

    // Check if user is trying to upgrade to the same plan
    if (req.user.plan === plan) {
      return res.status(400).json({
        success: false,
        message: `User is already on ${plan} plan`
      });
    }

    // Update user plan
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { plan },
      { new: true, runValidators: true }
    );
    res.json({
      success: true,
      message: `Plan successfully upgraded to ${plan}`
    });

  } catch (error) {
    console.error('Upgrade plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Export individual functions
module.exports = {
  signup,
  login,
  upgradePlan
};