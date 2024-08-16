module.exports = {
  apps: [
    {
      name: 'whapi',
      script: 'node_modules/.bin/ts-node',
      args: 'src/server.ts',
      interpreter: 'node',
      instances: 'max',
      exec_mode: 'cluster',
      max_restarts: 5,
      restart_delay: 1000,
      watch: false,
      env: {
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://localhost:27017/whatsapp-bot-db',
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://localhost:27017/whatsapp-bot-db',
        PORT: 4000,
      },
      error_file: './logs/whapi-err.log',
      out_file: './logs/whapi-out.log',
      log_file: './logs/whapi-combined.log',
      time: true,
    },
  ],
}