const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class RetryMechanism {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 10000; // 10 seconds
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.retryCondition = options.retryCondition || this.defaultRetryCondition;
  }

  defaultRetryCondition(error) {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || 
        error.message.includes('timeout') ||
        error.message.includes('Network Error')) {
      return true;
    }

    // Retry on 5xx server errors
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Retry on rate limiting (429)
    if (error.response && error.response.status === 429) {
      return true;
    }

    return false;
  }

  calculateDelay(attempt) {
    const delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.maxDelay);
  }

  async execute(operation, context = '') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`${context} - Attempt ${attempt}/${this.maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error;
        
        console.log(`${context} - Attempt ${attempt} failed:`, error.message);
        
        // Check if we should retry
        if (attempt === this.maxRetries || !this.retryCondition(error)) {
          console.log(`${context} - No more retries. Final error:`, error.message);
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        console.log(`${context} - Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }

    throw lastError;
  }
}

module.exports = RetryMechanism;
