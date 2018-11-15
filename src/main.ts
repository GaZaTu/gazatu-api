import * as mongoose from "mongoose";
import { appConfig } from "./config";
import { RestartableApp } from "./app";

const {
  mongodbUri,
} = appConfig()

mongoose.connect(mongodbUri, { useNewUrlParser: true })

new RestartableApp().listen()
