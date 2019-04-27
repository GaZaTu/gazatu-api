import { JsonController, Get, getMetadataArgsStorage } from "routing-controllers";
import { routingControllersToSpec } from "routing-controllers-openapi";
import { routingControllersConfig } from "../routingControllersConfig";
import "reflect-metadata";
import { OperationObject } from "openapi3-ts";
import { readFile } from "fs";
import { promisify } from "util";

function arrayFlat<T>(arrays: T[][]) {
  return [].concat.apply([], arrays as any[]) as T[]
}

@JsonController()
export class MetaController {
  @Get("/meta/routes")
  getRoutes() {
    const metadata = getMetadataArgsStorage()

    return metadata.actions.map(action => {
      const { type, route } = action
      const params = metadata.filterParamsWithTargetAndMethod(action.target, action.method)
        .map(p => ({ type: p.type, name: p.name, required: p.required }))
      const responseHandlers = metadata.filterResponseHandlersWithTargetAndMethod(action.target, action.method)
        .map(h => ({ type: h.type, value: h.value }))

      return { type, route, params, responseHandlers }
    })
  }

  @Get("/meta/openapi-spec")
  async getOpenapiSpec() {
    const packageJson = await promisify(readFile)("./package.json")
      .then(file => file.toString("utf8"))
      .then(text => JSON.parse(text))

    const metadata = getMetadataArgsStorage()
    const openApiObject = routingControllersToSpec(
      metadata,
      routingControllersConfig,
      {
        components: {
          securitySchemes: {
            apikey: {
              name: "apikey",
              type: "apiKey",
              in: "header",
              bearerFormat: "Bearer",
            },
          },
        },
        info: {
          title: packageJson.name,
          version: packageJson.version,
        },
        servers: [
          {
            url: "https://api.gazatu.xyz",
          },
        ],
        tags: [],
      },
    )

    openApiObject.tags = Array.from(
      new Set(
        arrayFlat(
          Object.values(openApiObject.paths)
            .map(object => (
              Object.values(object)
                .map(operation => ((operation as OperationObject).tags || [])[0])
            ))
        )
      )
    ).map(name => ({ name }))

    const operationProtections = new Map(
      metadata.responseHandlers
        .filter(h => h.type === 'authorized')
        .map(h => [
          `${h.target.name}.${h.method}`,
          h.value ? ((typeof h.value === 'string') ? [h.value] : h.value) : [],
        ])
    )

    Object.values(openApiObject.paths)
      .forEach(object => (
        Object.values(object)
          .forEach(_operation => {
            const operation = _operation as OperationObject
            const operationId = operation.operationId!
            const protection = operationProtections.get(operationId)

            if (protection) {
              operation.security = operation.security || []
              operation.security.push({
                apikey: protection,
              })
            }
          })
      ))

    return openApiObject
  }
}
