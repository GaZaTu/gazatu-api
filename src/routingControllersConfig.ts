import { appConfig } from "./config";
import { authorizationChecker, currentUserChecker } from "./controllers/AuthController";

const {
  production,
} = appConfig()

export const routingControllersConfig = {
  development: !production,
  controllers: [`${__dirname}/controllers/**/*.[jt]s`],
  defaults: {
    nullResultCode: 404,
    undefinedResultCode: 404,
    paramOptions: {
      required: true,
    },
  },
  classTransformer: false,
  authorizationChecker,
  currentUserChecker,
}
