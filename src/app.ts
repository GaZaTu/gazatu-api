import * as http from "http";
import * as http2 from "http2"; // is basically https
import * as Koa from "koa";
import * as cors from "@koa/cors";
import * as logger from "koa-logger";
import * as routing from "routing-controllers";
import { appConfig } from "./config";
import { authorizationChecker, currentUserChecker } from "./controllers/AuthController";

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

    if (useLogger && !production) {
      app.use(logger())
    }

    return routing.useKoaServer(app, {
      development: !production,
      controllers: [__dirname + "/controllers/**/*.[jt]s"],
      defaults: {
        nullResultCode: 404,
        undefinedResultCode: 404,
        paramOptions: {
          required: true,
        },
      },
      classTransformer: false,
      authorizationChecker,
      currentUserChecker,
    })
  }

  listen(useLogger = true) {
    const app = this.setupKoa(useLogger)
    const handler = app.callback()

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
      this.server.close(resolve)
    })
  }
}
