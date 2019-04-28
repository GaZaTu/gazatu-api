import { JsonController, Get, Post, Put, Delete, QueryParams, Authorized, Body, Param, HttpCode, OnUndefined } from "routing-controllers";
import "reflect-metadata";
import { Language } from "../models/meta.model";

@JsonController()
export class LanguageController {
  @Get("/languages")
  getAll(
    @QueryParams() query: any,
  ) {
    return Language.find(query)
  }

  @Authorized("languages")
  @HttpCode(201)
  @Post("/languages")
  post(
    @Body() body: any,
  ) {
    return new Language(body).save()
  }

  @Get("/languages/:id")
  getOne(
    @Param('id') id: string,
  ) {
    return Language.findById(id)
  }

  @Authorized("languages")
  @OnUndefined(204)
  @Put("/languages/:id")
  async put(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await Language.updateOne({ _id: id }, body)
  }

  @Authorized("languages")
  @OnUndefined(204)
  @Delete("/languages/:id")
  async delete(
    @Param('id') id: string,
  ) {
    await Language.deleteOne({ _id: id })
  }
}
