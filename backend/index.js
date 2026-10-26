import { config } from "./src/config.js";
import { connectMongo } from "./src/lib/mongo.js";
import { createApp } from "./src/app.js";

await connectMongo();
console.log("MongoDB connected");

createApp().listen(config.port, () => console.log(`LexGuard API listening on :${config.port}`));
