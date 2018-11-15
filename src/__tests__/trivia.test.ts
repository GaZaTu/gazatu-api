import * as request from "supertest";
import * as mongoose from "mongoose";
import { Mockgoose } from "mockgoose";
import { RestartableApp } from "../app";
import { Question, Report } from "../models/trivia.model";
import { User } from "../models/user.model";
import { signJwt } from "../controllers/AuthController";
import { normalizeUser, denormalizeUser } from "../controllers/UserController";

const mockgoose = new Mockgoose(mongoose)
const app = new RestartableApp()

let bearerTokenWithoutPermission = ""
let bearerTokenWithPermission = ""

beforeAll(async () => {
  await mockgoose.prepareStorage()
  await mongoose.connect("mongodb://localhost:27017/gazatu-api")
  await app.listen(false)
})

afterAll(async () => {
  await app.close()
  await mockgoose.helper.reset()
})

beforeEach(async () => {
  await mockgoose.helper.reset()

  let user = await new User({ username: "test1", password: "test1" }).save()
  let token = await signJwt(normalizeUser(user.toObject()))

  bearerTokenWithoutPermission = `Bearer ${token}`

  user = await new User({ username: "test2", password: "test2" }).save()
  const userData = user.toObject()
  userData.permissions = ["trivia"]
  await user.update({ permissions: (await denormalizeUser(userData)).permissions })
  user = (await User.findById(user._id))!
  token = await signJwt(normalizeUser(user.toObject()))

  bearerTokenWithPermission = `Bearer ${token}`
})

describe("trivia route tests", () => {
  test("GET /trivia/questions 0", async () => {
    const response = await request(app.server).get("/trivia/questions")

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(0)
  })

  test("GET /trivia/questions 1", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const response = await request(app.server).get("/trivia/questions")

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(1)
    expect(response.body[0].question).toBe(question.question)
    expect(response.body[0].answer).toBe(question.answer)
    expect(response.body[0].category).toBe(question.category)
    expect(response.body[0]._id).toBe(`${question._id}`)
  })

  test("GET /trivia/questions not shuffled", async () => {
    const questions = [
      await new Question({ question: "question1", answer: "answer1", category: "category1" }).save(),
      await new Question({ question: "question2", answer: "answer2", category: "category2" }).save(),
      await new Question({ question: "question3", answer: "answer3", category: "category3" }).save(),
      await new Question({ question: "question4", answer: "answer4", category: "category4" }).save(),
      await new Question({ question: "question5", answer: "answer5", category: "category5" }).save(),
    ]

    const response = await request(app.server).get("/trivia/questions?shuffled=false")

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(5)

    const copiedBody = JSON.parse(JSON.stringify(response.body))
    const body = response.body.sort((a: any, b: any) => (new Date(b.updatedAt) as any) - (new Date(a.updatedAt) as any))
    
    expect(JSON.stringify(body)).toBe(JSON.stringify(copiedBody))
  })

  test("GET /trivia/questions shuffled", async () => {
    const questions = [
      await new Question({ question: "question1", answer: "answer1", category: "category1" }).save(),
      await new Question({ question: "question2", answer: "answer2", category: "category2" }).save(),
      await new Question({ question: "question3", answer: "answer3", category: "category3" }).save(),
      await new Question({ question: "question4", answer: "answer4", category: "category4" }).save(),
      await new Question({ question: "question5", answer: "answer5", category: "category5" }).save(),
    ]

    const responses = [
      await request(app.server).get("/trivia/questions"),
      await request(app.server).get("/trivia/questions"),
      await request(app.server).get("/trivia/questions?shuffled=true"),
      await request(app.server).get("/trivia/questions?shuffled=true"),
    ]

    let differentCount = 0

    for (const response of responses) {
      expect(response.status).toBe(200)
      expect(response.type).toBe("application/json")
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body).toHaveLength(5)

      differentCount += responses
        .filter(r => r !== response)
        .filter(r => JSON.stringify(r.body) !== JSON.stringify(response.body))
        .length
    }

    expect(differentCount).toBeGreaterThanOrEqual(9)
  })

  test("GET /trivia/questions/:id existing", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const response = await request(app.server).get(`/trivia/questions/${question._id}`)

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.question).toBe(question.question)
    expect(response.body.answer).toBe(question.answer)
    expect(response.body.category).toBe(question.category)
    expect(response.body._id).toBe(`${question._id}`)
  })

  test("GET /trivia/questions/:id invalid-id", async () => {
    const response = await request(app.server).get(`/trivia/questions/1`)

    expect(response.status).toBe(500) // TODO: this should be 400
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.kind).toBe("ObjectId")
    expect(response.body.message).toContain("Cast to ObjectId failed")
  })

  test("GET /trivia/questions/:id not-existing", async () => {
    const response = await request(app.server).get(`/trivia/questions/5be86721a5c3a002fbda56ac`)

    expect(response.status).toBe(404)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("NotFoundError")
  })

  test("POST /trivia/questions valid", async () => {
    const data = { question: "question1", answer: "answer1", category: "category1" }
    const response = await request(app.server).post(`/trivia/questions`).send(data)

    expect(response.status).toBe(201)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body._id).toBeDefined()
    expect(response.body.question).toBe(data.question)
    expect(response.body.answer).toBe(data.answer)
    expect(response.body.category).toBe(data.category)
  })

  test("POST /trivia/questions invalid", async () => {
    const data = { question: "question1", category: "category1" }
    const response = await request(app.server).post(`/trivia/questions`).send(data)

    expect(response.status).toBe(500) // TODO: this should be 400
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("ValidationError")
    expect(response.body.message).toBe("QuestionSchema validation failed: answer: Path `answer` is required.")
  })

  test("PUT /trivia/questions/:id not-authenticated", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const data = { answer: "answer2" }
    const response = await request(app.server).put(`/trivia/questions/${question._id}`).send(data)

    expect(response.status).toBe(403)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("AccessDeniedError")

    const updatedQuestion = await Question.findById(question._id)

    expect(updatedQuestion).not.toBeNull()
    expect(updatedQuestion!.question).toBe(question.question)
    expect(updatedQuestion!.answer).toBe(question.answer)
    expect(updatedQuestion!.answer).not.toBe(data.answer)
  })

  test("PUT /trivia/questions/:id no-permission", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const data = { answer: "answer2" }
    const response = await request(app.server).put(`/trivia/questions/${question._id}`).send(data).set("Authorization", bearerTokenWithoutPermission)

    expect(response.status).toBe(403)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("AccessDeniedError")

    const updatedQuestion = await Question.findById(question._id)

    expect(updatedQuestion).not.toBeNull()
    expect(updatedQuestion!.question).toBe(question.question)
    expect(updatedQuestion!.answer).toBe(question.answer)
    expect(updatedQuestion!.answer).not.toBe(data.answer)
  })

  test("PUT /trivia/questions/:id valid", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const data = { answer: "answer2" }
    const response = await request(app.server).put(`/trivia/questions/${question._id}`).send(data).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(204)
    expect(response.type).not.toBe("application/json")

    const updatedQuestion = await Question.findById(question._id)

    expect(updatedQuestion).not.toBeNull()
    expect(updatedQuestion!.question).toBe(question.question)
    expect(updatedQuestion!.answer).not.toBe(question.answer)
    expect(updatedQuestion!.answer).toBe(data.answer)
  })

  test("PUT /trivia/questions/:id not-existing", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const data = { answer: "answer2" }
    const response = await request(app.server).put(`/trivia/questions/5be86721a5c3a002fbda56ab`).send(data).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(404)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("NotFoundError")

    const updatedQuestion = await Question.findById(question._id)

    expect(updatedQuestion).not.toBeNull()
    expect(updatedQuestion!.question).toBe(question.question)
    expect(updatedQuestion!.answer).toBe(question.answer)
    expect(updatedQuestion!.answer).not.toBe(data.answer)
  })

  test("DELETE /trivia/questions/:id not-authenticated", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const response = await request(app.server).delete(`/trivia/questions/${question._id}`)

    expect(response.status).toBe(403)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("AccessDeniedError")

    const updatedQuestion = await Question.findById(question._id)

    expect(updatedQuestion).not.toBeNull()
  })

  test("DELETE /trivia/questions/:id no-permission", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const response = await request(app.server).delete(`/trivia/questions/${question._id}`).set("Authorization", bearerTokenWithoutPermission)

    expect(response.status).toBe(403)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("AccessDeniedError")

    const updatedQuestion = await Question.findById(question._id)

    expect(updatedQuestion).not.toBeNull()
  })

  test("DELETE /trivia/questions/:id valid", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const response = await request(app.server).delete(`/trivia/questions/${question._id}`).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(204)
    expect(response.type).not.toBe("application/json")

    const updatedQuestion = await Question.findById(question._id)

    expect(updatedQuestion).toBeNull()
  })

  test("DELETE /trivia/questions/:id not-existing", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const response = await request(app.server).delete(`/trivia/questions/5be86721a5c3a002fbda56ab`).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(204)
    expect(response.type).not.toBe("application/json")

    const updatedQuestion = await Question.findById(question._id)

    expect(updatedQuestion).not.toBeNull()
  })

  test("GET /trivia/questions/:id/reports not-authorized", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const response = await request(app.server).get(`/trivia/questions/${question._id}/reports`)

    expect(response.status).toBe(403)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("AccessDeniedError")
  })

  test("GET /trivia/questions/:id/reports no-permission", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const response = await request(app.server).get(`/trivia/questions/${question._id}/reports`).set("Authorization", bearerTokenWithoutPermission)

    expect(response.status).toBe(403)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("AccessDeniedError")
  })

  test("GET /trivia/questions/:id/reports 0", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const response = await request(app.server).get(`/trivia/questions/${question._id}/reports`).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(0)
  })

  test("GET /trivia/questions/:id/reports 1", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const report = await new Report({ question: question._id, message: "message1", submitter: "submitter1" }).save()
    const response = await request(app.server).get(`/trivia/questions/${question._id}/reports`).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(1)
    expect(response.body[0].question).toBe(`${report.question}`)
    expect(response.body[0].message).toBe(report.message)
    expect(response.body[0].submitter).toBe(report.submitter)
    expect(response.body[0]._id).toBe(`${report._id}`)
  })

  test("GET /trivia/questions/:id/reports not-existing", async () => {
    const response = await request(app.server).get(`/trivia/questions/5be86721a5c3a002fbda56ab/reports`).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(404)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("NotFoundError")
  })

  test("POST /trivia/questions/:id/reports valid", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const data = { message: "message1", submitter: "submitter1" }
    const response = await request(app.server).post(`/trivia/questions/${question._id}/reports`).send(data)

    expect(response.status).toBe(201)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body._id).toBeDefined()
    expect(response.body.message).toBe(data.message)
    expect(response.body.submitter).toBe(data.submitter)
  })

  test("POST /trivia/questions/:id/reports invalid", async () => {
    const question = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const data = { submitter: "submitter1" }
    const response = await request(app.server).post(`/trivia/questions/${question._id}/reports`).send(data)

    expect(response.status).toBe(500) // TODO: this should be 400
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("ValidationError")
  })

  test("POST /trivia/questions/:id/reports not-existing", async () => {
    const data = { message: "message1", submitter: "submitter1" }
    const response = await request(app.server).post(`/trivia/questions/5be86721a5c3a002fbda56ab/reports`).send(data)

    expect(response.status).toBe(404)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("NotFoundError")
  })

  test("GET /trivia/categories 0", async () => {
    const response = await request(app.server).get(`/trivia/categories`)

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(0)
  })

  test("GET /trivia/categories 4", async () => {
    await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    await new Question({ question: "question2", answer: "answer2", category: "category2" }).save()
    await new Question({ question: "question3", answer: "answer3", category: "category1" }).save()
    await new Question({ question: "question4", answer: "answer4", category: "category3" }).save()

    const response = await request(app.server).get(`/trivia/categories`)

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(3)
    expect(response.body.includes("category1")).toBe(true)
    expect(response.body.includes("category2")).toBe(true)
    expect(response.body.includes("category3")).toBe(true)
  })

  test("GET /trivia/reports no-permission", async () => {
    const response = await request(app.server).get(`/trivia/reports`).set("Authorization", bearerTokenWithoutPermission)

    expect(response.status).toBe(403)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("AccessDeniedError")
  })

  test("GET /trivia/reports 0", async () => {
    const response = await request(app.server).get(`/trivia/reports`).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(0)
  })

  test("GET /trivia/reports 2", async () => {
    const question1 = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const report1 = await new Report({ question: question1._id, message: "message1", submitter: "submitter1" }).save()
    const question2 = await new Question({ question: "question2", answer: "answer2", category: "category2" }).save()
    const report2 = await new Report({ question: question2._id, message: "message2", submitter: "submitter2" }).save()
    const response = await request(app.server).get(`/trivia/reports`).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(2)
    expect(response.body.find((r: any) => r._id === `${report1._id}`)).toBeTruthy()
    expect(response.body.find((r: any) => r._id === `${report2._id}`)).toBeTruthy()
  })

  test("GET /trivia/reported-questions no-permission", async () => {
    const response = await request(app.server).get(`/trivia/reported-questions`).set("Authorization", bearerTokenWithoutPermission)

    expect(response.status).toBe(403)
    expect(response.type).toBe("application/json")
    expect(typeof response.body).toBe("object")
    expect(response.body.name).toBe("AccessDeniedError")
  })

  test("GET /trivia/reported-questions 2", async () => {
    const question1 = await new Question({ question: "question1", answer: "answer1", category: "category1" }).save()
    const report1 = await new Report({ question: question1._id, message: "message1", submitter: "submitter1" }).save()
    const question2 = await new Question({ question: "question2", answer: "answer2", category: "category2" }).save()
    const report2 = await new Report({ question: question2._id, message: "message2", submitter: "submitter2" }).save()
    const response = await request(app.server).get(`/trivia/reported-questions`).set("Authorization", bearerTokenWithPermission)

    expect(response.status).toBe(200)
    expect(response.type).toBe("application/json")
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body).toHaveLength(2)
    expect(response.body.find((q: any) => q._id === `${question1._id}`)).toBeTruthy()
    expect(response.body.find((q: any) => q._id === `${question2._id}`)).toBeTruthy()
  })
})
