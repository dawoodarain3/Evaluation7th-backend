const mongoose = require('mongoose');

const loggingSchema = new mongoose.Schema({
  jwt: {
    type: String,
    required: false,
    default: null
  },
  endpoint: {
    type: String,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  responseTime: {
    type: Number,
    required: true
  },
  cacheHit: {
    type: Boolean,
    required: true,
    default: false
  },
  httpStatus: {
    type: Number,
    required: true
  },
  query: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

const Logging = mongoose.model('Logging', loggingSchema);

module.exports = Logging;
