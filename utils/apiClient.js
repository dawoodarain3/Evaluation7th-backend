const axios = require('axios');
const CircuitBreaker = require('./circuitBreaker');
const RetryMechanism = require('./retry');

class ApiClient {
  constructor(serviceName) {
    this.serviceName = serviceName;
    
    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds
      timeout: 15000 // 15 seconds
    });

    // Initialize retry mechanism
    this.retryMechanism = new RetryMechanism({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2
    });
  }

  // Make API call with circuit breaker and retry
  async makeRequest(url, params = {}, context) {
    const operation = () => axios.get(url, { params });
    
    try {
      const result = await this.circuitBreaker.execute(operation);
      return result;
    } catch (error) {
      // If circuit breaker fails, try with retry mechanism
      if (error.message.includes('Circuit breaker is OPEN')) {
        throw error;
      }
      
      return await this.retryMechanism.execute(operation, context);
    }
  }

  // Handle errors consistently
  handleError(error, res) {
    console.error(`${this.serviceName} API error:`, error.response?.data || error.message);
    
    // Handle different types of errors
    if (error.message.includes('Circuit breaker is OPEN')) {
      return res.status(503).json({
        success: false,
        message: `${this.serviceName} service is temporarily unavailable. Please try again later.`,
        error: 'Service temporarily down',
        retryAfter: Math.ceil((this.circuitBreaker.nextAttempt - Date.now()) / 1000)
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        error: 'Rate limit exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: `Unable to fetch ${this.serviceName.toLowerCase()} data at the moment. Please try again later.`,
      error: error.response?.data?.message || `${this.serviceName} service unavailable`
    });
  }

  // Get service status
  getServiceStatus() {
    const status = this.circuitBreaker.getState();
    return {
      circuitBreaker: status,
      service: this.serviceName,
      status: status.state === 'OPEN' ? 'unavailable' : 'available'
    };
  }
}

module.exports = ApiClient;
