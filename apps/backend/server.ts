import { startServer } from "./src/app/server/start-server";
import { getUploadsDir } from "./src/app/runtime/paths";

void startServer({
  uploadsRoot: getUploadsDir(),
});
