import { useState, useRef, useEffect } from "react";
import badgeImg from "/badge.png";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [kbOpen, setKbOpen] = useState(false);
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
    setLoadingStatus("Analyzing regulations...");

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

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `Server error (${res.status})`);
      }

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

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.appTitle}>ARNG</h1>
        <div style={styles.appSubtitle}>Eligibility Advisor</div>
        <div style={styles.byline}>By Same Page</div>
        <div style={styles.motto}>Winning Matters</div>
      </div>

      {/* Collapsible Knowledge Base */}
      <button
        style={styles.kbToggle}
        onClick={() => setKbOpen(!kbOpen)}
      >
        <span>{"\uD83D\uDCCB"} Knowledge Base</span>
        <span style={{ transform: kbOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>{"\u25BE"}</span>
      </button>
      {kbOpen && (
        <div style={styles.kbPanel}>
          <div style={styles.kbRow}>
            <span style={styles.kbLabel}>DOCUMENTS</span>
            <span style={styles.kbValue}>20 documents &bull; 50 sections</span>
          </div>
          <div style={styles.kbDetail}>
            AR 601-210 &bull; FY26 AOC &bull; WASP &bull; SMOMs &bull; CASP
          </div>
          <div style={styles.kbRow}>
            <span style={styles.kbLabel}>COVERS</span>
          </div>
          <div style={styles.kbDetail}>
            NPS &amp; PS eligibility &bull; Age, education, ASVAB &bull; Moral/conduct waivers &bull; Medical waivers &bull; Suitability screening &bull; BCT requirements &bull; CASP &bull; Enlistment programs &bull; MEPS processing &bull; Incentives &bull; Live Scan &bull; Security clearance &bull; Future Soldier Prep
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div style={styles.chatArea}>
        {messages.length === 0 ? (
          <div style={styles.welcome}>
            <img
              src={badgeImg}
              alt="ARNG Recruiting and Retention Master Badge"
              style={styles.welcomeBadge}
            />
            <p style={styles.welcomeText}>
              Ask me anything about Army National Guard enlistment eligibility,
              waiver requirements, processing procedures, enlistment programs,
              incentives, or MEPS processing.
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
                    <span style={styles.sourcesLabel}>{"\uD83D\uDCCB"} Sources:</span>
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
            placeholder="Ask about eligibility, waivers, ASVAB, prior service..."
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
            {"\u27A4"}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={styles.disclaimer}>
        {"\u26A0"} Always verify with your chain of command. This tool is for reference only.
      </div>
    </div>
  );
}

/* ─── Global CSS ─── */

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: -webkit-fill-available; }
  body { margin: 0; padding: 0; background: #0a0e1a; }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .loading-dots {
    animation: pulse 1.2s infinite;
    font-weight: bold;
    letter-spacing: 2px;
  }

  textarea::placeholder { color: #5a6580; }
  textarea:focus {
    outline: none;
    border-color: #3a6aaa !important;
    box-shadow: 0 0 0 2px rgba(58,106,170,0.2);
  }

  .suggestion-btn {
    background: rgba(20,28,50,0.6);
    border: 1px solid rgba(58,106,170,0.3);
    border-radius: 10px;
    padding: 14px 16px;
    color: #a4b4cc;
    font-size: 15px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    font-family: 'DM Sans', sans-serif;
    line-height: 1.4;
    -webkit-tap-highlight-color: transparent;
  }
  .suggestion-btn:hover,
  .suggestion-btn:active {
    background: #1a2a4a;
    border-color: #d4a44a;
  }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2a3050; border-radius: 3px; }

  @media (min-width: 600px) {
    .suggestion-btn { font-size: 14px; }
  }
`;

/* ─── Inline Styles (Blue & Gold, Mobile-First) ─── */

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    minHeight: "-webkit-fill-available",
    fontFamily: "'DM Sans', sans-serif",
    background: "#0a0e1a",
    color: "#d4dae8",
    WebkitOverflowScrolling: "touch",
    paddingTop: "env(safe-area-inset-top)",
    paddingLeft: "env(safe-area-inset-left)",
    paddingRight: "env(safe-area-inset-right)",
  },

  /* Header */
  header: {
    textAlign: "center",
    padding: "20px 16px 16px",
    borderBottom: "1px solid #1a2040",
    background: "linear-gradient(180deg, #0c1225 0%, #0a0e1a 100%)",
  },
  appTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 22,
    fontWeight: 700,
    color: "#d4a44a",
    margin: 0,
    letterSpacing: 5,
  },
  appSubtitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    color: "#b8922a",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: 4,
  },
  byline: {
    fontSize: 11,
    color: "#b8922a",
    marginTop: 6,
  },
  motto: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    color: "#d4a44a",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginTop: 8,
    opacity: 0.7,
  },

  /* Knowledge Base */
  kbToggle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "10px 16px",
    background: "rgba(12,18,37,0.8)",
    border: "none",
    borderBottom: "1px solid #1a2040",
    color: "#8a9abc",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  kbPanel: {
    padding: "12px 16px",
    background: "rgba(12,18,37,0.6)",
    borderBottom: "1px solid #1a2040",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  kbRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  kbLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    color: "#3a6aaa",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  kbValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "#b4c4dc",
  },
  kbDetail: {
    fontSize: 12,
    color: "#6b7b9b",
    lineHeight: 1.5,
  },

  /* Chat Area */
  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
  },

  /* Welcome */
  welcome: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "0 8px",
  },
  welcomeBadge: {
    width: 120,
    height: "auto",
    marginBottom: 16,
    filter: "drop-shadow(0 0 12px rgba(212,164,74,0.3))",
  },
  welcomeText: {
    fontSize: 15,
    color: "#8a9abc",
    maxWidth: 480,
    lineHeight: 1.6,
    marginBottom: 20,
  },
  suggestionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
    width: "100%",
    maxWidth: 480,
  },

  /* Messages */
  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxWidth: 600,
    margin: "0 auto",
    width: "100%",
  },
  messageBubble: {
    borderRadius: 12,
    padding: "14px 14px",
  },
  userBubble: {
    background: "rgba(58,106,170,0.15)",
    border: "1px solid rgba(58,106,170,0.25)",
    marginLeft: 8,
  },
  assistantBubble: {
    background: "rgba(16,22,40,0.8)",
    border: "1px solid #1a2040",
  },
  messageRole: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    color: "#3a6aaa",
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 1.7,
    color: "#c4d0e4",
  },
  sourcesArea: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: "1px solid rgba(58,106,170,0.15)",
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  sourcesLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    color: "#4a7abf",
    fontWeight: 600,
    letterSpacing: 1,
  },
  sourceTag: {
    background: "rgba(58,106,170,0.15)",
    border: "1px solid rgba(58,106,170,0.2)",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 11,
    color: "#5a9adf",
    fontFamily: "'JetBrains Mono', monospace",
  },
  loadingDots: { fontSize: 14, color: "#6b7b9b" },
  loadingStatus: { fontSize: 12, color: "#4a7abf", fontStyle: "italic" },

  /* Input */
  inputArea: {
    padding: "12px 12px 8px",
    borderTop: "1px solid #1a2040",
    background: "rgba(10,14,26,0.95)",
  },
  inputRow: {
    display: "flex",
    gap: 8,
    maxWidth: 600,
    margin: "0 auto",
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    background: "#0c1225",
    border: "1px solid #2a3050",
    borderRadius: 12,
    padding: "14px 16px",
    color: "#d4dae8",
    fontSize: 16,
    fontFamily: "'DM Sans', sans-serif",
    resize: "none",
    lineHeight: 1.5,
    minHeight: 52,
    WebkitAppearance: "none",
  },
  sendBtn: {
    background: "#1a3a6a",
    border: "1px solid #2a5a9a",
    borderRadius: 12,
    width: 52,
    height: 52,
    color: "#d4a44a",
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
  },

  /* Disclaimer */
  disclaimer: {
    textAlign: "center",
    padding: "6px 16px calc(10px + env(safe-area-inset-bottom))",
    fontSize: 10,
    color: "#4a5570",
    background: "rgba(10,14,26,0.95)",
  },
};
