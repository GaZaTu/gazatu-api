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

const CONFIG = JSON.parse(readFileSync(__dirname + "/../../config.json").toString())
const MASTER_USER = CONFIG.masterUser
const SECRET = CONFIG.jwtSecret

export const JWT = expressJwt({ secret: SECRET })

export function PERM(...needs: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user.isMaster) {
      for (const permission of needs) {
        if (!req.user.permissions.includes(permission)) {
          next(new ForbiddenError(`user needs following tags: ${needs.join(", ")}`))

          return false
        }
      }
    }

    next()

    return true
  }
}

interface AuthData {
  username: string
  password: string
}

export default function register(app: express.Application) {
  app.post("/register", async (req, res) => {
    const data = req.body as AuthData
    const password = await promisify(bcrypt.hash)(data.password, 10)

    data.password = password

    const user = await new User(data).save()

    delete user.password

    res.status(201).json(user).end()
  })

  app.post("/authenticate", async (req, res) => {
    const data = req.body as AuthData
    const user = await User.findOne({ username: data.username }).populate("permissions").lean()

    if (user) {
      const isSame = await promisify(bcrypt.compare)(data.password, user.password)
      
      if (isSame) {
        user.isMaster = (user.username === MASTER_USER)

        delete user.password

        const token = await promisify(jwt.sign)(user, SECRET)

        res.json({ user, token }).end()

        return
      }
    }

    res.status(400).json({ message: "invalid login" }).end()
  })

  app.get("/users", JWT, PERM("users"), async (req, res) => {
    res.send(await User.find(req.query).lean())
  })

  app.get("/users/:id", JWT, async (req, res, next) => {
    const user = await User.findById(req.params.id).populate("permissions").lean()

    if (!user || user._id !== req.user.userId) {
      if (!PERM("users")(req, res, next)) {
        return
      }
    }

    res.send(user)
  })

  app.put("/users/:id", JWT, async (req, res, next) => {
    const user = await User.findById(req.params.id)

    if (!user || user._id !== req.user.userId) {
      if (!PERM("users")(req, res, next)) {
        return
      }
    }

    if (user) {
      user.update(req.body)
    }

    res.status(204).end()
  })

  app.delete("/users/:id", JWT, async (req, res, next) => {
    const user = await User.findById(req.params.id)

    if (!user || user._id !== req.user.userId) {
      if (!PERM("users")(req, res, next)) {
        return
      }
    }

    if (user) {
      user.remove()
    }

    res.status(204).end()
  })

  app.post("/import-users", async (req, res) => {
    await User.create(req.body)

    res.end()
  })
}
