import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3142);
const app = createApp();

app.listen(port, () => {
  console.log(`simple-pair listening on :${port}`);
});
