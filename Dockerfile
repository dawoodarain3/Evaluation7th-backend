# Use Node.js 22 Alpine image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy dependency files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install mongosh for healthchecks
RUN apk add --no-cache mongodb-tools

# Copy application code
COPY . .

# Create non-root user for security
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

# Expose the backend port
EXPOSE 5000

# Start the app
CMD ["npm", "start"]
