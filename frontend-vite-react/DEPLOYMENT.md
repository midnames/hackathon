# Coolify Deployment Guide for Midnight Name Service

This guide will help you deploy the Midnight Name Service frontend to Coolify.

## Prerequisites

- Coolify instance running and accessible
- Git repository containing this project
- Docker support enabled in Coolify

## Deployment Steps

### 1. Repository Setup

Ensure your repository is accessible to Coolify (GitHub, GitLab, or self-hosted Git).

### 2. Create New Resource in Coolify

1. Go to your Coolify dashboard
2. Click "New Resource"
3. Select "Docker Image" or "Git Repository"
4. Choose your repository

### 3. Configure Build Settings

**Important**: The Docker context must be set to the parent directory because the frontend depends on the `leaf-contract` directory.

#### Build Configuration:
- **Build Pack**: Docker
- **Dockerfile Location**: `frontend-vite-react/Dockerfile`
- **Docker Context**: `.` (root of repository - `/midnight-starter-template/`)
- **Base Directory**: Leave empty or set to `.`

#### Port Configuration:
- **Port**: `80`
- **Protocol**: HTTP

### 4. Environment Variables (Optional)

Add any environment variables your app needs:
```bash
NODE_ENV=production
VITE_APP_NAME=Midnight Name Service
```

### 5. Domain Configuration

1. Set up your domain in Coolify
2. Configure SSL certificate (Let's Encrypt recommended)
3. Point your domain to the Coolify instance

### 6. Deploy

1. Click "Deploy" in Coolify
2. Monitor the build logs
3. The build process will:
   - Install dependencies with Bun
   - Copy contract keys from leaf-contract
   - Build the Vite application
   - Create optimized Nginx container

## Build Process Details

The Dockerfile uses a multi-stage build:

1. **Builder stage**: 
   - Uses `oven/bun:1-alpine`
   - Copies entire monorepo context
   - Runs `bun install` and `bun run build`
   - Includes contract key copying

2. **Production stage**:
   - Uses `nginx:alpine`
   - Copies built files and custom Nginx config
   - Serves the SPA with proper routing

## Monitoring

### Health Check
The container includes a health check endpoint at `/health` that returns "healthy" when the service is running.

### Logs
Monitor logs in Coolify dashboard:
- Build logs: Show the Docker build process
- Application logs: Nginx access and error logs

## Troubleshooting

### Common Issues:

1. **Build fails with "leaf-contract not found"**
   - Ensure Docker context is set to repository root (`.`)
   - Check that `leaf-contract/dist/managed/leaf/` exists

2. **404 errors on page refresh**
   - The Nginx config handles SPA routing automatically
   - Check if `nginx.conf` was copied correctly

3. **WASM files not loading**
   - Verify `public/midnight/` directory is included in build
   - Check MIME types in Nginx config

4. **Build takes too long**
   - Review `.dockerignore` to exclude unnecessary files
   - Consider using Coolify's build cache if available

### Debug Commands:

Test locally before deploying:
```bash
# Build the Docker image locally
cd /midnight-starter-template
docker build -f frontend-vite-react/Dockerfile -t midnight-frontend .

# Run locally
docker run -p 3000:80 midnight-frontend

# Test health check
curl http://localhost:3000/health
```

## File Structure

The deployment includes these key files:

```
frontend-vite-react/
├── Dockerfile              # Multi-stage Docker build
├── nginx.conf              # Custom Nginx configuration
├── .dockerignore           # Build optimization
└── DEPLOYMENT.md           # This guide
```

## Security Considerations

- The Nginx config includes security headers
- WASM files are served with correct MIME types
- Rate limiting is configured for API endpoints
- Sensitive files are blocked from access

## Performance Optimizations

- Gzip compression enabled
- Static asset caching with long expiry
- Efficient Docker layer caching
- Optimized Nginx configuration

## Support

If you encounter issues:
1. Check Coolify build logs
2. Verify all files are committed to repository
3. Test Docker build locally
4. Review this deployment guide

The application should be accessible at your configured domain once deployment completes successfully.