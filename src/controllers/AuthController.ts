import { JsonController, Body, Post, BadRequestError, Action, HttpCode } from "routing-controllers";
import * as koa from "koa";
import * as koajwt from "koa-jwt";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { appConfig } from "../config";
import { promisify } from "util";

const {
  jwtSecret,
  masterUser,
} = appConfig()

const jwtVerify = promisify(jwt.verify)

export function userHasPermissions(user: any, roles: string[]) {
  if (!user) {
    return false
  }

  if (user.username !== masterUser) {
    const userPermissions = user.permissions.map((p: any) => p.name)

    for (const permission of roles) {
      if (!userPermissions.includes(permission)) {
        return false
      }
    }
  }

  return true
}

export async function authorizationChecker(action: Action, roles: string[]) {
  const authorization = action.request.headers["authorization"]

  if (!authorization) {
    return false
  }

  const token = authorization.slice("Bearer ".length)
  const parsedToken = await jwtVerify(token, jwtSecret)

  if (parsedToken && typeof parsedToken === "object") {
    const user = await User.findById((parsedToken as any)._id).populate("permissions").lean()
    
    return userHasPermissions(user, roles)
  } else {
    return false
  }
}

export async function currentUserChecker(action: Action) {
  const authorization = action.request.headers["authorization"]

  if (authorization) {
    const token = authorization.slice("Bearer ".length)
    const parsedToken = await jwtVerify(token, jwtSecret)

    if (parsedToken && typeof parsedToken === "object") {
      return await User.findById((parsedToken as any)._id)
    }
  }

  return null
}

interface AuthData {
  username: string
  password: string
}

@JsonController()
export class AuthController {
  @HttpCode(201)
  @Post("/register")
  async register(@Body() auth: AuthData) {
    const password = await bcrypt.hash(auth.password, 10)

    const user = await new User({
      username: auth.username,
      password: password,
    }).save()

    delete user.password

    return user
  }

  @Post("/authenticate")
  async authenticate(@Body() auth: AuthData) {
    const user = await User.findOne({ username: auth.username }).populate("permissions").lean()

    if (user) {
      const isSame = await bcrypt.compare(auth.password, user.password)

      if (isSame) {
        user.isMaster = (user.username === masterUser)

        delete user.password

        user.permissions = user.permissions.map((perm: any) => perm.name)

        const token = jwt.sign(user, jwtSecret)

        return { user, token }
      }
    }

    throw new BadRequestError("invalid login")
  }
}
