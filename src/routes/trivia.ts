import * as KoaRouter from "koa-router";
import * as mongoose from "mongoose";
import { JWT, PERM } from "./auth";
import { Question, Report } from "../models/trivia.model";

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

      ;[a[i], a[j]] = [a[j], a[i]]
  }

  return a
}

const router = new KoaRouter()
export default router

router.get("/trivia/questions", async ctx => {
  const shuffled = (ctx.query.shuffled !== "false")
  const count = ctx.query.count ? Number(ctx.query.count) : undefined

  delete ctx.query.shuffled
  delete ctx.query.count

  const docQuery = Question.find(ctx.query)

  if (!shuffled) {
    docQuery.sort({ createdAt: "desc" })
  }

  const questions = await docQuery.lean()

  if (shuffled) {
    shuffle(questions)
  }

  ctx.body = questions.slice(0, count)
})

router.post("/trivia/questions", async ctx => {
  ctx.body = await new Question(ctx.request.body).save()
  ctx.status = 201
})

router.get("/trivia/questions/:id", async ctx => {
  const question = await Question.findById(ctx.params.id).lean()

  if (question) {
    ctx.body = question
  } else {
    ctx.throw(404)
  }
})

router.put("/trivia/questions/:id", JWT, PERM("trivia"), async ctx => {
  const question = await Question.findById(ctx.params.id)
  const json = (ctx.request.body as any) || ctx.throw(400, "request.body can't be empty")

  if (question) {
    if (json.verified && !question.verified) {
      await Report.deleteMany({ question: mongoose.Types.ObjectId(ctx.params.id) })
    }

    await question.update(ctx.request.body)

    ctx.status = 204
  } else {
    ctx.throw(404)
  }
})

router.delete("/trivia/questions/:id", JWT, PERM("trivia"), async ctx => {
  await Question.deleteOne({ _id: ctx.params.id })

  await Report.deleteMany({ question: mongoose.Types.ObjectId(ctx.params.id) })

  ctx.status = 204
})

router.get("/trivia/questions/:id/reports", JWT, PERM("trivia"), async ctx => {
  const conditions = {
    question: mongoose.Types.ObjectId(ctx.params.id),
  }

  ctx.body = await Report.find(conditions).sort({ createdAt: "desc" }).lean()
  ctx.status = 200
})

router.post("/trivia/questions/:id/reports", async ctx => {
  const question = await Question.findById(ctx.params.id)

  if (!question || question.verified) {
    ctx.throw(400)
  }

  Object.assign(ctx.request.body, { question: ctx.params.id })

  ctx.body = await new Report(ctx.request.body).save()
  ctx.status = 201
})

router.get("/trivia/categories", async ctx => {
  ctx.body = await Question.distinct("category").lean()
  ctx.status = 200
})

router.get("/trivia/reports", JWT, PERM("trivia"), async ctx => {
  ctx.body = await Report.find(ctx.query).lean()
  ctx.status = 200
})

router.get("/trivia/reported-questions", JWT, PERM("trivia"), async ctx => {
  ctx.body = await Question.find().where("_id").in(await Report.distinct("question")).lean()
  ctx.status = 200
})

router.get("/trivia/statistics", async ctx => {
  const questionCount = await Question.estimatedDocumentCount()
  const categoryCount = await Question.distinct("category").estimatedDocumentCount()
  const countOfQuestionsAddedThisMonth = await Question.aggregate([
    {
      $project: {
        month: { $month: "$createdAt" },
        week: { $week: "$createdAt" },
      },
    },
    {
      $match: {
        month: new Date().getMonth(),
      },
    },
    {
      $count: "questionsAddedThisMonth",
    },
    // {
    //   $match: {
    //     week: new Date().get
    //   },
    // },
    // {
    //   $count: "questionsAddedThisWeek",
    // },
  ])
  const topCategories = await Question.aggregate([
    {
      $group: {
        _id: { category: "$category" },
        count: { $sum: 1 },
      },
    },
    {
      $limit: 3,
    },
  ])
  const topSubmitters = await Question.aggregate([
    {
      $group: {
        _id: { category: "$submitter" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        count: "desc",
      },
    },
    {
      $limit: 3,
    },
  ])
  const dailyQuestions = await Question.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date().setFullYear(new Date().getFullYear() - 1) },
      },
    },
    {
      $group: {
        _id: { createdAt: "$createdAt" },
      },
    },
    {
      $sort: {
        date: "asc",
      },
    },
  ])

  ctx.body = {
    questionCount,
    categoryCount,
    countOfQuestionsAddedThisMonth,
    topCategories,
    topSubmitters,
    dailyQuestions,
  }
})
