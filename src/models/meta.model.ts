import { Typegoose, prop, staticMethod, ModelType } from "typegoose";

export class LanguageSchema extends Typegoose {
  @prop({ required: true, index: true })
  code!: string
  @prop({ required: true })
  name!: string

  @staticMethod
  static async findByCode(this: ModelType<LanguageSchema> & typeof LanguageSchema, code: string) {
    return this.findOne({ code })
  }
}

export class MetaInfoSchema extends Typegoose {
  @prop({ required: true, index: true })
  key!: string
  @prop({ required: true })
  value!: any

  @staticMethod
  static async findByKey(this: ModelType<MetaInfoSchema> & typeof MetaInfoSchema, key: string) {
    return this.findOne({ key })
  }

  @staticMethod
  static async getDatabaseRevision(this: ModelType<MetaInfoSchema> & typeof MetaInfoSchema) {
    const revisionEntry = await this.findByKey('dbRevision')
    
    if (revisionEntry) {
      return revisionEntry.value as number
    } else {
      return 1
    }
  }

  @staticMethod
  static async incrementDatabaseRevision(this: ModelType<MetaInfoSchema> & typeof MetaInfoSchema) {
    let revisionEntry = await this.findByKey('dbRevision')

    if (revisionEntry) {
      revisionEntry.value += 1
    } else {
      revisionEntry = new MetaInfo({
        key: 'dbRevision',
        value: 1,
      })
    }

    await revisionEntry.save()
  }
}

export const Language = new LanguageSchema().getModelForClass(LanguageSchema)
export const MetaInfo = new MetaInfoSchema().getModelForClass(MetaInfoSchema)
