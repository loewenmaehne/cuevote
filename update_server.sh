#!/bin/bash

# exit immediately if a command exits with a non-zero status
set -e

# Configuration
SERVER_DIR="cuevote-server"
CLIENT_DIR="cuevote-client"
MCP_DIR="cuevote-mcp"
PM2_PROCESS_NAME="cuevote-server"
PM2_MCP_NAME="cuevote-mcp-dj"

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
        echo "  ┌─ Worktree mode ─────────────────────────────"
        echo "  │ Worktree:  $WORKTREE_NAME"
        echo "  └─────────────────────────────────────────────"
    else
        IS_WORKTREE=false
    fi
}

detect_worktree

# ---- Health check ----

# The server's own /health endpoint, on the port it actually listens on.
# PORT lives in cuevote-server/.env; 8080 is the server's own default.
server_port() {
    local port=""
    if [ -f "$SERVER_DIR/.env" ]; then
        port="$(grep -E '^[[:space:]]*PORT=' "$SERVER_DIR/.env" | tail -n1 | cut -d= -f2 | tr -d '[:space:]"'"'"'')"
    fi
    echo "${port:-8080}"
}

# Polls /health until it answers or the budget runs out. pm2 reload returns as
# soon as it has signalled the process, not when the new one is serving, so a
# single immediate curl would race the restart.
wait_for_health() {
    local port
    port="$(server_port)"
    local attempts=15
    local i=1
    while [ "$i" -le "$attempts" ]; do
        if curl -fsS --max-time 2 "http://127.0.0.1:${port}/health" > /dev/null 2>&1; then
            echo "  -> Health check passed on port ${port} (attempt ${i}/${attempts})."
            return 0
        fi
        sleep 1
        i=$((i + 1))
    done
    echo "  -> Health check FAILED on port ${port} after ${attempts}s."
    return 1
}

# Puts the working tree back on the previously deployed commit and restarts from
# it. Only meaningful outside worktree mode, where this script owns the checkout.
rollback_to() {
    local sha="$1"
    echo ""
    echo "!!!! Deployment unhealthy — rolling back to ${sha} !!!!"

    if ! git reset --hard "$sha"; then
        echo "Error: rollback checkout failed. The server is running unverified code."
        echo "       Recover manually: git reset --hard ${sha} && bash update_server.sh start"
        return 1
    fi

    (cd "$CLIENT_DIR" && npm ci --silent && npm run build) || {
        echo "Error: client rebuild during rollback failed."
        return 1
    }
    (cd "$SERVER_DIR" && npm ci --silent) || {
        echo "Error: server dependency install during rollback failed."
        return 1
    }

    pm2 reload "$PM2_PROCESS_NAME" --update-env || pm2 restart "$PM2_PROCESS_NAME" --update-env

    if wait_for_health; then
        echo "==== Rolled back to ${sha}. The previous version is serving again. ===="
        return 0
    fi

    echo "Error: the rollback target is unhealthy too. Manual intervention required."
    echo "       Logs: pm2 logs ${PM2_PROCESS_NAME}"
    return 1
}

# ---- Subcommands ----

do_update() {
    echo "==== CueVote Server — Update & Restart ===="

    if ! command -v pm2 &> /dev/null; then
        echo "Error: pm2 is not installed or not in PATH."
        exit 1
    fi
    if ! command -v curl &> /dev/null; then
        echo "Error: curl is not installed or not in PATH (needed for the health check)."
        exit 1
    fi

    # 1. Sync to latest remote main
    # PREV_SHA is captured *before* the reset — it is the only handle on the
    # version that was known to work, and `git reset --hard` destroys the tree.
    PREV_SHA=""
    if [ "$IS_WORKTREE" = true ]; then
        echo "[1/7] Skipping git pull (worktree mode — code is managed by the worktree)"
    else
        echo "[1/7] Updating code from git (reset to origin/main)..."
        PREV_SHA="$(git rev-parse HEAD)"
        echo "  -> Currently deployed: ${PREV_SHA}"
        if ! git fetch origin; then
            echo "Error: git fetch failed."
            exit 1
        fi
        if ! git reset --hard origin/main; then
            echo "Error: git reset --hard origin/main failed."
            exit 1
        fi
        echo "  -> Now deploying:      $(git rev-parse HEAD)"
    fi

    # 2. Update Client (Frontend)
    echo "[2/7] Updating Client (Frontend)..."
    cd "$CLIENT_DIR"

    echo "  -> Installing client dependencies..."
    npm ci --silent

    echo "  -> Building client..."
    if ! npm run build; then
        echo "Error: Client build failed."
        exit 1
    fi
    echo "  -> Client build successful."

    cd ..

    # 3. Update Server (Backend)
    echo "[3/7] Updating Server (Backend)..."
    cd "$SERVER_DIR"

    echo "  -> Installing server dependencies..."
    npm ci --silent

    # 4. Test the new code before it touches the running process. Everything up
    #    to here is reversible by doing nothing; the reload below is not.
    echo "[4/7] Running server tests..."
    if ! npm test; then
        echo ""
        echo "Error: server tests failed. Aborting BEFORE restart — the running server is untouched."
        if [ -n "$PREV_SHA" ]; then
            echo "       The working tree is on the new code; restore it with:"
            echo "       git reset --hard ${PREV_SHA}"
        fi
        exit 1
    fi
    echo "  -> Tests passed."

    # 5. Restart Server Process
    echo "[5/7] Restarting Server Process..."
    if pm2 describe "$PM2_PROCESS_NAME" > /dev/null 2>&1; then
        echo "  -> Process found, attempting reload..."
        pm2 reload "$PM2_PROCESS_NAME" --update-env || pm2 restart "$PM2_PROCESS_NAME" --update-env
    else
        echo "  -> Process not found in PM2, starting new instance..."
        pm2 start index.js --name "$PM2_PROCESS_NAME" --update-env
        pm2 save
    fi

    cd ..

    # 6. Verify the process that came back actually serves traffic. Without this
    #    a crash-looping deploy still reported success.
    echo "[6/7] Verifying server health..."
    if ! wait_for_health; then
        if [ -n "$PREV_SHA" ]; then
            rollback_to "$PREV_SHA" || exit 1
            exit 1
        fi
        echo "Error: server is unhealthy and no rollback target is available (worktree mode)."
        echo "       Logs: pm2 logs ${PM2_PROCESS_NAME}"
        exit 1
    fi

    # 7. Update MCP (DJ tools server)
    # Needs its own block: its dist/ is gitignored, so a pull never carries the
    # build, and npm ci must keep devDependencies because the build runs tsc.
    echo "[7/7] Updating MCP (DJ tools)..."
    if [ ! -f "$MCP_DIR/package.json" ]; then
        echo "  -> No $MCP_DIR/package.json found — skipping."
    else
        cd "$MCP_DIR"

        echo "  -> Installing MCP dependencies..."
        npm ci --silent

        echo "  -> Building MCP..."
        if ! npm run build; then
            echo "Error: MCP build failed."
            exit 1
        fi

        if pm2 describe "$PM2_MCP_NAME" > /dev/null 2>&1; then
            echo "  -> Process found, restarting..."
            pm2 restart "$PM2_MCP_NAME" --update-env
        else
            echo "  -> Process not found in PM2, starting new instance..."
            pm2 start dist/http.js --name "$PM2_MCP_NAME" --update-env
            pm2 save
        fi

        cd ..
    fi

    echo "==== Update Completed Successfully ===="
    echo "Run 'pm2 logs $PM2_PROCESS_NAME' or 'pm2 logs $PM2_MCP_NAME' to see output."
}

do_start() {
    echo "==== CueVote Server — Start ===="

    if ! command -v pm2 &> /dev/null; then
        echo "Error: pm2 is not installed or not in PATH."
        exit 1
    fi

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
    echo "  (no command)   Update code from GitHub, build client + MCP, restart both processes"
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
