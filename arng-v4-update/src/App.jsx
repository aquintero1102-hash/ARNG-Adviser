import { useState, useRef, useEffect } from "react";
import badgeImg from "/badge.png";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [kbOpen, setKbOpen] = useState(false);
  const [view, setView] = useState("chat");
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsTab, setAnalyticsTab] = useState("search");
  // Quiz state
  const [quizTopic, setQuizTopic] = useState(null);
  const [quizQ, setQuizQ] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizHistory, setQuizHistory] = useState([]);
  const [quizDifficulty, setQuizDifficulty] = useState("standard");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom(); }, [messages, loading]);
  useEffect(() => {
    if (view === "analytics" && !analytics) fetchAnalytics();
  }, [view]);

  async function fetchAnalytics() {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const res = await fetch("/api/analytics");
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to load");
      setAnalytics(data);
    } catch (err) { setAnalyticsError(err.message); }
    finally { setAnalyticsLoading(false); }
  }

  const QUIZ_TOPICS = [
    { id: "general", label: "General Eligibility" },
    { id: "age", label: "Age Requirements" },
    { id: "asvab", label: "ASVAB / Test Scores" },
    { id: "education", label: "Education / GED" },
    { id: "moral", label: "Criminal History" },
    { id: "medical", label: "Medical / Health" },
    { id: "waiver", label: "Waivers / Exceptions" },
    { id: "prior_service", label: "Prior Service" },
    { id: "citizenship", label: "Citizenship" },
    { id: "suitability", label: "Suitability Screening" },
    { id: "meps", label: "MEPS Processing" },
    { id: "incentives", label: "Incentives / Bonuses" },
    { id: "officer", label: "Officer / Warrant" },
    { id: "enlistment", label: "Enlistment Programs" },
    { id: "security", label: "Security Clearance" },
  ];

  async function generateQuiz(topicId) {
    setQuizTopic(topicId);
    setQuizQ(null);
    setQuizSelected(null);
    setQuizRevealed(false);
    setQuizLoading(true);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          topic: topicId,
          difficulty: quizDifficulty,
          previousQuestions: quizHistory.slice(-5),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to generate");
      setQuizQ(data);
    } catch (err) {
      setQuizQ({ error: err.message });
    } finally { setQuizLoading(false); }
  }

  async function submitAnswer(index) {
    if (quizRevealed || quizSelected !== null) return;
    setQuizSelected(index);
    setQuizRevealed(true);
    const correct = index === quizQ.correctIndex;
    setQuizScore(prev => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
    setQuizHistory(prev => [...prev, quizQ.question]);
    // Log to analytics (fire and forget)
    fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "answer",
        topic: quizQ.topic,
        topicLabel: quizQ.topicLabel,
        correct,
        question: quizQ.question,
      }),
    }).catch(() => {});
  }

  const suggestedQuestions = [
    "What are the age requirements to join the ARNG?",
    "Can someone with a GED enlist without college credits?",
    "What felonies are non-waiverable for enlistment?",
    "Does a prior service applicant need to redo BCT?",
    "What ASVAB score is needed to enlist?",
    "What is the suitability screening process?",
  ];

  async function handleSend(questionOverride) {
    const question = questionOverride || input.trim();
    if (!question || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setLoading(true);
    setLoadingStatus("Analyzing regulations...");
    try {
      const history = messages.filter(m => m.role === "user" || m.role === "assistant").slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, history }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Server error (${res.status})`);
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, sources: data.sources || [] }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}. Please try again.`, sources: [] }]);
    } finally { setLoading(false); setLoadingStatus(""); }
  }

  function handleKeyDown(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }
  function formatDate(d) { try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return d; } }
  function formatTimestamp(ts) { try { return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ts; } }

  /* ─── Quiz View ─── */
  function renderQuiz() {
    // Topic selection
    if (!quizTopic) {
      return (
        <div style={qStyles.container}>
          <div style={qStyles.header}>
            <img src={badgeImg} alt="Badge" style={{ width: 60, height: "auto", filter: "drop-shadow(0 0 8px rgba(212,164,74,0.3))" }} />
            <div style={qStyles.title}>Knowledge Quiz</div>
            <div style={qStyles.subtitle}>Test your ARNG recruiting regulation knowledge</div>
          </div>
          {quizScore.total > 0 && (
            <div style={qStyles.scoreBar}>
              <span>{"\uD83C\uDFC6"} Score: {quizScore.correct}/{quizScore.total}</span>
              <span>({Math.round((quizScore.correct / quizScore.total) * 100)}%)</span>
            </div>
          )}
          <div style={qStyles.diffRow}>
            {["easy", "standard", "hard"].map(d => (
              <button key={d} onClick={() => setQuizDifficulty(d)} style={{ ...qStyles.diffBtn, ...(quizDifficulty === d ? qStyles.diffActive : {}) }}>
                {d === "easy" ? "\u2605" : d === "standard" ? "\u2605\u2605" : "\u2605\u2605\u2605"} {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <div style={qStyles.topicGrid}>
            {QUIZ_TOPICS.map(t => (
              <button key={t.id} style={qStyles.topicBtn} onClick={() => generateQuiz(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button style={qStyles.randomBtn} onClick={() => {
            const r = QUIZ_TOPICS[Math.floor(Math.random() * QUIZ_TOPICS.length)];
            generateQuiz(r.id);
          }}>
            {"\uD83C\uDFB2"} Random Topic
          </button>
        </div>
      );
    }

    // Loading
    if (quizLoading) {
      return (
        <div style={qStyles.container}>
          <div style={{ ...qStyles.header, padding: "60px 0" }}>
            <div style={qStyles.subtitle}>Generating question...</div>
            <div className="loading-dots" style={{ fontSize: 24, color: "#d4a44a" }}>...</div>
          </div>
        </div>
      );
    }

    // Error
    if (quizQ && quizQ.error) {
      return (
        <div style={qStyles.container}>
          <div style={qStyles.header}>
            <div style={{ color: "#cf6679", fontSize: 14 }}>{quizQ.error}</div>
            <button style={qStyles.nextBtn} onClick={() => generateQuiz(quizTopic)}>Try Again</button>
            <button style={{ ...qStyles.nextBtn, background: "transparent", border: "1px solid #2a3050" }} onClick={() => setQuizTopic(null)}>Back to Topics</button>
          </div>
        </div>
      );
    }

    // Question display
    if (quizQ) {
      const topicLabel = QUIZ_TOPICS.find(t => t.id === quizTopic)?.label || quizTopic;
      return (
        <div style={qStyles.container}>
          <div style={qStyles.scoreBar}>
            <span style={qStyles.topicTag}>{topicLabel}</span>
            <span>{"\uD83C\uDFC6"} {quizScore.correct}/{quizScore.total} {quizScore.total > 0 ? `(${Math.round((quizScore.correct / quizScore.total) * 100)}%)` : ""}</span>
          </div>
          <div style={qStyles.questionCard}>
            <div style={qStyles.questionText}>{quizQ.question}</div>
          </div>
          <div style={qStyles.optionsGrid}>
            {quizQ.options.map((opt, i) => {
              let optStyle = { ...qStyles.optionBtn };
              if (quizRevealed) {
                if (i === quizQ.correctIndex) {
                  optStyle = { ...optStyle, ...qStyles.optionCorrect };
                } else if (i === quizSelected && i !== quizQ.correctIndex) {
                  optStyle = { ...optStyle, ...qStyles.optionWrong };
                } else {
                  optStyle = { ...optStyle, opacity: 0.4 };
                }
              } else if (i === quizSelected) {
                optStyle = { ...optStyle, borderColor: "#5a9adf" };
              }
              return (
                <button key={i} style={optStyle} onClick={() => submitAnswer(i)} disabled={quizRevealed}>
                  {opt}
                </button>
              );
            })}
          </div>
          {quizRevealed && (
            <div style={qStyles.explanationCard}>
              <div style={qStyles.resultBanner}>
                {quizSelected === quizQ.correctIndex
                  ? "\u2705 Correct!"
                  : `\u274C Incorrect \u2014 Answer: ${quizQ.options[quizQ.correctIndex]}`
                }
              </div>
              <div style={qStyles.explanationText}>{quizQ.explanation}</div>
              {quizQ.regulation && (
                <div style={qStyles.regulationTag}>{"\uD83D\uDCCB"} {quizQ.regulation}</div>
              )}
              <div style={qStyles.nextRow}>
                <button style={qStyles.nextBtn} onClick={() => generateQuiz(quizTopic)}>
                  Next Question {"\u27A4"}
                </button>
                <button style={{ ...qStyles.nextBtn, background: "transparent", border: "1px solid #2a3050" }} onClick={() => setQuizTopic(null)}>
                  Change Topic
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  }

  /* ─── Analytics View ─── */
  function renderAnalytics() {
    if (analyticsLoading) return <div style={aStyles.center}><div style={aStyles.loadingText}>Loading analytics...</div></div>;
    if (analyticsError) return <div style={aStyles.center}><div style={aStyles.errorText}>{analyticsError}</div><button style={aStyles.retryBtn} onClick={fetchAnalytics}>Retry</button></div>;
    if (!analytics) return null;

    const maxTopicCount = analytics.topTopics.length > 0 ? analytics.topTopics[0].count : 1;
    const maxDayCount = analytics.weekVolume.length > 0 ? Math.max(...analytics.weekVolume.map(d => d.count), 1) : 1;

    return (
      <div style={aStyles.container}>
        {/* Tab Toggle */}
        <div style={aStyles.tabRow}>
          <button style={{ ...aStyles.tabBtn, ...(analyticsTab === "search" ? aStyles.tabActive : {}) }} onClick={() => setAnalyticsTab("search")}>
            {"\uD83D\uDD0D"} Searches
          </button>
          <button style={{ ...aStyles.tabBtn, ...(analyticsTab === "quiz" ? aStyles.tabActive : {}) }} onClick={() => setAnalyticsTab("quiz")}>
            {"\uD83C\uDFAF"} Quiz Results
          </button>
        </div>

        {analyticsTab === "search" ? (
          <>
            {/* Search Summary */}
            <div style={aStyles.summaryRow}>
              <div style={aStyles.summaryCard}><div style={aStyles.summaryNumber}>{analytics.totalSearches}</div><div style={aStyles.summaryLabel}>Total Searches</div></div>
              <div style={aStyles.summaryCard}><div style={aStyles.summaryNumber}>{analytics.topTopics.length}</div><div style={aStyles.summaryLabel}>Topics</div></div>
              <div style={aStyles.summaryCard}><div style={aStyles.summaryNumber}>{analytics.weekVolume.reduce((s, d) => s + d.count, 0)}</div><div style={aStyles.summaryLabel}>Last 7 Days</div></div>
            </div>
            {/* 7-Day Chart */}
            <div style={aStyles.section}>
              <div style={aStyles.sectionTitle}>{"\uD83D\uDCC8"} Last 7 Days</div>
              <div style={aStyles.dayChart}>
                {analytics.weekVolume.map((day, i) => (
                  <div key={i} style={aStyles.dayColumn}>
                    <div style={aStyles.dayBarContainer}><div style={{ ...aStyles.dayBar, height: `${Math.max((day.count / maxDayCount) * 100, day.count > 0 ? 8 : 0)}%` }}/></div>
                    <div style={aStyles.dayCount}>{day.count}</div>
                    <div style={aStyles.dayLabel}>{formatDate(day.date)}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Top Topics */}
            <div style={aStyles.section}>
              <div style={aStyles.sectionTitle}>{"\uD83C\uDFAF"} Top Topics (Training Gaps)</div>
              {analytics.topTopics.length === 0 ? <div style={aStyles.emptyText}>No searches yet.</div> : (
                analytics.topTopics.slice(0, 15).map((item, i) => (
                  <div key={i} style={aStyles.topicRow}>
                    <div style={aStyles.topicHeader}>
                      <span style={aStyles.topicRank}>#{i + 1}</span>
                      <span style={aStyles.topicName}>{item.topic}</span>
                      <span style={aStyles.topicCount}>{item.count}</span>
                    </div>
                    <div style={aStyles.barBg}><div style={{ ...aStyles.barFill, width: `${(item.count / maxTopicCount) * 100}%`, background: i < 3 ? "linear-gradient(90deg, #d4a44a, #b8922a)" : "linear-gradient(90deg, #3a6aaa, #2a5a9a)" }}/></div>
                  </div>
                ))
              )}
              {analytics.topTopics.length > 0 && <div style={aStyles.gapNote}>{"\u26A0"} High-frequency topics may indicate areas needing more training.</div>}
            </div>
            {/* Recent Searches */}
            <div style={aStyles.section}>
              <div style={aStyles.sectionTitle}>{"\uD83D\uDD0D"} Recent Searches</div>
              {analytics.recentSearches.length === 0 ? <div style={aStyles.emptyText}>No searches yet.</div> : (
                analytics.recentSearches.slice(0, 20).map((item, i) => (
                  <div key={i} style={aStyles.searchRow}>
                    <div style={aStyles.searchQuestion}>{item.question}</div>
                    <div style={aStyles.searchMeta}>
                      <span style={aStyles.searchTime}>{formatTimestamp(item.timestamp)}</span>
                      {item.topics && item.topics.map((t, j) => <span key={j} style={aStyles.searchTag}>{t}</span>)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Quiz Summary */}
            <div style={aStyles.summaryRow}>
              <div style={aStyles.summaryCard}><div style={aStyles.summaryNumber}>{analytics.totalQuizzes}</div><div style={aStyles.summaryLabel}>Questions</div></div>
              <div style={aStyles.summaryCard}><div style={aStyles.summaryNumber}>{analytics.totalCorrect}</div><div style={aStyles.summaryLabel}>Correct</div></div>
              <div style={aStyles.summaryCard}><div style={{ ...aStyles.summaryNumber, color: analytics.quizAccuracy >= 70 ? "#4caf50" : analytics.quizAccuracy >= 50 ? "#d4a44a" : "#cf6679" }}>{analytics.quizAccuracy}%</div><div style={aStyles.summaryLabel}>Accuracy</div></div>
            </div>
            {/* Quiz by Topic — weakest first */}
            <div style={aStyles.section}>
              <div style={aStyles.sectionTitle}>{"\uD83D\uDEA9"} Weakest Topics (Train Here)</div>
              {(!analytics.quizTopicBreakdown || analytics.quizTopicBreakdown.length === 0) ? <div style={aStyles.emptyText}>No quiz data yet. Take some quizzes!</div> : (
                analytics.quizTopicBreakdown.map((item, i) => (
                  <div key={i} style={aStyles.topicRow}>
                    <div style={aStyles.topicHeader}>
                      <span style={{ ...aStyles.topicRank, color: item.accuracy < 50 ? "#cf6679" : item.accuracy < 70 ? "#d4a44a" : "#4caf50" }}>{item.accuracy}%</span>
                      <span style={aStyles.topicName}>{item.topic}</span>
                      <span style={aStyles.topicCount}>{item.correct}/{item.total}</span>
                    </div>
                    <div style={aStyles.barBg}><div style={{ ...aStyles.barFill, width: `${item.accuracy}%`, background: item.accuracy < 50 ? "linear-gradient(90deg, #cf6679, #b71c1c)" : item.accuracy < 70 ? "linear-gradient(90deg, #d4a44a, #b8922a)" : "linear-gradient(90deg, #4caf50, #2e7d32)" }}/></div>
                  </div>
                ))
              )}
              {analytics.quizTopicBreakdown && analytics.quizTopicBreakdown.length > 0 && (
                <div style={aStyles.gapNote}>{"\uD83D\uDEA9"} Red topics = knowledge gaps. Focus training here.</div>
              )}
            </div>
            {/* 7-Day Quiz Volume */}
            {analytics.quizWeekVolume && (
              <div style={aStyles.section}>
                <div style={aStyles.sectionTitle}>{"\uD83D\uDCC8"} Quiz Activity (7 Days)</div>
                <div style={aStyles.dayChart}>
                  {analytics.quizWeekVolume.map((day, i) => {
                    const maxQ = Math.max(...analytics.quizWeekVolume.map(d => d.total), 1);
                    return (
                      <div key={i} style={aStyles.dayColumn}>
                        <div style={aStyles.dayBarContainer}><div style={{ ...aStyles.dayBar, height: `${Math.max((day.total / maxQ) * 100, day.total > 0 ? 8 : 0)}%`, background: `linear-gradient(180deg, #4caf50, #2e7d32)` }}/></div>
                        <div style={aStyles.dayCount}>{day.correct}/{day.total}</div>
                        <div style={aStyles.dayLabel}>{formatDate(day.date)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Recent Quiz Answers */}
            <div style={aStyles.section}>
              <div style={aStyles.sectionTitle}>{"\uD83D\uDCDD"} Recent Quiz Answers</div>
              {(!analytics.recentQuizzes || analytics.recentQuizzes.length === 0) ? <div style={aStyles.emptyText}>No quiz answers yet.</div> : (
                analytics.recentQuizzes.slice(0, 20).map((item, i) => (
                  <div key={i} style={aStyles.searchRow}>
                    <div style={aStyles.searchQuestion}>
                      <span style={{ marginRight: 8 }}>{item.correct ? "\u2705" : "\u274C"}</span>
                      {item.question}
                    </div>
                    <div style={aStyles.searchMeta}>
                      <span style={aStyles.searchTime}>{formatTimestamp(item.timestamp)}</span>
                      <span style={aStyles.searchTag}>{item.topic}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <button style={aStyles.retryBtn} onClick={() => { setAnalytics(null); fetchAnalytics(); }}>{"\u21BB"} Refresh</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{globalCSS}</style>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.appTitle}>ARNG</h1>
        <div style={styles.appSubtitle}>Eligibility Advisor</div>
        <div style={styles.byline}>By Same Page</div>
        <div style={styles.motto}>Winning Matters</div>
        <div style={styles.viewToggle}>
          {[["chat", "\uD83D\uDCAC Chat"], ["quiz", "\uD83C\uDFAF Quiz"], ["analytics", "\uD83D\uDCCA Data"]].map(([v, label]) => (
            <button key={v} style={{ ...styles.toggleBtn, ...(view === v ? styles.toggleActive : {}) }} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
      </div>

      {view === "chat" ? (
        <>
          <button style={styles.kbToggle} onClick={() => setKbOpen(!kbOpen)}>
            <span>{"\uD83D\uDCCB"} Knowledge Base</span>
            <span style={{ transform: kbOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>{"\u25BE"}</span>
          </button>
          {kbOpen && (
            <div style={styles.kbPanel}>
              <div style={styles.kbRow}><span style={styles.kbLabel}>DOCUMENTS</span><span style={styles.kbValue}>20 documents &bull; 50 sections</span></div>
              <div style={styles.kbDetail}>AR 601-210 &bull; FY26 AOC &bull; WASP &bull; SMOMs &bull; CASP</div>
              <div style={styles.kbRow}><span style={styles.kbLabel}>COVERS</span></div>
              <div style={styles.kbDetail}>NPS &amp; PS eligibility &bull; Age, education, ASVAB &bull; Moral/conduct waivers &bull; Medical waivers &bull; Suitability screening &bull; BCT requirements &bull; CASP &bull; Enlistment programs &bull; MEPS processing &bull; Incentives &bull; Live Scan &bull; Security clearance &bull; Future Soldier Prep</div>
            </div>
          )}
          <div style={styles.chatArea}>
            {messages.length === 0 ? (
              <div style={styles.welcome}>
                <img src={badgeImg} alt="ARNG Recruiting and Retention Master Badge" style={styles.welcomeBadge} />
                <p style={styles.welcomeText}>Ask me anything about Army National Guard enlistment eligibility, waiver requirements, processing procedures, enlistment programs, incentives, or MEPS processing.</p>
                <div style={styles.suggestionsGrid}>
                  {suggestedQuestions.map((q, i) => <button key={i} className="suggestion-btn" onClick={() => handleSend(q)}>{q}</button>)}
                </div>
              </div>
            ) : (
              <div style={styles.messageList}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ ...styles.messageBubble, ...(msg.role === "user" ? styles.userBubble : styles.assistantBubble) }}>
                    <div style={styles.messageRole}>{msg.role === "user" ? "YOU" : "ADVISOR"}</div>
                    <div style={styles.messageContent}>{msg.content.split("\n").map((line, j) => <p key={j} style={{ margin: line === "" ? "8px 0" : "4px 0" }}>{line}</p>)}</div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={styles.sourcesArea}>
                        <span style={styles.sourcesLabel}>{"\uD83D\uDCCB"} Sources:</span>
                        {msg.sources.map((s, j) => <span key={j} style={styles.sourceTag}>{s}</span>)}
                      </div>
                    )}
                  </div>
                ))}
                {loading && <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}><div style={styles.messageRole}>ADVISOR</div><div style={styles.loadingDots}><span style={styles.loadingStatus}>{loadingStatus}</span><span className="loading-dots">...</span></div></div>}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          <div style={styles.inputArea}>
            <div style={styles.inputRow}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask about eligibility, waivers, ASVAB, prior service..." style={styles.textarea} rows={1} disabled={loading} />
              <button onClick={() => handleSend()} disabled={loading || !input.trim()} style={{ ...styles.sendBtn, opacity: loading || !input.trim() ? 0.4 : 1 }}>{"\u27A4"}</button>
            </div>
          </div>
        </>
      ) : view === "quiz" ? (
        <div style={styles.chatArea}>{renderQuiz()}</div>
      ) : (
        <div style={styles.chatArea}>{renderAnalytics()}</div>
      )}

      <div style={styles.disclaimer}>{"\u26A0"} Always verify with your chain of command. This tool is for reference only.</div>
    </div>
  );
}

/* ─── Global CSS ─── */
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: -webkit-fill-available; }
  body { margin: 0; padding: 0; background: #0a0e1a; }
  @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
  .loading-dots { animation: pulse 1.2s infinite; font-weight: bold; letter-spacing: 2px; }
  textarea::placeholder { color: #5a6580; }
  textarea:focus { outline: none; border-color: #3a6aaa !important; box-shadow: 0 0 0 2px rgba(58,106,170,0.2); }
  .suggestion-btn { background: rgba(20,28,50,0.6); border: 1px solid rgba(58,106,170,0.3); border-radius: 10px; padding: 14px 16px; color: #a4b4cc; font-size: 15px; cursor: pointer; text-align: left; transition: all 0.15s; font-family: 'DM Sans', sans-serif; line-height: 1.4; -webkit-tap-highlight-color: transparent; }
  .suggestion-btn:hover, .suggestion-btn:active { background: #1a2a4a; border-color: #d4a44a; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2a3050; border-radius: 3px; }
  @media (min-width: 600px) { .suggestion-btn { font-size: 14px; } }
`;

/* ─── Styles ─── */
const styles = {
  container: { display: "flex", flexDirection: "column", height: "100vh", minHeight: "-webkit-fill-available", fontFamily: "'DM Sans', sans-serif", background: "#0a0e1a", color: "#d4dae8", WebkitOverflowScrolling: "touch", paddingTop: "env(safe-area-inset-top)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" },
  header: { textAlign: "center", padding: "20px 16px 12px", borderBottom: "1px solid #1a2040", background: "linear-gradient(180deg, #0c1225 0%, #0a0e1a 100%)" },
  appTitle: { fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: "#d4a44a", margin: 0, letterSpacing: 5 },
  appSubtitle: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#b8922a", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 },
  byline: { fontSize: 11, color: "#b8922a", marginTop: 6 },
  motto: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#d4a44a", letterSpacing: 4, textTransform: "uppercase", marginTop: 8, opacity: 0.7 },
  viewToggle: { display: "flex", justifyContent: "center", gap: 4, marginTop: 12 },
  toggleBtn: { background: "rgba(20,28,50,0.4)", border: "1px solid #1a2040", borderRadius: 8, padding: "8px 16px", color: "#6b7b9b", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.15s", WebkitTapHighlightColor: "transparent" },
  toggleActive: { background: "rgba(58,106,170,0.2)", borderColor: "#3a6aaa", color: "#d4a44a", fontWeight: 600 },
  kbToggle: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 16px", background: "rgba(12,18,37,0.8)", border: "none", borderBottom: "1px solid #1a2040", color: "#8a9abc", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", WebkitTapHighlightColor: "transparent" },
  kbPanel: { padding: "12px 16px", background: "rgba(12,18,37,0.6)", borderBottom: "1px solid #1a2040", display: "flex", flexDirection: "column", gap: 8 },
  kbRow: { display: "flex", alignItems: "center", gap: 8 },
  kbLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: "#3a6aaa", letterSpacing: 2, textTransform: "uppercase" },
  kbValue: { fontSize: 13, fontWeight: 600, color: "#b4c4dc" },
  kbDetail: { fontSize: 12, color: "#6b7b9b", lineHeight: 1.5 },
  chatArea: { flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column" },
  welcome: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 8px" },
  welcomeBadge: { width: 120, height: "auto", marginBottom: 16, filter: "drop-shadow(0 0 12px rgba(212,164,74,0.3))" },
  welcomeText: { fontSize: 15, color: "#8a9abc", maxWidth: 480, lineHeight: 1.6, marginBottom: 20 },
  suggestionsGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 8, width: "100%", maxWidth: 480 },
  messageList: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 600, margin: "0 auto", width: "100%" },
  messageBubble: { borderRadius: 12, padding: "14px 14px" },
  userBubble: { background: "rgba(58,106,170,0.15)", border: "1px solid rgba(58,106,170,0.25)", marginLeft: 8 },
  assistantBubble: { background: "rgba(16,22,40,0.8)", border: "1px solid #1a2040" },
  messageRole: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: "#3a6aaa", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" },
  messageContent: { fontSize: 15, lineHeight: 1.7, color: "#c4d0e4" },
  sourcesArea: { marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(58,106,170,0.15)", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  sourcesLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a7abf", fontWeight: 600, letterSpacing: 1 },
  sourceTag: { background: "rgba(58,106,170,0.15)", border: "1px solid rgba(58,106,170,0.2)", borderRadius: 4, padding: "3px 8px", fontSize: 11, color: "#5a9adf", fontFamily: "'JetBrains Mono', monospace" },
  loadingDots: { fontSize: 14, color: "#6b7b9b" },
  loadingStatus: { fontSize: 12, color: "#4a7abf", fontStyle: "italic" },
  inputArea: { padding: "12px 12px 8px", borderTop: "1px solid #1a2040", background: "rgba(10,14,26,0.95)" },
  inputRow: { display: "flex", gap: 8, maxWidth: 600, margin: "0 auto", alignItems: "flex-end" },
  textarea: { flex: 1, background: "#0c1225", border: "1px solid #2a3050", borderRadius: 12, padding: "14px 16px", color: "#d4dae8", fontSize: 16, fontFamily: "'DM Sans', sans-serif", resize: "none", lineHeight: 1.5, minHeight: 52, WebkitAppearance: "none" },
  sendBtn: { background: "#1a3a6a", border: "1px solid #2a5a9a", borderRadius: 12, width: 52, height: 52, color: "#d4a44a", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0, WebkitTapHighlightColor: "transparent" },
  disclaimer: { textAlign: "center", padding: "6px 16px calc(10px + env(safe-area-inset-bottom))", fontSize: 10, color: "#4a5570", background: "rgba(10,14,26,0.95)" },
};

/* ─── Quiz Styles ─── */
const qStyles = {
  container: { maxWidth: 600, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 20 },
  header: { textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 0" },
  title: { fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#d4a44a", letterSpacing: 2 },
  subtitle: { fontSize: 13, color: "#6b7b9b" },
  scoreBar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(16,22,40,0.8)", border: "1px solid #1a2040", borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "#b4c4dc", fontFamily: "'JetBrains Mono', monospace" },
  topicTag: { background: "rgba(212,164,74,0.15)", border: "1px solid rgba(212,164,74,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#d4a44a" },
  diffRow: { display: "flex", justifyContent: "center", gap: 6 },
  diffBtn: { background: "rgba(20,28,50,0.4)", border: "1px solid #1a2040", borderRadius: 8, padding: "8px 14px", color: "#6b7b9b", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", WebkitTapHighlightColor: "transparent", transition: "all 0.15s" },
  diffActive: { background: "rgba(212,164,74,0.15)", borderColor: "#d4a44a", color: "#d4a44a", fontWeight: 600 },
  topicGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  topicBtn: { background: "rgba(20,28,50,0.6)", border: "1px solid rgba(58,106,170,0.3)", borderRadius: 10, padding: "14px 12px", color: "#a4b4cc", fontSize: 13, cursor: "pointer", textAlign: "center", transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif", WebkitTapHighlightColor: "transparent" },
  randomBtn: { background: "rgba(212,164,74,0.12)", border: "1px solid rgba(212,164,74,0.3)", borderRadius: 10, padding: "14px", color: "#d4a44a", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", WebkitTapHighlightColor: "transparent", textAlign: "center" },
  questionCard: { background: "rgba(16,22,40,0.8)", border: "1px solid #1a2040", borderRadius: 12, padding: "20px 16px" },
  questionText: { fontSize: 16, lineHeight: 1.6, color: "#d4dae8" },
  optionsGrid: { display: "flex", flexDirection: "column", gap: 8 },
  optionBtn: { background: "rgba(20,28,50,0.6)", border: "2px solid rgba(58,106,170,0.25)", borderRadius: 10, padding: "14px 16px", color: "#b4c4dc", fontSize: 14, cursor: "pointer", textAlign: "left", transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif", WebkitTapHighlightColor: "transparent", lineHeight: 1.4 },
  optionCorrect: { background: "rgba(76,175,80,0.15)", borderColor: "#4caf50", color: "#a5d6a7" },
  optionWrong: { background: "rgba(207,102,121,0.15)", borderColor: "#cf6679", color: "#ef9a9a" },
  explanationCard: { background: "rgba(16,22,40,0.8)", border: "1px solid #1a2040", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  resultBanner: { fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" },
  explanationText: { fontSize: 14, lineHeight: 1.6, color: "#b4c4dc" },
  regulationTag: { fontSize: 11, color: "#5a9adf", fontFamily: "'JetBrains Mono', monospace", background: "rgba(58,106,170,0.1)", borderRadius: 4, padding: "4px 8px", alignSelf: "flex-start" },
  nextRow: { display: "flex", gap: 8, marginTop: 4 },
  nextBtn: { flex: 1, background: "rgba(58,106,170,0.2)", border: "1px solid #3a6aaa", borderRadius: 10, padding: "12px 16px", color: "#5a9adf", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textAlign: "center", WebkitTapHighlightColor: "transparent" },
};

/* ─── Analytics Styles ─── */
const aStyles = {
  container: { maxWidth: 600, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 20 },
  center: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 },
  loadingText: { fontSize: 14, color: "#6b7b9b", fontStyle: "italic" },
  errorText: { fontSize: 14, color: "#cf6679", textAlign: "center" },
  retryBtn: { background: "rgba(58,106,170,0.2)", border: "1px solid #3a6aaa", borderRadius: 8, padding: "10px 24px", color: "#5a9adf", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", WebkitTapHighlightColor: "transparent" },
  tabRow: { display: "flex", gap: 4, justifyContent: "center" },
  tabBtn: { background: "rgba(20,28,50,0.4)", border: "1px solid #1a2040", borderRadius: 8, padding: "8px 20px", color: "#6b7b9b", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.15s", WebkitTapHighlightColor: "transparent" },
  tabActive: { background: "rgba(58,106,170,0.2)", borderColor: "#3a6aaa", color: "#d4a44a", fontWeight: 600 },
  summaryRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  summaryCard: { background: "rgba(16,22,40,0.8)", border: "1px solid #1a2040", borderRadius: 10, padding: "14px 10px", textAlign: "center" },
  summaryNumber: { fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: "#d4a44a" },
  summaryLabel: { fontSize: 10, color: "#6b7b9b", textTransform: "uppercase", letterSpacing: 1, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" },
  section: { background: "rgba(16,22,40,0.6)", border: "1px solid #1a2040", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 },
  sectionTitle: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#b8922a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  dayChart: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 130, gap: 4, paddingTop: 10 },
  dayColumn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" },
  dayBarContainer: { flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" },
  dayBar: { width: "70%", background: "linear-gradient(180deg, #d4a44a, #b8922a)", borderRadius: "4px 4px 0 0", transition: "height 0.3s", minWidth: 8 },
  dayCount: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "#d4a44a", marginTop: 4 },
  dayLabel: { fontSize: 9, color: "#5a6580", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" },
  topicRow: { display: "flex", flexDirection: "column", gap: 4 },
  topicHeader: { display: "flex", alignItems: "center", gap: 8 },
  topicRank: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a5570", minWidth: 24 },
  topicName: { flex: 1, fontSize: 13, color: "#b4c4dc" },
  topicCount: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#d4a44a", minWidth: 24, textAlign: "right" },
  barBg: { height: 6, background: "rgba(20,28,50,0.8)", borderRadius: 3, overflow: "hidden", marginLeft: 32 },
  barFill: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  gapNote: { fontSize: 11, color: "#6b7b9b", fontStyle: "italic", padding: "8px 0 0", borderTop: "1px solid rgba(26,32,64,0.5)", marginTop: 4 },
  searchRow: { padding: "10px 0", borderBottom: "1px solid rgba(26,32,64,0.5)", display: "flex", flexDirection: "column", gap: 6 },
  searchQuestion: { fontSize: 13, color: "#c4d0e4", lineHeight: 1.4 },
  searchMeta: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  searchTime: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a5570" },
  searchTag: { background: "rgba(58,106,170,0.12)", border: "1px solid rgba(58,106,170,0.2)", borderRadius: 4, padding: "2px 6px", fontSize: 10, color: "#5a9adf", fontFamily: "'JetBrains Mono', monospace" },
  emptyText: { fontSize: 13, color: "#5a6580", fontStyle: "italic", textAlign: "center", padding: "20px 0" },
};
