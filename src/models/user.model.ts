import { Typegoose, prop, arrayProp, Ref, staticMethod } from "typegoose";

export class UserPermissionSchema extends Typegoose {
  @prop({ required: true })
  name!: string
}

export class UserSchema extends Typegoose {
  @prop({ required: true, unique: true })
  username!: string
  @prop({ required: true })
  password!: string
  @arrayProp({ itemsRef: UserPermissionSchema, required: true, default: [] })
  permissions!: Ref<UserPermissionSchema>[]

  @staticMethod
  static findWithoutPassword(conditions?: any, options?: any) {
    return User.find(conditions, undefined, options).select({ username: 1 })
  }
}

export const UserPermission = new UserPermissionSchema().getModelForClass(UserPermissionSchema)
export const User = new UserSchema().getModelForClass(UserSchema)
