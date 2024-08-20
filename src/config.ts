// // config.ts
// import crypto from 'crypto'
// import fs from 'fs'
// import path from 'path'

// const CONFIG_FILE = path.join(__dirname, 'config.json')

// interface Config {
//   JWT_SECRET: string
// }

// function generateJwtSecret(): string {
//   return crypto.randomBytes(64).toString('hex')
// }

// function loadConfig(): Config {
//   let config: Config

//   if (fs.existsSync(CONFIG_FILE)) {
//     // Si el archivo existe, lo leemos
//     config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
//   } else {
//     // Si el archivo no existe, generamos una nueva configuración
//     config = {
//       JWT_SECRET: generateJwtSecret(),
//     }
//   }

//   // Siempre sobrescribimos el archivo con la configuración actual
//   fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
//   return config
// }

// export const config = loadConfig()
