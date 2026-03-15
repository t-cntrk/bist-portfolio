#!/bin/bash

# BIST Stocks Dashboard - Deployment Script
# This script handles safe deployment with rollback capability

set -e  # Exit on any error

# Configuration
APP_NAME="bist-stocks-dashboard"
BACKUP_DIR="./backups"
LOG_FILE="./deploy.log"
CURRENT_VERSION=$(git describe --tags --always)
DEPLOY_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root"
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Pre-deployment checks
log "Starting deployment for version: $CURRENT_VERSION"

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    error "package.json not found. Please run this script from the project root."
fi

# Check if git is clean
if [[ -n $(git status --porcelain) ]]; then
    warning "Working directory is not clean. Consider committing changes first."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Deployment cancelled by user"
    fi
fi

# Backup current database
log "Creating database backup..."
if [[ -f "users.db" ]]; then
    cp users.db "$BACKUP_DIR/users_${DEPLOY_TIMESTAMP}.db"
    success "Database backed up to $BACKUP_DIR/users_${DEPLOY_TIMESTAMP}.db"
else
    warning "No users.db found to backup"
fi

# Backup current server.js
log "Backing up current server.js..."
if [[ -f "server.js" ]]; then
    cp server.js "$BACKUP_DIR/server_${DEPLOY_TIMESTAMP}.js"
    success "server.js backed up"
fi

# Run tests
log "Running pre-deployment tests..."
if [[ -f "test-security.js" ]]; then
    node test-security.js
    if [[ $? -ne 0 ]]; then
        error "Security tests failed"
    fi
    success "Security tests passed"
fi

# Install dependencies
log "Installing dependencies..."
npm install
if [[ $? -ne 0 ]]; then
    error "Failed to install dependencies"
fi
success "Dependencies installed"

# Check if refactored server exists
if [[ -f "server-refactored.js" ]]; then
    log "Refactored server detected. Switching to modular structure..."
    
    # Backup old server
    if [[ -f "server.js" ]]; then
        mv server.js "$BACKUP_DIR/server_legacy_${DEPLOY_TIMESTAMP}.js"
    fi
    
    # Use refactored server
    cp server-refactored.js server.js
    success "Switched to refactored server"
fi

# Validate server.js
log "Validating server configuration..."
node -c server.js
if [[ $? -ne 0 ]]; then
    error "server.js has syntax errors"
fi
success "Server syntax validation passed"

# Create deployment manifest
cat > "$BACKUP_DIR/deploy_${DEPLOY_TIMESTAMP}.json" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "version": "$CURRENT_VERSION",
    "git_commit": "$(git rev-parse HEAD)",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD)",
    "backup_files": [
        "users_${DEPLOY_TIMESTAMP}.db",
        "server_${DEPLOY_TIMESTAMP}.js"
    ],
    "deployment_type": "modular_refactor"
}
EOF

# Start server in background for testing
log "Starting server for health check..."
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Health check
log "Performing health check..."
if curl -f http://localhost:3000/test > /dev/null 2>&1; then
    success "Health check passed"
else
    error "Health check failed"
fi

# Stop test server
kill $SERVER_PID 2>/dev/null || true

# Create rollback script
cat > "$BACKUP_DIR/rollback_${DEPLOY_TIMESTAMP}.sh" << EOF
#!/bin/bash
# Rollback script for deployment $DEPLOY_TIMESTAMP

echo "Rolling back to deployment $DEPLOY_TIMESTAMP..."

# Restore database
if [[ -f "users_${DEPLOY_TIMESTAMP}.db" ]]; then
    cp users_${DEPLOY_TIMESTAMP}.db ../users.db
    echo "Database restored"
fi

# Restore server
if [[ -f "server_${DEPLOY_TIMESTAMP}.js" ]]; then
    cp server_${DEPLOY_TIMESTAMP}.js ../server.js
    echo "Server restored"
fi

echo "Rollback completed"
EOF

chmod +x "$BACKUP_DIR/rollback_${DEPLOY_TIMESTAMP}.sh"

# Final success message
success "Deployment completed successfully!"
log "Version: $CURRENT_VERSION"
log "Backup location: $BACKUP_DIR"
log "Rollback script: $BACKUP_DIR/rollback_${DEPLOY_TIMESTAMP}.sh"
log "Deployment manifest: $BACKUP_DIR/deploy_${DEPLOY_TIMESTAMP}.json"

echo
echo "To start the server:"
echo "  npm start"
echo
echo "To rollback if needed:"
echo "  cd $BACKUP_DIR && ./rollback_${DEPLOY_TIMESTAMP}.sh"
echo
echo "Deployment log: $LOG_FILE" 