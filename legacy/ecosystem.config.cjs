module.exports = {
  apps: [
    {
      name: 'truthofgod-api',
      cwd: '/var/www/truthofgod/current/apps/api',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.API_PORT || '4010',
      },
    },
    {
      name: 'truthofgod-web',
      cwd: '/var/www/truthofgod/current/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${process.env.WEB_PORT || '3010'}`,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
