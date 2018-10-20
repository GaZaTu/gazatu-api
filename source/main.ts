import * as spdy from "spdy";
import * as fs from "fs";
import * as express from "express";
import * as cors from "cors";
import * as bodyparser from "body-parser";
import { Request, Response, NextFunction } from "express";
import "express-async-errors";
import * as mongoose from "mongoose";

mongoose.connect("mongodb://localhost:27017/gazatu-api")

import registerAuth from "./routes/auth";
import registerTrivia from "./routes/trivia";

const PRODUCTION = (process.env.NODE_ENV === "production")
const PORT = PRODUCTION ? 8080 : 8081
const HOST = "0.0.0.0"
const app = express()

app.use(cors())
app.use(bodyparser.json())

app.options('*', cors({
  allowedHeaders: ["Content-Type", "Authorization"],
}))

registerTrivia(app)
registerAuth(app)

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status((err as any).status || 400).json(err).end()
})

const server = PRODUCTION ? spdy.createServer({
  key: fs.readFileSync("/etc/letsencrypt/live/gazatu.win/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/gazatu.win/cert.pem"),
  ca: [fs.readFileSync("/etc/letsencrypt/live/gazatu.win/fullchain.pem")],
}, app) : app as any

server.listen(PORT, HOST, () => console.log("ready"))
