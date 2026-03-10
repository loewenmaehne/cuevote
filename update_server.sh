#!/bin/bash

# exit immediately if a command exits with a non-zero status
set -e

# Configuration
SERVER_DIR="cuevote-server"
CLIENT_DIR="cuevote-client"
PM2_PROCESS_NAME="cuevote-server"

echo "==== Starting CueVote Server Update ===="

# 0. Check for PM2
if ! command -v pm2 &> /dev/null; then
    echo "Error: pm2 is not installed or not in PATH."
    echo "This script is intended for the production server environment."
    exit 1
fi

# 1. Sync to latest remote main (force server to match GitHub)
echo "[1/4] Updating code from git (reset to origin/main)..."

# Fetch latest commits from origin
if ! git fetch origin; then
    echo "Error: git fetch failed."
    exit 1
fi

# Reset local main to exactly match origin/main
if ! git reset --hard origin/main; then
    echo "Error: git reset --hard origin/main failed."
    exit 1
fi

# 2. Update Client (Frontend) - Build First to minimize downtime impact
echo "[2/4] Updating Client (Frontend)..."
cd "$CLIENT_DIR"

echo "  -> Installing client dependencies..."
npm install --silent

echo "  -> Building client..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error: Client build failed."
    exit 1
fi
echo "  -> Client build successful."



cd ..


# 3. Update Server (Backend)
echo "[3/4] Updating Server (Backend)..."
cd "$SERVER_DIR"

echo "  -> Installing server dependencies..."
npm install --silent

# 4. Restart Server Process
echo "[4/4] Restarting Server Process..."
# Try to reload for zero-downtime, fallback to restart if it's not running or fails
if pm2 describe "$PM2_PROCESS_NAME" > /dev/null 2>&1; then
    echo "  -> Process found, attempting reload..."
    # Try reload, fallback to restart
    pm2 reload "$PM2_PROCESS_NAME" || pm2 restart "$PM2_PROCESS_NAME"
else
    echo "  -> Process not found in PM2, starting new instance..."
    pm2 start index.js --name "$PM2_PROCESS_NAME"
    pm2 save
fi

cd ..

echo "==== Update Completed Successfully ===="
echo "The server is now running the latest version."
