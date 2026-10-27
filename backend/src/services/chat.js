import { config } from "../config.js";
import { getGroq, reserveTokens } from "./groq.js";
import { Chunk } from "../models/index.js";
import { chatSystem, chatUser } from "../prompts/chat.js";

const NOT_FOUND_MSG = "This specific point isn't addressed in the sections I can retrieve from your contract.";

// Keyword retrieval via MongoDB's text index, ranked by relevance.
export async function searchChunks(userId, sessionId, query, k = config.chatTopK) {
  const hits = await Chunk.find(
    { user_id: userId, session_id: sessionId, $text: { $search: query } },
    { score: { $meta: "textScore" }, chunk_id: 1, heading: 1, text: 1 },
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(k)
    .lean();
  if (hits.length) return hits;

  // Query was all stop-words or matched nothing: fall back to the document's opening clauses.
  return Chunk.find({ user_id: userId, session_id: sessionId }).sort({ chunk_id: 1 }).limit(k).lean();
}

const buildContext = (chunks) =>
  chunks.map((c, i) => `[Excerpt ${i + 1} — ${c.heading}]\n${c.text}`).join("\n\n---\n\n");

// Yields raw text tokens; the route layer handles SSE framing.
export async function* streamChat(userId, sessionId, query) {
  const chunks = await searchChunks(userId, sessionId, query);
  if (!chunks.length) {
    yield NOT_FOUND_MSG;
    return;
  }

  try {
    const system = chatSystem({ retrieved_context: buildContext(chunks) });
    const budget = await reserveTokens(config.groqChatModel, system.length + query.length, config.maxTokens.chat);
    const stream = await getGroq().chat.completions.create({
      model: config.groqChatModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: chatUser({ query }) },
      ],
      temperature: 0.2,
      max_tokens: config.maxTokens.chat,
      reasoning_effort: config.reasoningEffort,
      stream: true,
    });
    for await (const part of stream) {
      const text = part.choices[0]?.delta?.content;
      if (text) yield text;
      // Groq reports usage on the final chunk.
      budget.settle(part.x_groq?.usage?.total_tokens);
    }
  } catch (err) {
    console.error(`Chat streaming error for session ${sessionId}: ${err.message}`);
    yield "An error occurred while processing your question. Please try again.";
  }
}
