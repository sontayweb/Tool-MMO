module.exports = {
  apps: [
    {
      name: 'arms-api',
      cwd: 'd:/sontayweb/toolMMO',
      script: 'apps/api/dist/main.js',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        ARMS_API_KEY: 'arms_apikey_3ef419721adcb5879a8385',
        JWT_SECRET: 'arms-secret-jwt-token-key-2026-production-ready'
      }
    },
    {
      name: 'arms-worker',
      cwd: 'd:/sontayweb/toolMMO',
      script: 'apps/worker/dist/main.js',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
