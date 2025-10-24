const Logging = require('../models/Logging');

const logger = {
  info: (message, data = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
  },
  
  error: (message, error = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
  },
  
  api: async (endpoint, method, status, responseTime, options = {}) => {
    const logMessage = `[API] ${new Date().toISOString()} - ${method} ${endpoint} - ${status} - ${responseTime}ms`;
    console.log(logMessage);
    
    // Show complete log object
    const logObject = {
      jwt: options.jwt || null,
      endpoint,
      method,
      responseTime: `${responseTime}ms`,
      cacheHit: options.cacheHit || false,
      httpStatus: status,
      query: options.query || {},
      timestamp: new Date().toISOString()
    };
    
    console.log(`[LOG OBJECT]`, JSON.stringify(logObject, null, 2));
    
    // Save to database
    try {
      const logEntry = await Logging.create({
        jwt: options.jwt || null,
        endpoint,
        method,
        responseTime,
        cacheHit: options.cacheHit || false,
        httpStatus: status,
        query: options.query || {}
      });
      console.log(`[DB] Log saved to database - ID: ${logEntry._id}, Response Time: ${responseTime}ms`);
    } catch (error) {
      console.error('Failed to save API log to database:', error.message);
    }
  }
};

module.exports = logger;
