import * as path from "path";
import { readFileSync } from "fs";

interface AppConfigInput {
  production?: boolean
  host?: string
  port?: number
  jwtSecret: string
  masterUser: string
  mongodbUri: string
  httpsConfig?: {
    keyPath: string
    certPath: string
    caPath: string
  }
}

interface AppConfig {
  production: boolean
  host: string
  port: number
  jwtSecret: string
  masterUser: string
  mongodbUri: string
  httpsConfig?: {
    key: string | Buffer
    cert: string | Buffer
    ca: [string | Buffer]
  }
}

const configPath = path.join(__dirname, "/../config.json")
let config: AppConfig | null = null

export function appConfig() {
  if (!config) {
    const rawInput = readFileSync(configPath).toString()
    const input = JSON.parse(rawInput) as AppConfigInput
    const production = (input.production !== undefined) ? input.production : (process.env.NODE_ENV === "production")

    config = {
      production: production,
      host: input.host || (production ? "0.0.0.0" : "127.0.0.1"),
      port: input.port || 8088,
      jwtSecret: input.jwtSecret,
      masterUser: input.masterUser,
      mongodbUri: input.mongodbUri,
      httpsConfig: (production && input.httpsConfig) ? {
        key: readFileSync(input.httpsConfig.keyPath),
        cert: readFileSync(input.httpsConfig.certPath),
        ca: [readFileSync(input.httpsConfig.caPath)],
      } : undefined,
    }
  }

  return config
}
