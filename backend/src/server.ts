import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`The Property Guy API running on port ${env.PORT}`);
});
