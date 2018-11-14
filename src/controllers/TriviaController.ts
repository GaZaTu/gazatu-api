import { JsonController, Param, Body, Get, Put, Delete, QueryParams, Post, Authorized, OnUndefined, NotFoundError, HttpCode, QueryParam } from "routing-controllers";
import * as mongoose from "mongoose";
import { Question, Report } from "../models/trivia.model";

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

      ;[a[i], a[j]] = [a[j], a[i]]
  }

  return a
}

@JsonController()
export class TriviaController {
  @Get("/trivia/questions")
  async getAll(
    @QueryParam("shuffled", { required: false }) shuffled?: boolean,
    @QueryParam("count", { required: false }) count?: number,
  ) {
    const docQuery = Question.find()

    if (!shuffled) {
      docQuery.sort({ createdAt: "desc" })
    }

    const questions = await docQuery.lean()

    if (shuffled) {
      shuffle(questions)
    }

    return questions.slice(0, count)
  }

  @Get("/trivia/questions/:id")
  async getOne(@Param("id") id: string) {
    return await Question.findById(id).lean()
  }

  @HttpCode(201)
  @Post("/trivia/questions")
  async post(@Body() body: any) {
    return await new Question(body).save()
  }

  @Authorized("trivia")
  @OnUndefined(204)
  @Put("/trivia/questions/:id")
  async put(@Param("id") id: string, @Body() body: any) {
    const question = await Question.findById(id)

    if (question) {
      if (body.verified && !question.verified) {
        await Report.deleteMany({ question: mongoose.Types.ObjectId(id) })
      }

      await question.update(body)
    } else {
      throw new NotFoundError()
    }
  }

  @Authorized("trivia")
  @OnUndefined(204)
  @Delete("/trivia/questions/:id")
  async remove(@Param("id") id: string) {
    await Question.deleteOne({ _id: id })
    await Report.deleteMany({ question: mongoose.Types.ObjectId(id) })
  }

  @Authorized("trivia")
  @Get("/trivia/questions/:id/reports")
  async getAllQuestionReports(@Param("id") id: string) {
    return await Report.find({
      question: mongoose.Types.ObjectId(id),
    }).sort({ createdAt: "desc" }).lean()
  }

  @HttpCode(201)
  @OnUndefined(400)
  @Post("/trivia/questions/:id/reports")
  async postQuestionReport(@Param("id") id: string, @Body() body: any) {
    const question = await Question.findById(id)

    if (!question || question.verified) {
      return
    }

    Object.assign(body, { question: id })

    return await new Report(body).save()
  }

  @Get("/trivia/categories")
  async getAllCategories() {
    return await Question.distinct("category").lean()
  }

  @Authorized("trivia")
  @Get("/trivia/reports")
  async getAllReports(@QueryParams() query: any) {
    return await Report.find(query).lean()
  }

  @Authorized("trivia")
  @Get("/trivia/reported-questions")
  async getAllReportedQuestions() {
    return await Question.find().where("_id").in(await Report.distinct("question")).lean()
  }

  @Get("/trivia/statistics")
  async getStatistics() {
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

    return {
      questionCount,
      categoryCount,
      countOfQuestionsAddedThisMonth,
      topCategories,
      topSubmitters,
      dailyQuestions,
    }
  }
}
