import { Typegoose, prop, arrayProp, Ref } from "typegoose";

export class PermissionSchema extends Typegoose {
  @prop({ required: true, unique: true })
  name!: string
}

export class UserSchema extends Typegoose {
  @prop({ required: true, unique: true })
  name!: string
  @prop({ required: true })
  password!: string
  @arrayProp({ required: true, default: [], itemsRef: PermissionSchema })
  permissions!: Ref<PermissionSchema>[]
}

export const Permission = new PermissionSchema().getModelForClass(PermissionSchema)
export const User = new UserSchema().getModelForClass(UserSchema)
