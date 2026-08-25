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
        PORT: 4000
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
