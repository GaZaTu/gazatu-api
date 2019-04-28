import { MetaInfo } from "../meta.model";

const revisions = [
  import("./rev1"),
  import("./rev2"),
  import("./rev3"),
]

export async function updateDatabaseRevision() {
  for (const rev of await Promise.all(revisions)) {
    if (await MetaInfo.getDatabaseRevision() === (rev.default.rev - 1)) {
      await MetaInfo.incrementDatabaseRevision()
      await rev.default.code()
    }
  }
}
