import * as koa from "koa";
import * as koajwt from "koa-jwt";
import * as KoaRouter from "koa-router";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { User, Permission } from "../models/auth.model";
import { appConfig } from "../config";

const {
  jwtSecret,
  masterUser,
} = appConfig()

export const JWT = koajwt({ secret: jwtSecret })

function userHasPermissions(user: any, ...needs: string[]) {
  if (!user.isMaster) {
    for (const permission of needs) {
      if (!user.permissions.includes(permission)) {
        return false
      }
    }
  }

  return true
}

export function PERM(...needs: string[]): koa.Middleware {
  return async (ctx, next) => {
    if (!userHasPermissions(ctx.state.user, ...needs)) {
      ctx.throw(403, `user needs following tags: ${needs.join(", ")}`)
    }

    await next()
  }
}

function customUserVerification(ctx: koa.Context, user: { _id: any } | null) {
  const authorization = ctx.get("Authorization")

  if (authorization) {
    const token = jwt.verify(authorization.slice("Bearer ".length), jwtSecret) as any

    if (typeof token === "object") {
      if (!user || `${user._id}` !== token._id) {
        if (!userHasPermissions(token, "users")) {
          ctx.throw(403)
        }
      }
    }
  } else {
    ctx.throw(401)
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
  const password = await bcrypt.hash(data.password, 10)

  const user = await new User({
    username: data.username,
    password: password,
  }).save()

  delete user.password

  ctx.body = user
  ctx.status = 201
})

router.post("/authenticate", async ctx => {
  const data = ctx.request.body as AuthData
  const user = await User.findOne({ username: data.username }).populate("permissions").lean()

  if (user) {
    const isSame = await bcrypt.compare(data.password, user.password)

    if (isSame) {
      user.isMaster = (user.username === masterUser)

      delete user.password

      user.permissions = user.permissions.map((perm: any) => perm.name)

      const token = jwt.sign(user, jwtSecret)

      ctx.body = { user, token }

      return
    }
  }

  ctx.throw(400, "invalid login")
})

router.get("/users", JWT, PERM("users"), async ctx => {
  const users = await User.find(ctx.query).populate("permissions").lean()

  for (const user of users) {
    user.permissions = user.permissions.map((perm: any) => perm.name)
  }
  
  ctx.body = users
})

router.get("/users/:id", async ctx => {
  const user = await User.findById(ctx.params.id).populate("permissions").lean()

  customUserVerification(ctx, user)

  if (!user) {
    ctx.throw(404)
  }

  user.permissions = user.permissions.map((perm: any) => perm.name)

  ctx.body = user
})

// router.put("/users/:id", async ctx => {
//   const user = await User.findById(ctx.params.id)

//   customUserVerification(ctx, user)

//   if (user) {
//     await user.update(ctx.request.body)

//     ctx.status = 204
//   } else {
//     ctx.throw(404)
//   }
// })

router.delete("/users/:id", async ctx => {
  const user = await User.findById(ctx.params.id)

  customUserVerification(ctx, user)

  if (user) {
    await user.remove()

    ctx.status = 204
  } else {
    ctx.throw(404)
  }
})

router.get("/users/:id/permissions", JWT, PERM("users"), async ctx => {
  const user = await User.findById(ctx.params.id).populate("permissions").lean()

  if (user) {
    ctx.body = user.permissions.map((perm: any) => perm.name)
    ctx.status = 200
  }
})

router.put("/users/:id/permissions", JWT, PERM("users"), async ctx => {
  const user = await User.findById(ctx.params.id)

  if (user && ctx.request.body) {
    const permissions = ctx.request.body as string[]
    const permissionIds = permissions.map(async name => {
      let perm = await Permission.findOne({ name })

      if (perm) {
        return perm._id
      } else {
        let perm = await new Permission({ name }).save()

        return perm._id
      }
    })

    await user.update({ permissions: await Promise.all(permissionIds) })

    ctx.status = 204
  }
})

router.get("/permissions", async ctx => {
  ctx.body = await Permission.distinct("name")
  ctx.status = 200
})
