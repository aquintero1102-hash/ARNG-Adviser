import { readFileSync } from "fs";
const chunksData = JSON.parse(readFileSync(new URL("./chunks-data.json", import.meta.url), "utf8"));

const SYSTEM_PROMPT = `You are an expert Army National Guard (ARNG) recruiting assistant. Your job is to help recruiters and potential applicants understand eligibility requirements, waiver processes, and enlistment criteria based on official ARNG regulations and policy memoranda.

IMPORTANT GUIDELINES:
- Always cite the specific document (SMOM, AR, AOC chapter, WASP, etc.) that supports your answer
- If something requires a waiver, explain the waiver authority and process- If you are unsure about something or it is not covered in the provided documents, say so clearly
- Be precise with ages, scores, timeframes, and other specific criteria
- When discussing disqualifiers, distinguish between waiverable and non-waiverable conditions
- Use plain language but include the regulatory references
- If the question is about a specific situation, ask clarifying questions if needed

You have access to the following regulatory documents:
`;

// Keyword-based chunk routing (instant, no API call needed)
const ROUTING_RULES = [
  { keywords: ["age", "old", "years old", "how old", "minimum age", "maximum age", "too old", "too young", "17", "18", "35", "42"], ids: [19, 30, 20, 31] },
  { keywords: ["asvab", "afqt", "test score", "gt score", "line score", "aptitude"], ids: [19, 30, 33, 22] },
  { keywords: ["ged", "education", "diploma", "high school", "college", "tier", "home school", "homeschool", "credential"], ids: [19, 30, 0, 14] },
  { keywords: ["citizenship", "citizen", "immigrant", "green card", "permanent resident", "non-citizen", "naturalization", "visa", "alien"], ids: [19, 30, 39] },
  { keywords: ["prior service", "ps ", "re-enlist", "reenlist", "prior military", "dd-214", "dd214", "former military", "veteran"], ids: [8, 20, 31, 42] },
  { keywords: ["bct", "basic combat training", "basic training", "boot camp", "osut", "iet", "initial entry"], ids: [8, 22, 36] },
  { keywords: ["waiver", "waiverable", "non-waiverable", "disqualif", "exception to policy", "etp"], ids: [15, 21, 32] },
  { keywords: ["felony", "misdemeanor", "arrest", "conviction", "criminal", "crime", "dui", "dwi", "drug", "marijuana", "charge", "court", "offense", "moral"], ids: [15, 21, 32, 1, 5] },
  { keywords: ["medical", "health", "physical", "meps physical", "asthma", "adhd", "depression", "mental health", "vision", "hearing"], ids: [13, 15, 21, 32] },
  { keywords: ["suitab", "screening", "background check", "hrr", "esp ", "expedited screening"], ids: [1, 2, 3, 4, 5, 6, 41] },
  { keywords: ["cat-iv", "cat iv", "category iv", "category 4", "09m", "low score"], ids: [0, 14, 11, 12] },
  { keywords: ["meps", "processing station", "guidance counselor"], ids: [23, 34, 10] },
  { keywords: ["casp", "civilian acquired skill", "civilian skill"], ids: [16, 24, 35] },
  { keywords: ["ocs", "officer candidate", "09s", "warrant officer", "09w", "wocs", "commission"], ids: [26, 37] },
  { keywords: ["special forces", "18x", "sf enlist"], ids: [26, 37] },
  { keywords: ["smp", "rotc", "simultaneous membership"], ids: [26, 37] },
  { keywords: ["incentive", "bonus", "student loan", "kicker", "gi bill", "slrp"], ids: [27, 37] },
  { keywords: ["live scan", "livescan", "fingerprint"], ids: [9, 43] },
  { keywords: ["real id", "identification", "id requirement", "valid id"], ids: [10, 34] },
  { keywords: ["eclt", "entry level", "entry-level"], ids: [11, 12] },
  { keywords: ["future soldier", "prep course", "preparatory", "arms 2.0", "army prep"], ids: [48, 33] },
  { keywords: ["security clearance", "secret clearance", "top secret", "background investigation", "35m", "35p", "intel"], ids: [40, 46] },
  { keywords: ["post enlistment", "after enlistment", "reclassif", "renegotiat", "training seat", "ship date"], ids: [25, 36] },
  { keywords: ["tattoo", "brand", "body art"], ids: [21, 32] },
  { keywords: ["dependent", "married", "spouse", "child", "children", "family"], ids: [19, 30, 20, 31] },
  { keywords: ["split train", "split option"], ids: [33, 22] },
  { keywords: ["enlist period", "term of service", "obligation", "mso", "how long", "contract length"], ids: [19, 30, 20, 31] },
  { keywords: ["pay grade", "rank", "e-1", "e-2", "e-3", "e-4", "e-5"], ids: [20, 31] },
  { keywords: ["appeal", "rebuttal"], ids: [3, 4, 1] },
  { keywords: ["sf 180", "sf-180", "military records", "records request"], ids: [17, 42] },
  { keywords: ["recruit sustainment", "rsp"], ids: [7] },
  { keywords: ["field enlistment", "non-meps"], ids: [45] },
  { keywords: ["naturalization", "selres", "n-426"], ids: [39] },
  { keywords: ["vacancy", "auvs", "unit vacancy"], ids: [34, 23] },
  { keywords: ["esl", "english as a second", "language", "flri", "09c", "foreign language"], ids: [37, 26] },
  { keywords: ["college first"], ids: [37] },
  { keywords: ["join", "enlist", "sign up", "qualify", "eligible", "can i", "am i able"], ids: [19, 30, 21, 32] },
  { keywords: ["requirement", "need to", "what do i need"], ids: [19, 30, 32, 15] },
];

function selectChunksByKeywords(question) {
  const q = question.toLowerCase();
  const selectedIds = new Set();

  for (const rule of ROUTING_RULES) {
    for (const kw of rule.keywords) {
      if (q.includes(kw)) {
        for (const id of rule.ids) {
          selectedIds.add(id);
        }
        break;
      }
    }
  }

  // Default: general eligibility docs if nothing specific matched
  if (selectedIds.size === 0) {
    [19, 30, 21, 32, 15, 1].forEach((id) => selectedIds.add(id));
  }

  // Cap at 6 chunks
  return [...selectedIds].slice(0, 6);
}

// Context budget: ~120K chars max
const MAX_CONTEXT_CHARS = 120000;

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured. Add it in Netlify Site Settings > Environment Variables." }),
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

  const { question, history = [] } = body;

  if (!question) {
    return new Response(
      JSON.stringify({ error: "No question provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { chunks } = chunksData;

  try {
    // Step 1: Instant keyword-based chunk selection
    const selectedIds = selectChunksByKeywords(question);

    // Step 2: Build context with budget limit
    let contextDocs = "";
    let totalChars = 0;
    const usedIds = [];

    for (const id of selectedIds) {
      const chunk = chunks.find((c) => c.id === id);
      if (!chunk) continue;

      const entry = "\n=== " + chunk.title + " ===\n" + chunk.text + "\n";
      if (totalChars + entry.length > MAX_CONTEXT_CHARS) {
        const remaining = MAX_CONTEXT_CHARS - totalChars;
        if (remaining > 1000) {
          contextDocs += "\n=== " + chunk.title + " (truncated) ===\n" + chunk.text.slice(0, remaining - 100) + "\n[...truncated...]\n";
          usedIds.push(id);
        }
        break;
      }

      contextDocs += entry;
      totalChars += entry.length;
      usedIds.push(id);
    }

    const docTitles = usedIds
      .map((id) => chunks.find((c) => c.id === id)?.title)
      .filter(Boolean)
      .join(", ");

    // Build conversation messages
    const apiMessages = [];
    for (const msg of history.slice(-4)) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }
    apiMessages.push({ role: "user", content: question });

    // Step 3: Single API call
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
        system: SYSTEM_PROMPT + docTitles + "\n\nREFERENCE DOCUMENTS:\n" + contextDocs,
        messages: apiMessages,
      }),
    });

    const answerData = await answerRes.json();

    // Surface API errors clearly
    if (answerData.error) {
      return new Response(
        JSON.stringify({ error: "Anthropic API: " + (answerData.error.message || JSON.stringify(answerData.error)) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const answer = answerData.content?.[0]?.text || "No response content returned from API. Raw: " + JSON.stringify(answerData).slice(0, 300);

    const sourceDocs = usedIds
      .map((id) => chunks.find((c) => c.id === id)?.title)
      .filter(Boolean);

    return new Response(
      JSON.stringify({ answer, sources: sourceDocs }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error: " + err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/chat",
    includedFiles: ["chunks-data.json"],
};
