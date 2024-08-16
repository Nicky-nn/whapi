module.exports = {
  apps: [
    {
      name: 'whapi',
      script: 'src/server.ts',
      interpreter: 'bun', // Asegúrate de que `bun` esté en el PATH
      instances: 'max',
      exec_mode: 'cluster',
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
    },
  ],
}
