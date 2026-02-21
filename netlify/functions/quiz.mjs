import { readFileSync } from "fs";
import { getStore } from "@netlify/blobs";

const chunksData = JSON.parse(
  readFileSync(new URL("./chunks-data.json", import.meta.url), "utf8")
);

const QUIZ_TOPICS = {
  age: { label: "Age Requirements", ids: [19, 30, 20, 31] },
  asvab: { label: "ASVAB / Test Scores", ids: [19, 30, 33, 22] },
  education: { label: "Education / GED / Diploma", ids: [19, 30, 0, 14] },
  citizenship: { label: "Citizenship / Immigration", ids: [19, 30, 39] },
  prior_service: { label: "Prior Service", ids: [8, 20, 31, 42] },
  waiver: { label: "Waivers / Exceptions", ids: [15, 21, 32] },
  moral: { label: "Moral / Criminal History", ids: [15, 21, 32, 1, 5] },
  medical: { label: "Medical / Health", ids: [13, 15, 21, 32] },
  suitability: { label: "Suitability Screening", ids: [1, 2, 3, 4, 5, 6, 41] },
  meps: { label: "MEPS Processing", ids: [23, 34, 10] },
  incentives: { label: "Incentives / Bonuses / GI Bill", ids: [27, 37] },
  officer: { label: "Officer / Warrant Officer", ids: [26, 37] },
  enlistment: { label: "Enlistment Programs", ids: [19, 30, 20, 31, 25, 36] },
  security: { label: "Security Clearance", ids: [40, 46] },
  general: { label: "General Eligibility", ids: [19, 30, 21, 32, 15] },
};

function getTopicsList() {
  return Object.entries(QUIZ_TOPICS).map(([key, val]) => ({ id: key, label: val.label }));
}

function buildContext(topicId) {
  const topic = QUIZ_TOPICS[topicId] || QUIZ_TOPICS.general;
  const { chunks } = chunksData;
  let context = "";
  let totalChars = 0;
  const maxChars = 40000;
  for (const id of topic.ids) {
    const chunk = chunks.find((c) => c.id === id);
    if (!chunk) continue;
    const entry = "\n=== " + chunk.title + " ===\n" + chunk.text + "\n";
    if (totalChars + entry.length > maxChars) break;
    context += entry;
    totalChars += entry.length;
  }
  return { context, label: topic.label };
}

async function logQuizResult(topic, topicLabel, correct, question) {
  try {
    const store = getStore("search-analytics");
    const now = new Date();
    const key = `quiz/${now.toISOString().slice(0, 10)}/${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    await store.setJSON(key, {
      type: "quiz",
      topic: topic,
      topicLabel: topicLabel,
      correct: correct,
      q: question.slice(0, 300),
      ts: now.toISOString(),
      day: now.toISOString().slice(0, 10),
    });
  } catch (e) {
    console.error("Quiz log error:", e.message);
  }
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { action } = body;

  if (action === "topics") {
    return new Response(
      JSON.stringify({ topics: getTopicsList() }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (action === "generate") {
    const topicId = body.topic || "general";
    const { context, label } = buildContext(topicId);
    const difficulty = body.difficulty || "standard";
    const previousQuestions = body.previousQuestions || [];

    const avoidClause = previousQuestions.length > 0
      ? `\n\nDo NOT repeat or closely resemble any of these previous questions:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";

    const difficultyGuide = difficulty === "hard"
      ? "Make this a challenging question that tests deep understanding, specific numbers, nuanced exceptions, or multi-step reasoning."
      : difficulty === "easy"
      ? "Make this a straightforward question about basic facts or common knowledge from the regulations."
      : "Make this a moderately challenging question that tests practical knowledge a recruiter would need.";

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: `You are a quiz generator for Army National Guard recruiting knowledge. Generate questions based ONLY on the provided regulatory documents. ${difficultyGuide}

You must respond with ONLY valid JSON in this exact format, no other text:
{
  "question": "The question text",
  "options": ["A) option text", "B) option text", "C) option text", "D) option text"],
  "correctIndex": 0,
  "explanation": "Brief explanation citing the specific regulation",
  "regulation": "Name of the regulation that answers this"
}

correctIndex is 0-3 corresponding to options A-D.${avoidClause}`,
          messages: [
            {
              role: "user",
              content: `Generate a multiple-choice question about ${label} based on these regulations:\n\n${context}`,
            },
          ],
        }),
      });

      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: "API: " + (data.error.message || JSON.stringify(data.error)) }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const text = data.content?.[0]?.text || "";
      let parsed;
      try {
        const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        return new Response(
          JSON.stringify({ error: "Failed to parse quiz question. Try again." }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          question: parsed.question,
          options: parsed.options,
          correctIndex: parsed.correctIndex,
          explanation: parsed.explanation,
          regulation: parsed.regulation,
          topic: topicId,
          topicLabel: label,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Server error: " + err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (action === "answer") {
    const { topic, topicLabel, correct, question } = body;
    await logQuizResult(topic || "unknown", topicLabel || "Unknown", correct || false, question || "");
    return new Response(
      JSON.stringify({ logged: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Unknown action. Use: topics, generate, or answer" }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
};

export const config = {
  path: "/api/quiz",
};
