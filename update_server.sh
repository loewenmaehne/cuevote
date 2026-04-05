#!/bin/bash

# exit immediately if a command exits with a non-zero status
set -e

# Configuration
SERVER_DIR="cuevote-server"
CLIENT_DIR="cuevote-client"
PM2_PROCESS_NAME="cuevote-server"
CERT_DIR="certs"

# ---- Worktree detection ----

detect_worktree() {
    local git_dir
    git_dir="$(git rev-parse --git-dir 2>/dev/null)" || return 1

    if echo "$git_dir" | grep -q "/worktrees/"; then
        local toplevel
        toplevel="$(git rev-parse --show-toplevel 2>/dev/null)" || return 1
        WORKTREE_NAME="$(basename "$toplevel")"
        IS_WORKTREE=true
        echo "  ┌─ Worktree mode ─────────────────────────────"
        echo "  │ Worktree:  $WORKTREE_NAME"
        echo "  └─────────────────────────────────────────────"
    else
        IS_WORKTREE=false
    fi
}

detect_worktree

# ---- Local HTTPS (mkcert) ----

ensure_local_certs() {
    local cert_file="$CERT_DIR/localhost.pem"
    local key_file="$CERT_DIR/localhost-key.pem"

    if [ -f "$cert_file" ] && [ -f "$key_file" ]; then
        echo "  -> Local HTTPS certificates found."
        return 0
    fi

    echo "  -> Local HTTPS certificates missing. Generating with mkcert..."

    if ! command -v mkcert &> /dev/null; then
        if command -v brew &> /dev/null; then
            echo "  -> Installing mkcert via Homebrew..."
            brew install mkcert
        else
            echo "  ⚠ mkcert not found and Homebrew not available."
            echo "  ⚠ Server will run without HTTPS (HTTP only)."
            echo "  ⚠ Install mkcert manually: https://github.com/nickolasburr/mkcert"
            return 1
        fi
    fi

    mkcert -install 2>/dev/null || true
    mkdir -p "$CERT_DIR"
    (cd "$CERT_DIR" && mkcert localhost)
    echo "  -> Certificates created in $CERT_DIR/"
}

# ---- Subcommands ----

do_update() {
    echo "==== CueVote Server — Update & Restart ===="

    if ! command -v pm2 &> /dev/null; then
        echo "Error: pm2 is not installed or not in PATH."
        exit 1
    fi

    # 0. Ensure local HTTPS certs
    ensure_local_certs || true

    # 1. Sync to latest remote code
    if [ "$IS_WORKTREE" = true ]; then
        echo "[1/4] Skipping git pull (worktree mode — code is managed by the worktree)"
    else
        echo "[1/4] Updating code from git..."
        if ! git fetch origin; then
            echo "Error: git fetch failed."
            exit 1
        fi
        CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
        REMOTE_REF="origin/${CURRENT_BRANCH}"
        if ! git rev-parse --verify "$REMOTE_REF" &> /dev/null; then
            echo "Error: Remote ref $REMOTE_REF not found."
            exit 1
        fi
        echo "  -> Resetting to $REMOTE_REF..."
        if ! git reset --hard "$REMOTE_REF"; then
            echo "Error: git reset --hard $REMOTE_REF failed."
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

    # 4. Restart Server Process (full restart to pick up cert/env changes)
    echo "[4/4] Restarting Server Process..."
    if pm2 describe "$PM2_PROCESS_NAME" > /dev/null 2>&1; then
        echo "  -> Stopping old process..."
        pm2 delete "$PM2_PROCESS_NAME"
    fi
    echo "  -> Starting fresh instance..."
    pm2 start index.js --name "$PM2_PROCESS_NAME" --update-env
    pm2 save

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

    # Ensure local HTTPS certs
    ensure_local_certs || true

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
