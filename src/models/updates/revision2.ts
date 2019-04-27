import { MetaInfo, Language } from "../meta.model";
import { Question } from "../trivia.model";

(async () => {
  if (await MetaInfo.getDatabaseRevision() === 2) {
    await MetaInfo.incrementDatabaseRevision()

    const english = await new Language({
      name: 'English',
      code: 'en',
    }).save()

    Question.updateMany({}, {
      language: english._id,
    })
  }
})
