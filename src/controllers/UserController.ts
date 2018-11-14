import { JsonController, Param, Body, Get, Put, Delete, QueryParams, Authorized, OnUndefined, NotFoundError, CurrentUser, UnauthorizedError } from "routing-controllers";
import { User, UserPermission } from "../models/user.model";
import { userHasPermissions } from "./AuthController";

@JsonController()
export class UserController {
  @Authorized("users")
  @Get("/users")
  async getAll(@QueryParams() query: any) {
    const users = await User.find(query).populate("permissions").lean()

    for (const user of users) {
      user.permissions = user.permissions.map((perm: any) => perm.name)
    }

    return users
  }

  @Get("/users/:id")
  async getOne(@CurrentUser() currentUser: any, @Param("id") id: string) {
    const hasPermission = userHasPermissions(currentUser, ["users"])
    const user = await User.findById(id).populate("permissions").lean()

    if (!hasPermission && (!user || `${user._id}` !== `${currentUser._id}`)) {
      throw new UnauthorizedError()
    }

    if (!user) {
      throw new NotFoundError()
    }

    user.permissions = user.permissions.map((perm: any) => perm.name)

    return user
  }

  // @Post("/users")
  // post(@Body() user: User) {
  //   return userRepository.insert(user);
  // }

  // @Put("/users/:id")
  // put(@Param("id") id: string, @Body() user: User) {
  //   return userRepository.updateById(id, user);
  // }

  @OnUndefined(204)
  @Delete("/users/:id")
  async remove(@CurrentUser() currentUser: any, @Param("id") id: string) {
    const hasPermission = userHasPermissions(currentUser, ["users"])
    const user = await User.findById(id)

    if (!hasPermission && (!user || `${user._id}` !== `${currentUser._id}`)) {
      throw new UnauthorizedError()
    }

    if (user) {
      await user.remove()
    } else {
      throw new NotFoundError()
    }
  }

  @Get("/permissions")
  async getAllPermissions() {
    return await UserPermission.distinct("name")
  }

  @Authorized("users")
  @Get("/users/:id/permissions")
  async getAllUserPermissions(@Param("id") id: string) {
    const user = await User.findById(id).populate("permissions").lean()

    if (user) {
      return user.permissions.map((perm: any) => perm.name)
    }
  }

  @Authorized("users")
  @OnUndefined(204)
  @Put("/users/:id/permissions")
  async setAllUserPermissions(@Param("id") id: string, @Body({ required: false }) permissions: string[]) {
    const user = await User.findById(id)

    if (user) {
      const permissionIds = permissions.map(async name => {
        let perm = await UserPermission.findOne({ name })

        if (perm) {
          return perm._id
        } else {
          let perm = await new UserPermission({ name }).save()

          return perm._id
        }
      })

      await user.update({ permissions: await Promise.all(permissionIds) })
    }
  }
}
