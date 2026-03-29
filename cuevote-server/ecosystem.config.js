module.exports = {
  apps: [{
    name: 'cuevote-server',
    script: 'index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
    },
    exp_backoff_restart_delay: 100,
    max_restarts: 50,
    restart_delay: 1000,
    kill_timeout: 5000,
    listen_timeout: 10000,
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
