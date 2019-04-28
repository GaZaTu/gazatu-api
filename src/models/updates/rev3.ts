import { Question } from "../trivia.model";

const rev = {
  rev: 3,
  code: async () => {
    await Question.updateMany({}, {
      language: "en",
    })
  },
}

export default rev
