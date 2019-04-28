import * as http from "http";
import * as http2 from "http2"; // is basically https
import * as Koa from "koa";
import * as cors from "@koa/cors";
import * as jsonError from "koa-json-error";
import * as logger from "koa-logger";
import * as routing from "routing-controllers";
import { appConfig } from "./config";
import { routingControllersConfig } from "./routingControllersConfig";
import { updateDatabaseRevision } from "./models/updates";

const {
  production,
  host,
  port,
  httpsConfig,
} = appConfig()

export class RestartableApp {
  server!: http.Server | http2.Http2SecureServer

  setupKoa(useLogger: boolean) {
    const app = new Koa()

    app.use(cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Authorization"],
    }))

    app.use(jsonError({
      format: (err: any, obj: any) => ({
        name: err.name,
        message: err.message,
        type: err.type,
        status: err.status,
        stack: production ? undefined : err.stack,
      }),
    }))

    if (useLogger && !production) {
      app.use(logger())
    }

    return routing.useKoaServer(app, routingControllersConfig)
  }

  listen(useLogger = true) {
    const app = this.setupKoa(useLogger)
    const handler = app.callback()

    updateDatabaseRevision()

    return new Promise<void>(resolve => {
      if (production && httpsConfig) {
        Object.assign(httpsConfig, { allowHTTP1: true })

        this.server = http2.createSecureServer(httpsConfig, handler)
      } else {
        this.server = http.createServer(handler)
      }

      this.server.listen(port, host, resolve)
    })
  }

  close() {
    return new Promise<void>(resolve => {
      this.server.close(resolve as any)
    })
  }
}
