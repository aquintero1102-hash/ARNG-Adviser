import { createRequire } from "module";
import { getStore } from "@netlify/blobs";
const require = createRequire(import.meta.url);
const chunksData = require("./chunks-data.json");

const SYSTEM_PROMPT = `You are an expert Army National Guard (ARNG) recruiting assistant. Your job is to help recruiters and potential applicants understand eligibility requirements, waiver processes, and enlistment criteria based on official ARNG regulations and policy memoranda.

IMPORTANT GUIDELINES:
- Always cite the specific document (SMOM, AR, AOC chapter, WASP, etc.) that supports your answer
- If something requires a waiver, explain the waiver authority and process
- If you are unsure about something or it is not covered in the provided documents, say so clearly
- Be precise with ages, scores, timeframes, and other specific criteria
- When discussing disqualifiers, distinguish between waiverable and non-waiverable conditions
- Use plain language but include the regulatory references
- If the question is about a specific situation, ask clarifying questions if needed

You have access to the following regulatory documents:
`;

// Topic labels for analytics
const TOPIC_LABELS = {
  age: "Age Requirements",
  asvab: "ASVAB / Test Scores",
  education: "Education / GED / Diploma",
  citizenship: "Citizenship / Immigration",
  prior_service: "Prior Service",
  bct: "Basic Training / OSUT",
  waiver: "Waivers / Exceptions",
  moral: "Moral / Criminal History",
  medical: "Medical / Health",
  suitability: "Suitability Screening",
  cat_iv: "CAT-IV / Low Scores",
  meps: "MEPS Processing",
  casp: "Civilian Acquired Skills",
  officer: "Officer / Warrant Officer",
  special_forces: "Special Forces / 18X",
  smp: "SMP / ROTC",
  incentives: "Incentives / Bonuses / GI Bill",
  livescan: "Live Scan / Fingerprints",
  real_id: "ID Requirements",
  eclt: "Entry Level Testing",
  future_soldier: "Future Soldier / Prep Course",
  security: "Security Clearance",
  post_enlistment: "Post-Enlistment / Reclassification",
  tattoo: "Tattoo / Body Art",
  dependents: "Dependents / Family",
  split_training: "Split Training",
  service_term: "Service Term / Contract Length",
  pay_rank: "Pay Grade / Rank",
  appeal: "Appeals / Rebuttals",
  records: "Military Records / SF-180",
  rsp: "RSP / Recruit Sustainment",
  field_enlistment: "Field Enlistment",
  naturalization: "Naturalization / N-426",
  vacancy: "Unit Vacancy / AUVS",
  language: "Language / ESL / FLRI",
  college_first: "College First Program",
  general: "General Eligibility",
};

// Keyword-based chunk routing with topic tags
const ROUTING_RULES = [
  { topic: "age", keywords: ["age", "old", "years old", "how old", "minimum age", "maximum age", "too old", "too young", "17", "18", "35", "42"], ids: [19, 30, 20, 31] },
  { topic: "asvab", keywords: ["asvab", "afqt", "test score", "gt score", "line score", "aptitude"], ids: [19, 30, 33, 22] },
  { topic: "education", keywords: ["ged", "education", "diploma", "high school", "college", "tier", "home school", "homeschool", "credential"], ids: [19, 30, 0, 14] },
  { topic: "citizenship", keywords: ["citizenship", "citizen", "immigrant", "green card", "permanent resident", "non-citizen", "naturalization", "visa", "alien"], ids: [19, 30, 39] },
  { topic: "prior_service", keywords: ["prior service", "ps ", "re-enlist", "reenlist", "prior military", "dd-214", "dd214", "former military", "veteran"], ids: [8, 20, 31, 42] },
  { topic: "bct", keywords: ["bct", "basic combat training", "basic training", "boot camp", "osut", "iet", "initial entry"], ids: [8, 22, 36] },
  { topic: "waiver", keywords: ["waiver", "waiverable", "non-waiverable", "disqualif", "exception to policy", "etp"], ids: [15, 21, 32] },
  { topic: "moral", keywords: ["felony", "misdemeanor", "arrest", "conviction", "criminal", "crime", "dui", "dwi", "drug", "marijuana", "charge", "court", "offense", "moral"], ids: [15, 21, 32, 1, 5] },
  { topic: "medical", keywords: ["medical", "health", "physical", "meps physical", "asthma", "adhd", "depression", "mental health", "vision", "hearing"], ids: [13, 15, 21, 32] },
  { topic: "suitability", keywords: ["suitab", "screening", "background check", "hrr", "esp ", "expedited screening"], ids: [1, 2, 3, 4, 5, 6, 41] },
  { topic: "cat_iv", keywords: ["cat-iv", "cat iv", "category iv", "category 4", "09m", "low score"], ids: [0, 14, 11, 12] },
  { topic: "meps", keywords: ["meps", "processing station", "guidance counselor"], ids: [23, 34, 10] },
  { topic: "casp", keywords: ["casp", "civilian acquired skill", "civilian skill"], ids: [16, 24, 35] },
  { topic: "officer", keywords: ["ocs", "officer candidate", "09s", "warrant officer", "09w", "wocs", "commission"], ids: [26, 37] },
  { topic: "special_forces", keywords: ["special forces", "18x", "sf enlist"], ids: [26, 37] },
  { topic: "smp", keywords: ["smp", "rotc", "simultaneous membership"], ids: [26, 37] },
  { topic: "incentives", keywords: ["incentive", "bonus", "student loan", "kicker", "gi bill", "slrp"], ids: [27, 37] },
  { topic: "livescan", keywords: ["live scan", "livescan", "fingerprint"], ids: [9, 43] },
  { topic: "real_id", keywords: ["real id", "identification", "id requirement", "valid id"], ids: [10, 34] },
  { topic: "eclt", keywords: ["eclt", "entry level", "entry-level"], ids: [11, 12] },
  { topic: "future_soldier", keywords: ["future soldier", "prep course", "preparatory", "arms 2.0", "army prep"], ids: [48, 33] },
  { topic: "security", keywords: ["security clearance", "secret clearance", "top secret", "background investigation", "35m", "35p", "intel"], ids: [40, 46] },
  { topic: "post_enlistment", keywords: ["post enlistment", "after enlistment", "reclassif", "renegotiat", "training seat", "ship date"], ids: [25, 36] },
  { topic: "tattoo", keywords: ["tattoo", "brand", "body art"], ids: [21, 32] },
  { topic: "dependents", keywords: ["dependent", "married", "spouse", "child", "children", "family"], ids: [19, 30, 20, 31] },
  { topic: "split_training", keywords: ["split train", "split option"], ids: [33, 22] },
  { topic: "service_term", keywords: ["enlist period", "term of service", "obligation", "mso", "how long", "contract length"], ids: [19, 30, 20, 31] },
  { topic: "pay_rank", keywords: ["pay grade", "rank", "e-1", "e-2", "e-3", "e-4", "e-5"], ids: [20, 31] },
  { topic: "appeal", keywords: ["appeal", "rebuttal"], ids: [3, 4, 1] },
  { topic: "records", keywords: ["sf 180", "sf-180", "military records", "records request"], ids: [17, 42] },
  { topic: "rsp", keywords: ["recruit sustainment", "rsp"], ids: [7] },
  { topic: "field_enlistment", keywords: ["field enlistment", "non-meps"], ids: [45] },
  { topic: "naturalization", keywords: ["naturalization", "selres", "n-426"], ids: [39] },
  { topic: "vacancy", keywords: ["vacancy", "auvs", "unit vacancy"], ids: [34, 23] },
  { topic: "language", keywords: ["esl", "english as a second", "language", "flri", "09c", "foreign language"], ids: [37, 26] },
  { topic: "college_first", keywords: ["college first"], ids: [37] },
  { topic: "general", keywords: ["join", "enlist", "sign up", "qualify", "eligible", "can i", "am i able"], ids: [19, 30, 21, 32] },
  { topic: "general", keywords: ["requirement", "need to", "what do i need"], ids: [19, 30, 32, 15] },
];

function selectChunksByKeywords(question) {
  const q = question.toLowerCase();
  const selectedIds = new Set();
  const matchedTopics = new Set();

  for (const rule of ROUTING_RULES) {
    for (const kw of rule.keywords) {
      if (q.includes(kw)) {
        for (const id of rule.ids) {
          selectedIds.add(id);
        }
        matchedTopics.add(rule.topic);
        break;
      }
    }
  }

  // Default: general eligibility docs if nothing specific matched
  if (selectedIds.size === 0) {
    [19, 30, 21, 32, 15, 1].forEach((id) => selectedIds.add(id));
    matchedTopics.add("general");
  }

  // Cap at 6 chunks
  return { ids: [...selectedIds].slice(0, 6), topics: [...matchedTopics] };
}

// Log search to Netlify Blobs (fire-and-forget, non-blocking)
async function logSearch(question, topics) {
  try {
    const store = getStore("search-analytics");
    const now = new Date();
    const key = `log/${now.toISOString().slice(0, 10)}/${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    
    await store.setJSON(key, {
      q: question.slice(0, 500),
      topics: topics,
      topicLabels: topics.map(t => TOPIC_LABELS[t] || t),
      ts: now.toISOString(),
      day: now.toISOString().slice(0, 10),
    });
  } catch (e) {
    // Silent fail — don't break chat if logging fails
    console.error("Analytics log error:", e.message);
  }
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
    const { ids: selectedIds, topics: matchedTopics } = selectChunksByKeywords(question);

    // Step 1.5: Log search (non-blocking)
    logSearch(question, matchedTopics);

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
};
