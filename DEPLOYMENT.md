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

If using `/var/www`, use `sudo` to clone and then fix permissions:

```bash
# Clone directly to /var/www/cuevote
sudo git clone https://github.com/loewenmaehne/cuevote.git /var/www/cuevote

# Fix permissions so you own it
sudo chown -R $USER:$USER /var/www/cuevote

# Enter directory
cd /var/www/cuevote
```



## 3. Backend Setup (cuevote-server)

```bash
cd cuevote-server
npm install
```

### Environment Configuration
Create a `.env` file **inside the `cuevote-server` directory** (`nano .env`):
```ini
PORT=8080
YOUTUBE_API_KEY=your_actual_youtube_api_key
GOOGLE_CLIENT_ID=your_actual_google_client_id
ALLOWED_ORIGINS=https://cuevote.com
# Optional Configuration
LOAD_ACTIVE_CHANNELS=true
ACTIVE_CHANNEL_DAYS=60
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
Create a `.env` file **inside the `cuevote-client` directory** (`nano .env`):
```ini
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# Legal & Contact Info (Optional - for Legal Page)
# If omitted, KVK/VAT sections will be hidden.
VITE_LEGAL_NAME="Your Official Name"
VITE_LEGAL_ADDRESS_LINE1="Street Address 123"
VITE_LEGAL_ADDRESS_LINE2="1000 AB Amsterdam"
VITE_LEGAL_EMAIL="privacy@cuevote.com"
# VITE_LEGAL_PHONE="+31 6 12345678"
# VITE_LEGAL_KVK="12345678"
# VITE_LEGAL_VAT="NL123456789B01"
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

    # Root pointing to the built frontend files
    root /var/www/cuevote/cuevote-client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy WebSocket connections
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
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

## 7. Firewall Setup (UFW)

It is highly recommended to enable a firewall.

```bash
# Install UFW (Uncomplicated Firewall)
sudo apt install ufw

# 1. ALLOW SSH FIRST (Critical, otherwise you lock yourself out!)
sudo ufw allow ssh

# 2. Allow Web Traffic (HTTP & HTTPS)
sudo ufw allow "Nginx Full"

# 3. Enable Firewall
sudo ufw enable
```

sudo ufw status
```

## 8. Security Hardening (Recommended)

### Prevent Brute Force Attacks (Fail2Ban)
Even with a strong password, bots will attack port 22. Install `fail2ban` to automatically ban them after too many failed attempts.

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```
It works automatically out of the box for SSH.

### Use SSH Keys (Best Practice)
For maximum security, disable password login entirely and use SSH keys.
1. Generate a key on your Mac: `ssh-keygen -t ed25519`
2. Copy it to server: `ssh-copy-id julian@your-server-ip`
3. Once verified working, disable `PasswordAuthentication` in `/etc/ssh/sshd_config`.
