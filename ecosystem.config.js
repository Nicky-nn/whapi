module.exports = {
  apps: [
    {
      name: 'whapi', // Nombre de la aplicación
      script: 'src/server.ts', // Ruta al archivo principal de tu aplicación
      instances: 'max', // Usa el máximo número de instancias posibles
      exec_mode: 'cluster', // Ejecuta en modo cluster para balanceo de carga
      env: {
        NODE_ENV: 'development', // Configura el entorno de desarrollo
        MONGODB_URI: 'mongodb://localhost:27017/whatsapp-bot-db',
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production', // Configura el entorno de producción
        MONGODB_URI: 'mongodb://localhost:27017/whatsapp-bot-db',
        PORT: 4000,
      },
    },
  ],
}
