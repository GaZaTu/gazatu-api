import * as http from "http";
import * as http2 from "http2"; // is basically https
import * as Koa from "koa";
import * as cors from "@koa/cors";
// import * as bodyparser from "koa-bodyparser";
// import * as jsonerror from "koa-json-error";
import * as logger from "koa-logger";
import * as mongoose from "mongoose";
import * as routing from "routing-controllers";
import { appConfig } from "./config";
import { authorizationChecker, currentUserChecker } from "./controllers/AuthController";

const {
  production,
  host,
  port,
  httpsConfig,
  mongodbUri,
} = appConfig()

mongoose.connect(mongodbUri, { useNewUrlParser: true })

const app = new Koa()

app.use(cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
}))

// app.use(bodyparser({
//   enableTypes: ["json"],
// }))

// app.use(jsonerror({
//   postFormat: (e, obj) => {
//     if (production) {
//       delete obj.stack
//     }

//     return obj
//   },
// }))

if (!production) {
  app.use(logger())
}

routing.useKoaServer(app, {
  development: !production,
  controllers: [__dirname + "/controllers/**/*.js"],
  // cors: {
  //   origin: "*",
  //   allowHeaders: ["Content-Type", "Authorization"],
  // },
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

if (production && httpsConfig) {
  Object.assign(httpsConfig, { allowHTTP1: true })

  http2.createSecureServer(httpsConfig, app.callback()).listen(port, host)
} else {
  http.createServer(app.callback()).listen(port, host)
}
