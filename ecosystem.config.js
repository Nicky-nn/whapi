module.exports = {
  apps: [
    {
      name: 'whapi', // Nombre de la aplicación
      script: 'src/server.ts', // Ruta al archivo principal de tu aplicación
      instances: 'max', // Usa el máximo número de instancias posibles
      exec_mode: 'cluster', // Ejecuta en modo cluster para balanceo de carga
      max_restarts: 5, // Máximo número de reinicios antes de detenerse
      restart_delay: 1000, // Tiempo de espera entre reinicios (en milisegundos)
      watch: false, // Desactiva el reinicio automático al detectar cambios en archivos
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
      error_file: './logs/whapi-err.log', // Archivo de log para errores
      out_file: './logs/whapi-out.log', // Archivo de log para la salida estándar
      log_file: './logs/whapi-combined.log', // Archivo de log combinado
      time: true, // Incluir timestamp en los logs
    },
  ],
}
