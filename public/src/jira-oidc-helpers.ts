import { JtrEnv } from "./shared/types.js";

import createJiraHelpers from "./shared/helpers";

// TODO move this into main module
declare global {
  interface Window {
    env: JtrEnv;
    localStorage: Storage;
    location: Location;
    jiraHelpers: any;
  }
}

export default createJiraHelpers;
