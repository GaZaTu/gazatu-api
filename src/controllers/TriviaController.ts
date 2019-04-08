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
    @QueryParam("exclude", { required: false }) exclude?: string,
    @QueryParam("include", { required: false }) include?: string,
    @QueryParam("verified", { required: false }) verified?: boolean,
    @QueryParam("disabled", { required: false }) disabled = false,
  ) {
    const findConfig = {} as any

    if (exclude) {
      findConfig.category = { $nin: exclude.slice(1, -1).split(",") }
    } else if (include) {
      findConfig.category = { $in: include.slice(1, -1).split(",") }
    }

    if (verified !== undefined) {
      findConfig.verified = verified
    }

    if (disabled !== undefined) {
      findConfig.disabled = disabled
    }

    const docQuery = Question.find(findConfig)

    if (!shuffled && shuffled !== undefined) {
      docQuery.sort({ createdAt: "desc" })
    }

    const questions = await docQuery.lean()

    if (shuffled || shuffled === undefined) {
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
    const question = await Question.findById(id)

    if (!question) {
      throw new NotFoundError()
    }

    return await Report.find({
      question: mongoose.Types.ObjectId(id),
    }).sort({ createdAt: "desc" }).lean()
  }

  @HttpCode(201)
  @Post("/trivia/questions/:id/reports")
  async postQuestionReport(@Param("id") id: string, @Body() body: any) {
    const question = await Question.findById(id)

    if (!question) {
      throw new NotFoundError()
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
    const categoryCount = (await Question.distinct("category")).length
    const verifiedQuestionCount = await Question.find({ verified: true }).count()

    // const countOfQuestionsAddedThisMonth = await Question.aggregate([
    //   {
    //     $project: {
    //       month: { $month: "$createdAt" },
    //       week: { $week: "$createdAt" },
    //     },
    //   },
    //   {
    //     $match: {
    //       month: new Date().getMonth(),
    //     },
    //   },
    //   {
    //     $count: "questionsAddedThisMonth",
    //   },
    //   // {
    //   //   $match: {
    //   //     week: new Date().get
    //   //   },
    //   // },
    //   // {
    //   //   $count: "questionsAddedThisWeek",
    //   // },
    // ])

    const topCategories = await Question.aggregate([
      {
        $group: {
          _id: { category: "$category" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: false,
          category: "$_id.category",
          submissions: "$count",
        },
      },
    ]).sort({ submissions: "desc" }).limit(3)

    const topSubmitters = await Question.aggregate([
      {
        $group: {
          _id: { submitter: "$submitter" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: false,
          submitter: "$_id.submitter",
          submissions: "$count",
        },
      },
    ]).sort({ submissions: "desc" }).limit(3)

    const submissionDates = await Question.aggregate([
      {
        $match: {
          createdAt: {
            $gte: (() => {
              const date = new Date()
              date.setFullYear(date.getFullYear() - 1)

              return date
            })(),
          },
        },
      },
      {
        $project: {
          _id: false,
          createdAt: "$createdAt",
        },
      },
    ]).sort({ createdAt: "asc" })

    return {
      questionCount,
      verifiedQuestionCount,
      categoryCount,
      // countOfQuestionsAddedThisMonth,
      topCategories,
      topSubmitters,
      submissionDates,
    }
  }

  @Get("/trivia/question-count")
  async getQuestionCount(
    @QueryParam("exclude", { required: false }) exclude?: string,
    @QueryParam("include", { required: false }) include?: string,
    @QueryParam("verified", { required: false }) verified?: boolean,
    @QueryParam("disabled", { required: false }) disabled = false,
  ) {
    const findConfig = {} as any

    if (exclude) {
      findConfig.category = { $nin: exclude.slice(1, -1).split(",") }
    } else if (include) {
      findConfig.category = { $in: include.slice(1, -1).split(",") }
    }

    if (verified !== undefined) {
      findConfig.verified = verified
    }

    if (disabled !== undefined) {
      findConfig.disabled = disabled
    }

    return {
      count: await Question.count(findConfig),
    }
  }

  @Authorized("trivia")
  @Get("/trivia/report-count")
  async getReportCount() {
    return {
      count: await Report.count({}),
    }
  }

  @Authorized("trivia")
  @Get("/trivia/reported-question-count")
  async getReportedQuestionCount() {
    return {
      count: await Question.count({
        _id: { $in: await Report.distinct("question") },
      }),
    }
  }
}
