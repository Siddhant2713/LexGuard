import mongoose from "mongoose";
import { config } from "../config.js";

export async function connectMongo() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10_000 });
  // Build indexes (incl. the text index used by chat retrieval) before serving traffic.
  await mongoose.syncIndexes();
}
