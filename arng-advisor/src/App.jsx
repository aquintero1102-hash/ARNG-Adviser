import { useState, useRef, useEffect } from "react";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    setLoadingStatus("Searching regulations & drafting answer...");

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.message}. Please try again.`,
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={styles.container}>
      <style>{globalCSS}</style>

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logoArea}>
          <div style={styles.shield}>⚔</div>
          <h1 style={styles.appTitle}>ARNG</h1>
          <h2 style={styles.appSubtitle}>Eligibility Advisor</h2>
          <p style={styles.byline}>by Andres Quintero</p>
        </div>
        <div style={styles.sidebarInfo}>
          <div style={styles.infoLabel}>KNOWLEDGE BASE</div>
          <div style={styles.infoValue}>20 regulatory documents</div>
          <div style={styles.infoDetail}>
            AR 601-210 &bull; FY26 AOC &bull; WASP &bull; SMOMs &bull; CASP
          </div>
        </div>
        <div style={styles.sidebarInfo}>
          <div style={styles.infoLabel}>COVERS</div>
          <div style={styles.infoDetail}>
            NPS & PS eligibility &bull; Age, education, ASVAB &bull;
            Moral/conduct waivers &bull; Medical waivers &bull; Suitability
            screening &bull; BCT requirements &bull; CASP &bull; Enlistment
            programs
          </div>
        </div>
        <div style={styles.disclaimer}>
          ⚠ Always verify with your chain of command. This tool is for reference
          only.
        </div>
      </div>

      {/* Main area */}
      <div style={styles.main}>
        {/* Mobile header */}
        <div style={styles.mobileHeader}>
          <span style={styles.mobileTitle}>ARNG</span>
          <span style={styles.mobileSub}>Eligibility Advisor</span>
          <span style={styles.mobileBy}>by Andres Quintero</span>
        </div>

        <div style={styles.chatArea}>
          {messages.length === 0 ? (
            <div style={styles.welcome}>
              <div style={styles.welcomeIcon}>🎖️</div>
              <h2 style={styles.welcomeTitle}>ARNG Eligibility Advisor</h2>
              <p style={styles.welcomeByline}>by Andres Quintero</p>
              <p style={styles.welcomeText}>
                Ask me anything about Army National Guard enlistment eligibility,
                waiver requirements, or processing procedures. I reference
                official ARNG regulations including AR 601-210, FY26 AOC, WASP,
                and current SMOMs.
              </p>
              <div style={styles.suggestionsGrid}>
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    className="suggestion-btn"
                    onClick={() => handleSend(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={styles.messageList}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.messageBubble,
                    ...(msg.role === "user"
                      ? styles.userBubble
                      : styles.assistantBubble),
                  }}
                >
                  <div style={styles.messageRole}>
                    {msg.role === "user" ? "YOU" : "ADVISOR"}
                  </div>
                  <div style={styles.messageContent}>
                    {msg.content.split("\n").map((line, j) => (
                      <p
                        key={j}
                        style={{ margin: line === "" ? "8px 0" : "4px 0" }}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={styles.sourcesArea}>
                      <span style={styles.sourcesLabel}>📋 Sources:</span>
                      {msg.sources.map((s, j) => (
                        <span key={j} style={styles.sourceTag}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div
                  style={{
                    ...styles.messageBubble,
                    ...styles.assistantBubble,
                  }}
                >
                  <div style={styles.messageRole}>ADVISOR</div>
                  <div style={styles.loadingDots}>
                    <span style={styles.loadingStatus}>{loadingStatus}</span>
                    <span className="loading-dots">...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={styles.inputArea}>
          <div style={styles.inputRow}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about eligibility, waivers, ASVAB requirements, prior service rules..."
              style={styles.textarea}
              rows={1}
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              style={{
                ...styles.sendBtn,
                opacity: loading || !input.trim() ? 0.4 : 1,
              }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Styles ─── */

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .loading-dots {
    animation: pulse 1.2s infinite;
    font-weight: bold;
    letter-spacing: 2px;
  }

  textarea::placeholder { color: #6b7b6b; }
  textarea:focus {
    outline: none;
    border-color: #4a7a4a !important;
    box-shadow: 0 0 0 2px rgba(74,122,74,0.2);
  }

  .suggestion-btn {
    background: rgba(30,40,30,0.6);
    border: 1px solid rgba(74,122,74,0.3);
    border-radius: 8px;
    padding: 12px 16px;
    color: #a4bca4;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    font-family: 'DM Sans', sans-serif;
    line-height: 1.4;
  }
  .suggestion-btn:hover {
    background: #2a3a2a;
    border-color: #4a7a4a;
  }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #3a4a3a; border-radius: 3px; }

  @media (max-width: 768px) {
    .sidebar-desktop { display: none !important; }
    .mobile-header { display: flex !important; }
  }
`;

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    fontFamily: "'DM Sans', sans-serif",
    background: "#0d1410",
    color: "#d4ddd4",
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    background: "linear-gradient(180deg, #0f1a14 0%, #0a120e 100%)",
    borderRight: "1px solid #1a2a1a",
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    overflowY: "auto",
    className: "sidebar-desktop",
  },
  logoArea: {
    textAlign: "center",
    paddingBottom: 20,
    borderBottom: "1px solid rgba(74,122,74,0.2)",
  },
  shield: {
    fontSize: 36,
    marginBottom: 8,
    filter: "drop-shadow(0 0 8px rgba(74,122,74,0.4))",
  },
  appTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 22,
    fontWeight: 700,
    color: "#7ab87a",
    margin: 0,
    letterSpacing: 6,
  },
  appSubtitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    fontWeight: 400,
    color: "#5a8a5a",
    margin: "4px 0 0",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  byline: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 10,
    color: "#4a7a4a",
    margin: "8px 0 0",
    letterSpacing: 1,
  },
  sidebarInfo: { display: "flex", flexDirection: "column", gap: 6 },
  infoLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    color: "#4a7a4a",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  infoValue: { fontSize: 14, fontWeight: 600, color: "#b4ccb4" },
  infoDetail: { fontSize: 12, color: "#6b8b6b", lineHeight: 1.5 },
  disclaimer: {
    borderTop: "1px solid rgba(255,255,255,0.1)",
    paddingTop: 16,
    fontSize: 12,
    color: "#6b8b6b",
    lineHeight: 1.5,
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  mobileHeader: {
    display: "none",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    borderBottom: "1px solid #1a2a1a",
    background: "rgba(10,18,14,0.95)",
  },
  mobileTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 16,
    fontWeight: 700,
    color: "#7ab87a",
    letterSpacing: 4,
  },
  mobileSub: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    color: "#5a8a5a",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  mobileBy: {
    fontSize: 9,
    color: "#4a7a4a",
    marginLeft: "auto",
  },
  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 24px",
  },
  welcome: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    textAlign: "center",
    padding: "0 40px",
  },
  welcomeIcon: { fontSize: 48, marginBottom: 16 },
  welcomeTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 20,
    fontWeight: 700,
    color: "#7ab87a",
    margin: "0 0 4px",
    letterSpacing: 2,
  },
  welcomeByline: {
    fontSize: 11,
    color: "#5a8a5a",
    margin: "0 0 16px",
    fontStyle: "italic",
  },
  welcomeText: {
    fontSize: 14,
    color: "#8aaa8a",
    maxWidth: 520,
    lineHeight: 1.6,
    margin: "0 0 32px",
  },
  suggestionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    maxWidth: 600,
    width: "100%",
  },
  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 800,
    margin: "0 auto",
    width: "100%",
  },
  messageBubble: {
    borderRadius: 12,
    padding: "14px 18px",
  },
  userBubble: {
    background: "rgba(74,122,74,0.15)",
    border: "1px solid rgba(74,122,74,0.25)",
    marginLeft: 40,
  },
  assistantBubble: {
    background: "rgba(20,30,22,0.8)",
    border: "1px solid #1a2a1a",
    marginRight: 20,
  },
  messageRole: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    color: "#4a7a4a",
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 1.65,
    color: "#c4d8c4",
  },
  sourcesArea: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid rgba(74,122,74,0.15)",
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  sourcesLabel: {
    fontSize: 10,
    color: "#5a8a5a",
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: 1,
  },
  sourceTag: {
    background: "rgba(74,122,74,0.15)",
    border: "1px solid rgba(74,122,74,0.2)",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 10,
    color: "#7ab87a",
    fontFamily: "'JetBrains Mono', monospace",
  },
  loadingDots: { fontSize: 14, color: "#6b8b6b" },
  loadingStatus: { fontSize: 12, color: "#5a8a5a", fontStyle: "italic" },
  inputArea: {
    padding: "16px 24px 20px",
    borderTop: "1px solid #1a2a1a",
    background: "rgba(10,18,14,0.9)",
  },
  inputRow: {
    display: "flex",
    gap: 10,
    maxWidth: 800,
    margin: "0 auto",
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    background: "#0f1a14",
    border: "1px solid #2a3a2a",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#d4ddd4",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    resize: "none",
    lineHeight: 1.5,
  },
  sendBtn: {
    background: "#2a5a2a",
    border: "1px solid #3a7a3a",
    borderRadius: 10,
    width: 46,
    height: 46,
    color: "#b4e0b4",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
    flexShrink: 0,
  },
};
