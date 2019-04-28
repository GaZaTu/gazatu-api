import { Language } from "../meta.model";
import { Question } from "../trivia.model";

const rev = {
  rev: 2,
  code: async () => {
    const english = await new Language({
      name: 'English',
      code: 'en',
    }).save()

    await Question.updateMany({}, {
      language: english._id,
    })
  },
}

export default rev
