// =============================================================================
// PM2 Ecosystem 配置 — Merch
// =============================================================================

const path = require('path');
const APP_DIR = __dirname;

module.exports = {
  apps: [
    {
      name: 'merch-backend',
      cwd:  path.join(APP_DIR, 'server'),

      script: 'node',
      args:   'src/server.js',

      instances:    1,
      exec_mode:    'fork',
      max_memory_restart: '300M',

      env: {
        NODE_ENV: 'production',
        PORT:     3001,
      },

      out_file:        path.join(APP_DIR, 'logs/backend_out.log'),
      error_file:      path.join(APP_DIR, 'logs/backend_err.log'),
      merge_logs:      true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout:  5000,
      watch: false,
    },
  ],
};
