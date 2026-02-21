import { getStore } from "@netlify/blobs";

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
  enlistment: "Enlistment Programs",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const url = new URL(req.url);
  const adminKey = url.searchParams.get("key") || req.headers.get("x-admin-key");
  const expectedKey = Netlify.env.get("ANALYTICS_KEY");
  if (expectedKey && adminKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: "Unauthorized. Provide ?key=YOUR_ANALYTICS_KEY" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const store = getStore("search-analytics");
    const { blobs: searchBlobs } = await store.list({ prefix: "log/" });
    const searchEntries = [];
    for (const blob of searchBlobs) {
      try {
        const data = await store.get(blob.key, { type: "json" });
        if (data) searchEntries.push(data);
      } catch { /* skip */ }
    }

    const { blobs: quizBlobs } = await store.list({ prefix: "quiz/" });
    const quizEntries = [];
    for (const blob of quizBlobs) {
      try {
        const data = await store.get(blob.key, { type: "json" });
        if (data) quizEntries.push(data);
      } catch { /* skip */ }
    }

    searchEntries.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    quizEntries.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));

    const now = new Date();
    const topicCounts = {};
    const last7Days = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      last7Days[d.toISOString().slice(0, 10)] = 0;
    }

    for (const entry of searchEntries) {
      for (const topic of entry.topics || []) {
        const label = TOPIC_LABELS[topic] || topic;
        topicCounts[label] = (topicCounts[label] || 0) + 1;
      }
      const day = entry.day || (entry.ts || "").slice(0, 10);
      if (day && last7Days.hasOwnProperty(day)) last7Days[day]++;
    }

    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count]) => ({ topic, count }));

    const weekVolume = Object.entries(last7Days)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const recentSearches = searchEntries.slice(0, 50).map((e) => ({
      question: e.q,
      topics: e.topicLabels || e.topics,
      timestamp: e.ts,
    }));

    // Quiz analytics
    const quizTopicStats = {};
    let totalCorrect = 0;
    const quizLast7Days = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      quizLast7Days[d.toISOString().slice(0, 10)] = { total: 0, correct: 0 };
    }

    for (const entry of quizEntries) {
      const label = entry.topicLabel || TOPIC_LABELS[entry.topic] || entry.topic || "Unknown";
      if (!quizTopicStats[label]) quizTopicStats[label] = { total: 0, correct: 0 };
      quizTopicStats[label].total++;
      if (entry.correct) { quizTopicStats[label].correct++; totalCorrect++; }
      const day = entry.day || (entry.ts || "").slice(0, 10);
      if (day && quizLast7Days.hasOwnProperty(day)) {
        quizLast7Days[day].total++;
        if (entry.correct) quizLast7Days[day].correct++;
      }
    }

    const quizTopicBreakdown = Object.entries(quizTopicStats)
      .map(([topic, s]) => ({
        topic, total: s.total, correct: s.correct,
        accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const quizWeekVolume = Object.entries(quizLast7Days)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, s]) => ({ date, total: s.total, correct: s.correct }));

    const recentQuizzes = quizEntries.slice(0, 30).map((e) => ({
      question: e.q, topic: e.topicLabel || e.topic, correct: e.correct, timestamp: e.ts,
    }));

    return new Response(
      JSON.stringify({
        totalSearches: searchEntries.length,
        topTopics, weekVolume, recentSearches,
        totalQuizzes: quizEntries.length, totalCorrect,
        quizAccuracy: quizEntries.length > 0 ? Math.round((totalCorrect / quizEntries.length) * 100) : 0,
        quizTopicBreakdown, quizWeekVolume, recentQuizzes,
        generatedAt: now.toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Analytics error: " + err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = { path: "/api/analytics" };
