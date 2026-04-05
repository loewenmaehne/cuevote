#!/bin/bash

# exit immediately if a command exits with a non-zero status
set -e

# Configuration
SERVER_DIR="cuevote-server"
CLIENT_DIR="cuevote-client"
PM2_PROCESS_NAME="cuevote-server"

# ---- Worktree detection ----

detect_worktree() {
    local git_dir
    git_dir="$(git rev-parse --git-dir 2>/dev/null)" || return 1

    # In a worktree, the git-dir path contains "/worktrees/"
    if echo "$git_dir" | grep -q "/worktrees/"; then
        local toplevel
        toplevel="$(git rev-parse --show-toplevel 2>/dev/null)" || return 1
        WORKTREE_NAME="$(basename "$toplevel")"
        IS_WORKTREE=true
    else
        IS_WORKTREE=false
    fi
}

setup_worktree_config() {
    if [ "$IS_WORKTREE" = true ]; then
        PM2_PROCESS_NAME="cuevote-${WORKTREE_NAME}"
        echo "  ┌─ Worktree mode ─────────────────────────────"
        echo "  │ Worktree:    $WORKTREE_NAME"
        echo "  │ PM2 name:    $PM2_PROCESS_NAME"
        echo "  └─────────────────────────────────────────────"
    fi
}

detect_worktree

# ---- Subcommands ----

do_update() {
    echo "==== CueVote Server — Update & Restart ===="

    if ! command -v pm2 &> /dev/null; then
        echo "Error: pm2 is not installed or not in PATH."
        exit 1
    fi

    setup_worktree_config

    # 1. Sync to latest remote main
    if [ "$IS_WORKTREE" = true ]; then
        echo "[1/4] Skipping git pull (worktree mode — code is managed by the worktree)"
    else
        echo "[1/4] Updating code from git (reset to origin/main)..."
        if ! git fetch origin; then
            echo "Error: git fetch failed."
            exit 1
        fi
        if ! git reset --hard origin/main; then
            echo "Error: git reset --hard origin/main failed."
            exit 1
        fi
    fi

    # 2. Update Client (Frontend)
    echo "[2/4] Updating Client (Frontend)..."
    cd "$CLIENT_DIR"

    echo "  -> Installing client dependencies..."
    npm install --silent

    echo "  -> Building client..."
    if ! npm run build; then
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
    if pm2 describe "$PM2_PROCESS_NAME" > /dev/null 2>&1; then
        echo "  -> Process found, attempting reload..."
        pm2 reload "$PM2_PROCESS_NAME" --update-env || pm2 restart "$PM2_PROCESS_NAME" --update-env
    else
        echo "  -> Process not found in PM2, starting new instance..."
        pm2 start index.js --name "$PM2_PROCESS_NAME" --update-env
        pm2 save
    fi

    cd ..

    echo "==== Update Completed Successfully ===="
    echo "Run 'pm2 logs $PM2_PROCESS_NAME' to see output."
}

do_start() {
    echo "==== CueVote Server — Start ===="

    if ! command -v pm2 &> /dev/null; then
        echo "Error: pm2 is not installed or not in PATH."
        exit 1
    fi

    setup_worktree_config

    if [ -f "$CLIENT_DIR/package.json" ] && [ ! -d "$CLIENT_DIR/node_modules" ]; then
        echo "Installing client dependencies..."
        cd "$CLIENT_DIR" && npm install --silent && cd ..
    fi
    if [ -f "$SERVER_DIR/package.json" ] && [ ! -d "$SERVER_DIR/node_modules" ]; then
        echo "Installing server dependencies..."
        cd "$SERVER_DIR" && npm install --silent && cd ..
    fi

    cd "$SERVER_DIR"

    if pm2 describe "$PM2_PROCESS_NAME" > /dev/null 2>&1; then
        echo "Process already exists, restarting clean..."
        pm2 delete "$PM2_PROCESS_NAME"
    fi
    echo "Starting instance..."
    pm2 start index.js --name "$PM2_PROCESS_NAME" --update-env
    pm2 save

    cd ..

    echo "==== Server Started ===="
    echo "Run 'pm2 logs $PM2_PROCESS_NAME' to see output."
}

do_stop() {
    echo "==== CueVote Server — Stop ===="

    if ! command -v pm2 &> /dev/null; then
        echo "Error: pm2 is not installed or not in PATH."
        exit 1
    fi

    setup_worktree_config

    if pm2 describe "$PM2_PROCESS_NAME" > /dev/null 2>&1; then
        pm2 stop "$PM2_PROCESS_NAME"
        pm2 delete "$PM2_PROCESS_NAME"
        echo "Server stopped and removed from PM2."
    else
        echo "Process '$PM2_PROCESS_NAME' not found in PM2 — nothing to stop."
    fi
}

do_status() {
    if ! command -v pm2 &> /dev/null; then
        echo "Error: pm2 is not installed or not in PATH."
        exit 1
    fi
    pm2 status
}

show_usage() {
    echo "Usage: bash update_server.sh [command]"
    echo ""
    echo "Commands:"
    echo "  (no command)   Update code from GitHub, build client, restart server"
    echo "  start          Start the server (without pulling updates)"
    echo "  stop           Stop the server"
    echo "  status         Show PM2 process status"
    echo "  help           Show this help message"
}

# ---- Main ----

case "${1:-update}" in
    update)   do_update   ;;
    start)    do_start    ;;
    stop)     do_stop     ;;
    status)   do_status   ;;
    help|-h|--help)  show_usage ;;
    *)
        echo "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac
