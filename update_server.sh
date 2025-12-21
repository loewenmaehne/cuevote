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

# 1. Pull latest changes
echo "[1/4] Pulling latest changes from git..."
git pull
if [ $? -ne 0 ]; then
    echo "Error: git pull failed."
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

# PERSISTENCE: Copy Android APK from source to dist
# Since we are now tracking the APK in git, we just copy it from the repo folder.
APK_SOURCE="android-app/app/release/app-release.apk"
DIST_ANDROID="cuevote-client/dist/android"

if [ -f "$APK_SOURCE" ]; then
    echo "  -> Deploying Android APK..."
    mkdir -p "$DIST_ANDROID"
    cp "$APK_SOURCE" "$DIST_ANDROID/"
else
    echo "  -> No Android APK found in repository at $APK_SOURCE"
fi

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
