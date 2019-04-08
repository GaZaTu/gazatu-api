import { Typegoose, prop, Ref } from "typegoose";
import { UserSchema } from "./user.model";

export class QuestionSchema extends Typegoose {
  @prop({ required: true })
  question!: string
  @prop({ required: true, trim: true })
  answer!: string
  @prop({ required: true, index: true, trim: true })
  category!: string
  @prop()
  hint1?: string
  @prop()
  hint2?: string
  @prop()
  submitter?: string
  @prop({ ref: UserSchema })
  user?: Ref<UserSchema>
  @prop({ required: true, default: false })
  verified!: boolean
  @prop({ required: true, default: false })
  disabled!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export class ReportSchema extends Typegoose {
  @prop({ required: true, index: true, ref: QuestionSchema })
  question!: Ref<QuestionSchema>
  @prop({ required: true })
  message!: string
  @prop({ required: true })
  submitter!: string
  @prop({ ref: UserSchema })
  user?: Ref<UserSchema>

  createdAt!: Date
  updatedAt!: Date
}

export const Question = new QuestionSchema().getModelForClass(QuestionSchema, { schemaOptions: { timestamps: true } })
export const Report = new ReportSchema().getModelForClass(ReportSchema, { schemaOptions: { timestamps: true } })
