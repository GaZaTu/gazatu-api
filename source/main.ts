import * as http from "http";
import * as http2 from "http2"; // is basically https
import * as Koa from "koa";
import * as cors from "@koa/cors";
import * as bodyparser from "koa-bodyparser";
import * as jsonerror from "koa-json-error";
import * as logger from "koa-logger";
import * as mongoose from "mongoose";
import { appConfig } from "./config";

const {
  production,
  host,
  port,
  httpsConfig,
  mongodbUri,
} = appConfig()

mongoose.connect(mongodbUri, { useNewUrlParser: true })

const app = new Koa()

app.use(cors())
app.use(bodyparser({
  enableTypes: ["json"],
}))
app.use(jsonerror({
  postFormat: (e, obj) => {
    if (production) {
      delete obj.stack
    }

    return obj
  },
}))

if (!production) {
  app.use(logger())
}

import routers from "./routes";

for (const router of routers) {
  app.use(router.routes())
  app.use(router.allowedMethods())
}

const handler = app.callback()

if (production && httpsConfig) {
  http2.createSecureServer(httpsConfig, handler).listen(port, host)
} else {
  http.createServer(handler).listen(port, host)
}
