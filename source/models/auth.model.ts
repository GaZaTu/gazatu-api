import { Typegoose, prop, arrayProp, Ref, staticMethod } from "typegoose";

export class PermissionSchema extends Typegoose {
  @prop({ required: true, unique: true })
  name!: string
}

export class UserSchema extends Typegoose {
  @prop({ required: true, unique: true })
  username!: string
  @prop({ required: true })
  password!: string
  @arrayProp({ required: true, default: [], itemsRef: PermissionSchema })
  permissions!: Ref<PermissionSchema>[]

  @staticMethod
  static findWithoutPassword(conditions?: any, options?: any) {
    return User.find(conditions, undefined, options).select({ username: 1 })
  }
}

export const Permission = new PermissionSchema().getModelForClass(PermissionSchema)
export const User = new UserSchema().getModelForClass(UserSchema)
