import { Application } from "express";
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

export default function register(app: Application) {
  app.get("/trivia/questions", async (req, res) => {
    const shuffled = (req.query.shuffled !== "false")
    const count = req.query.count ? Number(req.query.count) : undefined

    delete req.query.shuffled
    delete req.query.count

    const docQuery = Question.find(req.query)

    if (!shuffled) {
      docQuery.sort({ createdAt: "desc" })
    }

    const questions = await docQuery.lean()

    if (shuffled) {
      shuffle(questions)
    }

    res.send(questions.slice(0, count))
  })

  app.post("/trivia/questions", async (req, res) => {
    res.status(201).json(await new Question(req.body).save()).end()
  })

  app.post("/trivia/import-questions", async (req, res) => {
    await Question.create(req.body)

    res.end()
  })

  app.get("/trivia/questions/:id", async (req, res) => {
    const question = await Question.findById(req.params.id).lean()

    if (!question) {
      throw { status: 404 }
    }

    res.send(question)
  })

  app.put("/trivia/questions/:id", JWT, PERM("trivia"), async (req, res) => {
    const question = await Question.findById(req.params.id)

    if (!question) {
      throw { status: 404 }
    }

    if (req.body.verified && !question.verified) {
      await Report.deleteMany({ question: mongoose.Types.ObjectId(req.params.id) })
    }

    await question.update(req.body)

    res.status(204).end()
  })

  app.delete("/trivia/questions/:id", JWT, PERM("trivia"), async (req, res) => {
    await Question.deleteOne({ _id: req.params.id })

    await Report.deleteMany({ question: mongoose.Types.ObjectId(req.params.id) })

    res.status(204).end()
  })

  app.get("/trivia/questions/:id/reports", JWT, PERM("trivia"), async (req, res) => {
    const conditions = {
      question: mongoose.Types.ObjectId(req.params.id),
    }

    res.send(await Report.find(conditions).sort({ createdAt: "desc" }).lean())
  })

  app.post("/trivia/questions/:id/reports", async (req, res) => {
    const question = await Question.findById(req.params.id)

    if (!question || question.verified) {
      throw { status: 400 }
    }

    Object.assign(req.body, { question: req.params.id })

    res.status(201).json(await new Report(req.body).save()).end()
  })

  app.get("/trivia/categories", async (req, res) => {
    res.send(await Question.distinct("category"))
  })

  app.get("/trivia/reports", JWT, PERM("trivia"), async (req, res) => {
    res.status(200).json(await Report.find(req.query)).end()
  })

  app.get("/trivia/reported-questions", JWT, PERM("trivia"), async (req, res) => {
    res.send(Question.find().where("_id").in(await Report.distinct("question")).lean())
  })

  app.get("/trivia/statistics", async (_0, res) => {
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

    res.send({
      questionCount,
      categoryCount,
      countOfQuestionsAddedThisMonth,
      topCategories,
      topSubmitters,
      dailyQuestions,
    })
  })
}
