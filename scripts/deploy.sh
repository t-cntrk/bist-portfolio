#!/bin/bash

# BIST Stocks Dashboard - Deployment Script

set -e

APP_NAME="bist-stocks-dashboard"
BACKUP_DIR="./backups"
LOG_FILE="./deploy.log"
CURRENT_VERSION=$(git describe --tags --always 2>/dev/null || echo "unknown")
DEPLOY_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"; }

if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root"
fi

mkdir -p "$BACKUP_DIR"

log "Starting deployment for version: $CURRENT_VERSION"

if [[ ! -f "package.json" ]]; then
    error "package.json not found. Run from project root."
fi

if [[ ! -f "server.js" ]]; then
    error "server.js not found."
fi

if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
    warning "Working directory is not clean."
fi

log "Creating database backup..."
if [[ -f "users.db" ]]; then
    cp users.db "$BACKUP_DIR/users_${DEPLOY_TIMESTAMP}.db"
    success "Database backed up"
else
    warning "No users.db found to backup"
fi

log "Running pre-deployment tests..."
if [[ -f "scripts/test-security.js" ]]; then
    node scripts/test-security.js || error "Security tests failed"
    success "Security tests passed"
fi

log "Installing dependencies..."
npm install || error "Failed to install dependencies"
success "Dependencies installed"

log "Validating server.js..."
node -c server.js || error "server.js has syntax errors"
success "Server syntax validation passed"

cat > "$BACKUP_DIR/deploy_${DEPLOY_TIMESTAMP}.json" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "version": "$CURRENT_VERSION",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo null)",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo null)",
    "backup_files": ["users_${DEPLOY_TIMESTAMP}.db"],
    "entry_point": "server.js"
}
EOF

log "Starting server for health check..."
node server.js &
SERVER_PID=$!
sleep 5

log "Performing health check..."
if curl -f http://localhost:3000/test > /dev/null 2>&1; then
    success "Health check passed"
else
    kill $SERVER_PID 2>/dev/null || true
    error "Health check failed"
fi

kill $SERVER_PID 2>/dev/null || true

success "Deployment completed successfully!"
log "Backup location: $BACKUP_DIR"
log "Deployment manifest: $BACKUP_DIR/deploy_${DEPLOY_TIMESTAMP}.json"

echo
echo "To start the server: npm start"
echo "Deployment log: $LOG_FILE"
