import { JsonController, Get, getMetadataArgsStorage } from "routing-controllers";

@JsonController()
export class UserController {
  @Get("/meta/routes")
  getAll() {
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
}
