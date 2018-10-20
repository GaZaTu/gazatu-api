import * as jwt from "jsonwebtoken";
import * as express from "express";
import * as expressJwt from "express-jwt";
import * as bcrypt from "bcryptjs";
import { promisify } from "util";
import { User } from "../models/auth.model";
import { readFileSync } from "fs";

class ForbiddenError extends Error {
  status = 403
}

const SECRET = JSON.parse(readFileSync(__dirname + "/../../config.json").toString()).jwtSecret
export const JWT = expressJwt({ secret: SECRET })

export function PERM(...needs: string[]) {
  return (req: express.Request, _1: express.Response, next: express.NextFunction) => {
    for (const permission of needs) {
      if (!req.user.permissions.includes(permission)) {
        next(new ForbiddenError(`user needs following tags: ${needs.join(", ")}`))
      }
    }

    next()
  }
}

interface AuthData {
  name: string
  password: string
}

export default function register(app: express.Application) {
  app.post("/register", async (req, res) => {
    const data = req.body as AuthData
    const password = await promisify(bcrypt.hash)(data.password, 10)

    data.password = password

    res.status(201).json(await new User(data).save()).end()
  })

  app.post("/authenticate", async (req, res) => {
    const data = req.body as AuthData
    const user = await User.findOne({ name: data.name }).populate("permissions").lean().exec()

    if (user) {
      const isSame = await promisify(bcrypt.compare)(data.password, user.password)
      
      if (isSame) {
        const token = await promisify(jwt.sign)(user, SECRET)

        res.json({ user, token }).end()

        return
      }
    }

    res.status(400).json({ message: "invalid login" }).end()
  })

  app.post("/import-users", async (req, res) => {
    await User.create(req.body)

    res.end()
  })
}
