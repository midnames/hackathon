# Multi-stage Dockerfile for Midnight Name Service Frontend
# Context should be set to parent directory: /midnight-starter-template/

# Stage 1: Build stage
FROM node:20 AS builder

# Set working directory
WORKDIR /app

# Copy the entire monorepo (needed for leaf-contract dependency)
COPY . .

# Change to frontend directory
WORKDIR /app/frontend-vite-react

# Install dependencies
RUN npm install --legacy-peer-deps

# Build the application
# This runs: copy-contract-keys && tsc -b && vite build
RUN npm run build

# Stage 2: Production stage
FROM nginx:alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY frontend-vite-react/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /app/frontend-vite-react/dist /usr/share/nginx/html

# Create nginx cache directory
RUN mkdir -p /var/cache/nginx/client_temp

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]