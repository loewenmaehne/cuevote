# CueVote Deployment Guide

This guide explains how to deploy CueVote to a production server (e.g., `cuevote.com`).

## Prerequisites
- Node.js (v18+)
- Nginx (or similar reverse proxy)
- SSL Certificate (Let's Encrypt recommended)

## 1. Environment Setup

### Server (.env)
Create a `.env` file in `cuevote-server/`:
```bash
PORT=8080
YOUTUBE_API_KEY=your_key_here
GOOGLE_CLIENT_ID=your_client_id_here
# Optional: Limit allowed origins
ALLOWED_ORIGINS=https://cuevote.com
```

### Client Build
The client is a static Vite app. You must build it before serving.

You must create a `.env` file in `cuevote-client/` with your Google Client ID:
```bash
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

Then build:
```bash
cd cuevote-client
npm install
npm run build
```
This generates the `dist/` folder.

## 2. Running the Server
Use `pm2` or `systemd` to keep the server running.

```bash
cd cuevote-server
npm install
# Start with PM2
pm2 start index.js --name cuevote-server
```

## 3. Nginx Configuration
Your Nginx config should serve the static client files and proxy WebSocket connections to the backend.

```nginx
server {
    listen 80;
    server_name cuevote.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cuevote.com;

    # SSL Config (Certbot usually handles this)
    ssl_certificate /etc/letsencrypt/live/cuevote.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cuevote.com/privkey.pem;

    root /path/to/cuevote/cuevote-client/dist;
    index index.html;

    # Serve Static Client
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy WebSocket & API
    # Since the client now connects to ws(s)://cuevote.com/ (no port),
    # we need to intercept the Upgrade header or a specific path.
    # However, the client doesn't use a /ws path prefix by default (it connects to root).
    # So we check for Upgrade headers.
    
    location / {
        try_files $uri $uri/ /index.html;
        
        # If this is a WebSocket request, proxy to backend
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        
        # Only proxy if it looks like a websocket? 
        # Actually, it's safer to separate WS traffic if possible.
        # But for root path connection:
        if ($http_upgrade = "websocket") {
             proxy_pass http://localhost:8080;
        }
    }
    
    # Alternatively, if you prefer explicit /ws path (requires client change to VITE_WS_URL):
    # location /ws {
    #     proxy_pass http://localhost:8080;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection "Upgrade";
    # }
}
```

> **Note**: The updated client logic connects to `wss://cuevote.com` (root path) by default in production. Nginx must handle the Upgrade header at the root location or use the `if` directive as shown above (though `if` is sometimes discouraged, it works for simple cases). A cleaner approach is often to use a specific path (e.g. `/socket.io` or `/ws`) but `ws` library defaults to root.
