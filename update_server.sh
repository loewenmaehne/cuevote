#!/bin/bash

# exit immediately if a command exits with a non-zero status
set -e

# Configuration
SERVER_DIR="cuevote-server"
CLIENT_DIR="cuevote-client"
PM2_PROCESS_NAME="cuevote-server"
CERT_DIR="certs"

# ---- Environment detection ----

IS_WORKTREE=false
IS_LOCAL=false

detect_environment() {
    # Worktree detection
    local git_dir
    git_dir="$(git rev-parse --git-dir 2>/dev/null)" || true
    if echo "$git_dir" | grep -q "/worktrees/"; then
        IS_WORKTREE=true
        WORKTREE_NAME="$(basename "$(git rev-parse --show-toplevel 2>/dev/null)")"
    fi

    # Local (macOS) vs production (Linux) detection
    if [ "$(uname -s)" = "Darwin" ]; then
        IS_LOCAL=true
    fi

    echo "  ┌─ Environment ────────────────────────────────"
    echo "  │ OS:        $(uname -s) ($([ "$IS_LOCAL" = true ] && echo "local dev" || echo "production"))"
    echo "  │ Worktree:  $([ "$IS_WORKTREE" = true ] && echo "$WORKTREE_NAME" || echo "no (main checkout)")"
    echo "  │ Branch:    $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
    echo "  └──────────────────────────────────────────────"
}

detect_environment

# ---- Local HTTPS (mkcert) ----

ensure_local_certs() {
    # Only needed on local dev machines; production uses nginx for TLS
    if [ "$IS_LOCAL" != true ]; then
        return 0
    fi

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
            echo "  WARNING: mkcert not found and Homebrew not available."
            echo "  WARNING: Server will run without HTTPS (HTTP only)."
            echo "  WARNING: Spotify integration requires HTTPS!"
            return 1
        fi
    fi

    mkcert -install 2>/dev/null || true
    mkdir -p "$CERT_DIR"
    (cd "$CERT_DIR" && mkcert localhost)
    echo "  -> Certificates created in $CERT_DIR/"
}

# ---- Process helpers ----

kill_port() {
    local port="$1"
    local pids
    pids="$(lsof -ti :"$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
        echo "  -> Killing process(es) on port $port (PIDs: $pids)..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

ensure_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo "Error: pm2 is not installed or not in PATH."
        exit 1
    fi
}

restart_backend() {
    ensure_pm2
    cd "$SERVER_DIR"

    if pm2 describe "$PM2_PROCESS_NAME" > /dev/null 2>&1; then
        echo "  -> Stopping old backend process..."
        pm2 delete "$PM2_PROCESS_NAME" 2>/dev/null || true
    fi
    # Also kill anything lingering on port 8080
    kill_port 8080

    echo "  -> Starting backend (PM2)..."
    pm2 start index.js --name "$PM2_PROCESS_NAME" --update-env
    pm2 save

    cd ..
}

start_vite_dev() {
    # Kill any existing Vite dev server on port 5173
    kill_port 5173

    echo "  -> Starting Vite dev server (port 5173, background)..."
    cd "$CLIENT_DIR"
    nohup npm run dev > /dev/null 2>&1 &
    cd ..

    # Wait for Vite to be ready
    local attempts=0
    while ! lsof -ti :5173 > /dev/null 2>&1; do
        sleep 0.5
        attempts=$((attempts + 1))
        if [ "$attempts" -ge 20 ]; then
            echo "  WARNING: Vite dev server did not start within 10s."
            return 1
        fi
    done
    echo "  -> Vite dev server running."
}

# ---- Subcommands ----

do_update() {
    echo "==== CueVote Server — Update & Restart ===="
    ensure_pm2

    # 0. Ensure local HTTPS certs
    ensure_local_certs || true

    # 1. Sync to latest remote code
    if [ "$IS_WORKTREE" = true ]; then
        echo "[1/4] Skipping git pull (worktree mode)"
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
    cd ..

    # 4. Restart
    echo "[4/4] Restarting services..."
    restart_backend

    if [ "$IS_LOCAL" = true ]; then
        start_vite_dev
    fi

    echo ""
    echo "==== Update Completed Successfully ===="
    print_urls
}

do_start() {
    echo "==== CueVote Server — Start ===="
    ensure_pm2

    # Ensure local HTTPS certs
    ensure_local_certs || true

    # Install deps if missing
    if [ -f "$CLIENT_DIR/package.json" ] && [ ! -d "$CLIENT_DIR/node_modules" ]; then
        echo "Installing client dependencies..."
        cd "$CLIENT_DIR" && npm install --silent && cd ..
    fi
    if [ -f "$SERVER_DIR/package.json" ] && [ ! -d "$SERVER_DIR/node_modules" ]; then
        echo "Installing server dependencies..."
        cd "$SERVER_DIR" && npm install --silent && cd ..
    fi

    restart_backend

    if [ "$IS_LOCAL" = true ]; then
        start_vite_dev
    fi

    echo ""
    echo "==== Server Started ===="
    print_urls
}

do_stop() {
    echo "==== CueVote Server — Stop ===="

    # Stop PM2 backend
    if command -v pm2 &> /dev/null; then
        if pm2 describe "$PM2_PROCESS_NAME" > /dev/null 2>&1; then
            pm2 stop "$PM2_PROCESS_NAME"
            pm2 delete "$PM2_PROCESS_NAME"
            echo "Backend stopped (PM2)."
        else
            echo "Backend not running in PM2."
        fi
    fi

    # Stop Vite dev server
    local vite_pids
    vite_pids="$(lsof -ti :5173 2>/dev/null || true)"
    if [ -n "$vite_pids" ]; then
        echo "$vite_pids" | xargs kill -9 2>/dev/null || true
        echo "Vite dev server stopped."
    fi

    # Stop anything on backend port
    kill_port 8080

    echo "==== All services stopped ===="
}

do_status() {
    echo "==== CueVote Server — Status ===="
    echo ""

    # PM2
    if command -v pm2 &> /dev/null; then
        pm2 status
    else
        echo "pm2 not found."
    fi

    echo ""

    # Port check
    echo "Port listeners:"
    for port in 8080 5173; do
        local pid
        pid="$(lsof -ti :$port 2>/dev/null || true)"
        if [ -n "$pid" ]; then
            echo "  :$port  -> PID $pid (running)"
        else
            echo "  :$port  -> not listening"
        fi
    done

    echo ""

    # HTTPS status
    if [ -f "$CERT_DIR/localhost.pem" ] && [ -f "$CERT_DIR/localhost-key.pem" ]; then
        echo "HTTPS: enabled (certs found in $CERT_DIR/)"
    else
        echo "HTTPS: disabled (no certs — run 'bash update_server.sh start' to auto-generate)"
    fi
}

print_urls() {
    local proto="http"
    if [ -f "$CERT_DIR/localhost.pem" ] && [ -f "$CERT_DIR/localhost-key.pem" ]; then
        proto="https"
    fi
    echo ""
    echo "  URLs:"
    if [ "$IS_LOCAL" = true ]; then
        echo "    Frontend:  ${proto}://localhost:5173"
    fi
    echo "    Backend:   ${proto}://localhost:8080"
    echo "    PM2 logs:  pm2 logs $PM2_PROCESS_NAME"
}

show_usage() {
    echo "Usage: bash update_server.sh [command]"
    echo ""
    echo "Commands:"
    echo "  (no command)   Update code, build client, restart all services"
    echo "  start          Start all services (without pulling updates)"
    echo "  stop           Stop all services (backend + Vite dev server)"
    echo "  status         Show service status, ports, and HTTPS info"
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
