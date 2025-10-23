const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const apiRoutes = require('./routes');
const redisClient = require('./config/redis');
const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/backend?replicaSet=dbrs', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.log('Trying to connect to standalone MongoDB...');
    
    // Fallback to standalone connection
    try {
      const conn = await mongoose.connect('mongodb://localhost:27017/backend', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log(`✅ MongoDB Connected (standalone): ${conn.connection.host}`);
    } catch (fallbackError) {
      console.error('❌ MongoDB fallback connection failed:', fallbackError);
      console.log('Please start MongoDB service or check your connection');
      process.exit(1);
    }
  }
};


// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Connect to MongoDB and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
    console.log('Redis caching enabled for news and crypto endpoints');
  });
});
