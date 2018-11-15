import { JsonController, Body, Post, BadRequestError, Action, HttpCode } from "routing-controllers";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { appConfig } from "../config";
import { normalizeUser } from "./UserController";

const {
  jwtSecret,
  masterUser,
} = appConfig()

interface JwtUserData {
  username: string
  permissions: string[]
  isMaster?: boolean
}

export function verifyJwt(token: string) {
  return new Promise<JwtUserData>((resolve, reject) => {
    jwt.verify(token, jwtSecret, (err, res) => {
      err ? reject(err) : resolve(res as any)
    })
  })
}

export function signJwt(user: JwtUserData) {
  return new Promise<string>((resolve, reject) => {
    jwt.sign(user, jwtSecret, (err, res) => {
      err ? reject(err) : resolve(res as any)
    })
  })
}

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

  try {
    const token = authorization.slice("Bearer ".length)
    const parsedToken = await verifyJwt(token)

    if (parsedToken && typeof parsedToken === "object") {
      const user = await User.findById((parsedToken as any)._id).populate("permissions").lean()

      return userHasPermissions(user, roles)
    } else {
      return false
    }
  } catch {
    return false
  }
}

export async function currentUserChecker(action: Action) {
  const authorization = action.request.headers["authorization"]

  if (authorization) {
    try {
      const token = authorization.slice("Bearer ".length)
      const parsedToken = await verifyJwt(token)

      if (parsedToken && typeof parsedToken === "object") {
        return await User.findById((parsedToken as any)._id)
      }
    } catch {
      return null
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

        const token = await signJwt(normalizeUser(user))

        return { user, token }
      }
    }

    throw new BadRequestError("invalid login")
  }
}
