module.exports = {
  apps: [
    {
      name: 'whapi',
      script: 'src/server.ts',
      interpreter: 'ts-node',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://localhost:27017/whapi',
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://localhost:27017/whapi',
        PORT: 4000,
      },
      // Nuevas opciones para reiniciar automáticamente
      restart_delay: 5000, // Esperar 5 segundos antes de reiniciar
      max_restarts: 5, // Máximo de 5 reintentos
      watch: true, // Observar cambios y reiniciar cuando se detecten
      ignore_watch: ['node_modules', '.git'], // Excluir estos directorios de la observación
      watch_options: {
        followSymlinks: false, // No seguir enlaces simbólicos
      },
    },
  ],
};