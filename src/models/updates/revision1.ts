import { MetaInfo } from "../meta.model";

(async () => {
  if (await MetaInfo.getDatabaseRevision() === 1) {
  }
})
