import * as koa from "koa";
import * as koajwt from "koa-jwt";
import * as KoaRouter from "koa-router";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { promisify } from "util";
import { User } from "../models/auth.model";
import { appConfig } from "../config";

export const JWT = koajwt({ secret: appConfig().jwtSecret })

export function userHasPermissions(ctx: koa.Context, ...needs: string[]) {
  if (!ctx.state.user.isMaster) {
    for (const permission of needs) {
      if (!ctx.state.user.permissions.includes(permission)) {
        return false
      }
    }
  }

  return true
}

export function PERM(...needs: string[]): koa.Middleware {
  return async (ctx, next) => {
    if (!userHasPermissions(ctx, ...needs)) {
      ctx.throw(403, `user needs following tags: ${needs.join(", ")}`)
    }

    await next()
  }
}

interface AuthData {
  username: string
  password: string
}

const router = new KoaRouter()
export default router

router.post("/register", async ctx => {
  const data = ctx.request.body as AuthData
  const password = await promisify(bcrypt.hash)(data.password, 10)

  data.password = password

  const user = await new User(data).save()

  delete user.password

  ctx.body = user
  ctx.status = 201
})

router.post("/authenticate", async ctx => {
  const data = ctx.request.body as AuthData
  const user = await User.findOne({ username: data.username }).populate("permissions").lean()

  if (user) {
    const isSame = await promisify(bcrypt.compare)(data.password, user.password)

    if (isSame) {
      user.isMaster = (user.username === appConfig().masterUser)

      delete user.password

      const token = await promisify(jwt.sign)(user, appConfig().jwtSecret)

      ctx.body = { user, token }

      return
    }
  }

  ctx.throw(400, "invalid login")
})

router.get("/users", JWT, PERM("users"), async ctx => {
  ctx.body = await User.find(ctx.query).lean()
})

router.get("/users/:id", async ctx => {
  const user = await User.findById(ctx.params.id).populate("permissions").lean()

  if (!user || user._id !== ctx.state.user.userId) {
    if (!userHasPermissions(ctx, "users")) {
      return
    }
  }

  ctx.body = user
})

router.put("/users/:id", async ctx => {
  const user = await User.findById(ctx.params.id)

  if (!user || user._id !== ctx.state.user.userId) {
    if (!userHasPermissions(ctx, "users")) {
      return
    }
  }

  if (user) {
    user.update(ctx.request.body)
  }
})

router.delete("/users/:id", async ctx => {
  const user = await User.findById(ctx.params.id)

  if (!user || user._id !== ctx.state.user.userId) {
    if (!userHasPermissions(ctx, "users")) {
      return
    }
  }

  if (user) {
    user.remove()
  }
})
