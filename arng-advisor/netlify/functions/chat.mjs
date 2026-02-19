import chunksData from "./chunks-data.json" with { type: "json" };

const SYSTEM_PROMPT = `You are an expert Army National Guard (ARNG) recruiting assistant. Your job is to help recruiters and potential applicants understand eligibility requirements, waiver processes, and enlistment criteria based on official ARNG regulations and policy memoranda.

IMPORTANT GUIDELINES:
- Always cite the specific document (SMOM, AR, AOC chapter, WASP, etc.) that supports your answer
- If something requires a waiver, explain the waiver authority and process
- If you're unsure about something or it's not covered in the provided documents, say so clearly
- Be precise with ages, scores, timeframes, and other specific criteria
- When discussing disqualifiers, distinguish between waiverable and non-waiverable conditions
- Use plain language but include the regulatory references
- If the question is about a specific situation, ask clarifying questions if needed

You have access to the following regulatory documents:
`;

const CHUNK_SELECTION_PROMPT = `You are a document routing assistant. Given a user's question about Army National Guard enlistment eligibility, select which document chunks are most relevant to answer it.

Available document chunks:
`;

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { question, history = [] } = body;

  if (!question) {
    return new Response(JSON.stringify({ error: "No question provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { chunks, summaries } = chunksData;

  try {
    // Step 1: Select relevant chunks
    const chunkList = summaries
      .map(
        (c) =>
          `[${c.id}] ${c.title} (${Math.round(c.chars / 1000)}K chars)\nPreview: ${c.preview.slice(0, 200)}...`
      )
      .join("\n\n");

    const selectionRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `${CHUNK_SELECTION_PROMPT}\n${chunkList}\n\nUser question: "${question}"\n\nRespond with ONLY a JSON array of the chunk IDs (numbers) most relevant to answering this question. Select 3-6 chunks. Example: [0, 2, 5, 11]\n\nIMPORTANT: Always include the large reference docs (IDs 11, 12) if the question is about general eligibility, age, citizenship, education, ASVAB, conduct, medical, or waiver criteria. Include WASP (ID 9) for waiver questions. Include suitability docs (IDs 1, 2) for background/screening questions.`,
          },
        ],
      }),
    });

    const selectionData = await selectionRes.json();
    const selectionText = selectionData.content?.[0]?.text || "[]";
    const match = selectionText.match(/\[[\d,\s]+\]/);
    const selectedIds = match ? JSON.parse(match[0]) : [0, 1, 9, 11, 12];

    // Step 2: Build context and get answer
    const contextDocs = selectedIds
      .map((id) => chunks.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => `\n=== ${c.title} ===\n${c.text}`)
      .join("\n\n");

    const docTitles = selectedIds
      .map((id) => chunks.find((c) => c.id === id)?.title)
      .filter(Boolean)
      .join(", ");

    const apiMessages = [];
    for (const msg of history.slice(-6)) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }
    apiMessages.push({ role: "user", content: question });

    const answerRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: `${SYSTEM_PROMPT}${docTitles}\n\nREFERENCE DOCUMENTS:\n${contextDocs}`,
        messages: apiMessages,
      }),
    });

    const answerData = await answerRes.json();
    const answer =
      answerData.content?.[0]?.text ||
      "I'm sorry, I wasn't able to generate a response. Please try again.";

    const sourceDocs = selectedIds
      .map((id) => chunks.find((c) => c.id === id)?.title)
      .filter(Boolean);

    return new Response(
      JSON.stringify({ answer, sources: sourceDocs }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const config = {
  path: "/api/chat",
};
