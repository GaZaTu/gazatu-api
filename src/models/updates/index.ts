import { MetaInfo } from "../meta.model";

import rev1 from "./rev1";
import rev2 from "./rev2";

const revisions = [
  rev1,
  rev2,
]

export async function updateDatabaseRevision() {
  for (const rev of revisions) {
    if (await MetaInfo.getDatabaseRevision() === (rev.rev - 1)) {
      await MetaInfo.incrementDatabaseRevision()
      await rev.code()
    }
  }
}
