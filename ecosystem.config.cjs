module.exports = {
  apps: [
    {
      name: 'truthofgod-api',
      cwd: '/var/www/truthofgod/current/apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
      },
    },
    {
      name: 'truthofgod-web',
      cwd: '/var/www/truthofgod/current/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
