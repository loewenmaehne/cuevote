# CueVote Deployment Guide

This guide details the steps to set up CueVote on a fresh Debian server.

## 1. System Requirements & Dependencies

Run the following commands as `root` or with `sudo`.

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Core Dependencies
Use `curl` to set up the Node.js 18+ repository (Debian 12/Bookworm example):
```bash
sudo apt install -y curl git build-essential python3 nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Install Process Manager
Install PM2 to keep the server running.
```bash
sudo npm install -g pm2
```

## 2. Project Setup

Clone the repository to your preferred location. 

If using `/var/www`, you need to set permissions first:

```bash
# Create directory and take ownership
sudo mkdir -p /var/www/cuevote
sudo chown -R $USER:$USER /var/www/cuevote
cd /var/www/cuevote
```

Then clone the files into the current folder:

```bash
```bash
git clone https://github.com/loewenmaehne/cuevote.git .
```

## 3. Backend Setup (cuevote-server)

```bash
cd cuevote-server
npm install
```

### Environment Configuration
Create a `.env` file (`nano .env`) with the following content:
```ini
PORT=8080
YOUTUBE_API_KEY=your_actual_youtube_api_key
GOOGLE_CLIENT_ID=your_actual_google_client_id
ALLOWED_ORIGINS=https://cuevote.com,https://queuevote.com
```

### Start Backend
```bash
pm2 start index.js --name cuevote-server
pm2 save
pm2 startup
```

## 4. Frontend Setup (cuevote-client)

```bash
cd ../cuevote-client
npm install
```

### Environment Configuration
Create a `.env` file (`nano .env`) with the following content:
```ini
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

### Build Client
```bash
npm run build
```
This creates a `dist` directory with the static files.

## 5. Nginx Configuration

Create a new configuration file:
```bash
sudo nano /etc/nginx/sites-available/cuevote
```

Paste the following configuration (replace `your-domain.com`):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/cuevote/cuevote-client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy WebSocket connections
    location / {
        try_files $uri $uri/ /index.html;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        
        # Only proxy if it's a websocket upgrade request
        if ($http_upgrade = "websocket") {
             proxy_pass http://localhost:8080;
        }
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/cuevote /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL Setup (Optional but Recommended)

install certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
