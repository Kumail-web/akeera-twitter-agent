import { useState, useEffect, useCallback } from "react";

/* ─── BRAND CONFIG ─────────────────────────────────────────────── */
const BRAND = {
  pillars: {
    product: {
      label: "Product Features", icon: "⚙️", color: "#3B82F6", glow: "#3B82F618",
      topics: ["OPDMedQR workflow automation","IPDMedQR admissions flow","BillMedQR billing transparency","LabQR diagnostics speed","MedIQ pharmacy management","real-time hospital dashboards","AI clinical decision support"],
    },
    insight: {
      label: "Industry Insights", icon: "💡", color: "#10B981", glow: "#10B98118",
      topics: ["digital health transformation India","hospital efficiency statistics","AI in healthcare 2025","patient safety innovations","NABH compliance best practices","ABDM digital health ecosystem","healthcare cost reduction"],
    },
    company: {
      label: "Company News", icon: "📣", color: "#F59E0B", glow: "#F59E0B18",
      topics: ["Akeera milestones","new hospital partnerships","product updates","founder mission","team culture","industry recognition","customer wins"],
    },
  },
};

const TONES = [
  { id: "bold", label: "Bold & Punchy" },
  { id: "professional", label: "Professional" },
  { id: "storytelling", label: "Storytelling" },
  { id: "data", label: "Data-Driven" },
];

const SAMPLES = {
  product: [
    "Most hospital billing errors aren't fraud. They're fatigue. Staff entering the same data into three systems by end of shift.\n\nBillMedQR closes that loop.",
    "An OPD that runs on paper in 2025 isn't a technology problem. It's a leadership decision waiting to be made.\n\n#IndiaHealthcare",
    "Pharmacy stock-outs in Indian hospitals cost more in patient trust than they do in rupees. MedIQ tracks consumption patterns before the shortage happens.",
  ],
  insight: [
    "The hospitals getting NABH accreditation fastest aren't the biggest ones. They're the ones with the clearest internal processes.",
    "ABDM compliance isn't the hard part. The hard part is getting your existing workflows to survive the transition.\n\n#ABDM",
    "Less than 12% of India's 70,000 hospitals are fully digitized. The problem isn't awareness. It's that most available software wasn't built for how Indian hospitals actually work.",
  ],
  company: [
    "We didn't build MedQR to replace hospital staff. We built it because good staff shouldn't have to spend their shifts doing what software can do.",
    "Three years of being inside hospitals taught us one thing: the bottleneck is never where administrators think it is.",
    "VaidAI isn't about replacing clinical judgment. It's about making sure the right information reaches the right person before the decision has to be made.",
  ],
};

/* ─── PKCE HELPERS ──────────────────────────────────────────────── */
async function generateVerifier() {
  const a = new Uint8Array(32); crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function generateChallenge(v) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

/* ─── LOCAL STORAGE HOOK ────────────────────────────────────────── */
function useLS(key, init) {
  const [v, sv] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; }
  });
  const set = useCallback(x => {
    sv(prev => {
      const next = typeof x === "function" ? x(prev) : x;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [v, set];
}

/* ═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [tab, setTab] = useState("generate");
  const [pillar, setPillar] = useState("product");
  const [tone, setTone] = useState("bold");
  const [note, setNote] = useState("");
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genErr, setGenErr] = useState(null);
  const [copied, setCopied] = useState(null);
  const [posting, setPosting] = useState(null);
  const [postRes, setPostRes] = useState({});
  const [toast, setToast] = useState(null);
  const [library, setLibrary] = useLS("ak_lib", []);
  const [queue, setQueue] = useLS("ak_queue", []);
  const [clientId, setClientId] = useLS("ak_cid", "");
  const [creds, setCreds] = useLS("ak_creds", null);
  const [oauthErr, setOauthErr] = useState("");
  const [hour, setHour] = useLS("ak_hour", 9);
  const [activePillars, setActivePillars] = useLS("ak_pillars", ["product","insight","company"]);
  const [showConnect, setShowConnect] = useState(false);

  const connected = !!creds?.accessToken;

  function flash(msg, type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),3000); }

  /* ── OAuth callback handler ── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("code"), state = p.get("state");
    if (!code) return;
    const sv = sessionStorage.getItem("pkce_v");
    const ss = sessionStorage.getItem("pkce_s");
    const sc = sessionStorage.getItem("pkce_c");
    if (!sv || state !== ss) return;
    (async () => {
      try {
        const redirect = window.location.origin + window.location.pathname;
        const res = await fetch("https://api.twitter.com/2/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code, grant_type: "authorization_code",
            client_id: sc, redirect_uri: redirect, code_verifier: sv
          }).toString(),
        });
        const d = await res.json();
        if (d.access_token) {
          setCreds({ accessToken: d.access_token, refreshToken: d.refresh_token, exp: Date.now() + (d.expires_in||7200)*1000 });
          setClientId(sc);
          ["pkce_v","pkce_s","pkce_c"].forEach(k => sessionStorage.removeItem(k));
          window.history.replaceState({}, "", window.location.pathname);
          flash("✓ Twitter connected successfully!");
        } else {
          throw new Error(d.error_description || "Token exchange failed");
        }
      } catch(e) { setOauthErr(e.message); }
    })();
  }, []);

  async function connectTwitter() {
    if (!clientId.trim()) { setOauthErr("Enter your Client ID first"); return; }
    setOauthErr("");
    const v = await generateVerifier();
    const c = await generateChallenge(v);
    const s = Math.random().toString(36).slice(2);
    sessionStorage.setItem("pkce_v", v);
    sessionStorage.setItem("pkce_s", s);
    sessionStorage.setItem("pkce_c", clientId);
    const redirect = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${redirect}&scope=${encodeURIComponent("tweet.read tweet.write users.read offline.access")}&state=${s}&code_challenge=${c}&code_challenge_method=S256`;
  }

  /* ── Generate tweets via OpenAI ── */
  async function generate() {
    setLoading(true); setGenErr(null); setTweets([]); setPostRes({});
    const pc = BRAND.pillars[pillar];
    const topics = [...pc.topics].sort(() => Math.random()-.5).slice(0,2).join(" and ");

    const sys = `You are writing tweets for Meghna Saxena — founder of Akeera, building the MedQR ecosystem.

WHO MEGHNA IS:
- Founder building three products: MedQR (AI hospital OS), MedIQ (pharmacy intelligence), VaidAI (agent orchestration for clinical & hospital workflows)
- She has deep, firsthand knowledge of how Indian hospitals actually operate — the chaos, the workarounds, the human cost of broken systems
- She writes from a founder's perspective: calm, observant, systems-thinker
- Her audience: hospital owners, administrators, clinicians, healthtech founders, AI builders

MEGHNA'S VOICE — STRICT RULES:
- Tone: thoughtful, observant, calm authority. Practical. Grounded in real hospital workflows
- NEVER use hype, buzzwords, emojis, or aggressive marketing language
- NEVER use phrases like "game-changer", "revolutionize", "unlock", "seamless", "leverage", "excited to share"
- NO emojis whatsoever
- Keep tweets short: 1–3 lines, strictly under 240 characters
- Content structure: observation → insight → subtle implication (never a hard sell)
- Mix: 80% healthcare/systems insights, 10% founder thoughts, 10% subtle product mentions
- When mentioning products, connect naturally to the insight — never as a pitch
- Write like a thoughtful person, not a brand account
- No hashtags unless they are very specific and relevant (max 1–2, never generic)

INDIA HEALTHCARE CONTEXT — USE NATURALLY:
- India has 70,000+ hospitals, less than 12% fully digitized
- Most hospitals in Tier 2 and Tier 3 cities still run on paper or basic software
- Government initiatives: ABDM, Ayushman Bharat, PM-JAY, NHA, NABH accreditation
- Real pain points: OPD patients waiting 2–3 hours, billing errors costing lakhs, PM-JAY claim rejections, pharmacy stock-outs, lab report delays
- AI in Indian healthcare growing 40%+ annually
- Competitors: Practo, eHospital, Insta HMS
- Akeera's real customers: Yash Hospital, Krystal, Apex
- Decision makers: hospital owners, medical directors, nursing home CEOs, healthcare chain CTOs
- Use ₹ when referencing costs, use Indian city names where relevant

TWEET EXAMPLES IN MEGHNA'S VOICE:
- "Most hospital billing errors aren't fraud. They're fatigue. Staff entering the same data into three systems by end of shift."
- "An OPD that runs on paper in 2025 isn't a technology problem. It's a leadership decision waiting to be made."
- "ABDM compliance isn't the hard part. The hard part is getting your existing workflows to survive the transition."
- "The hospitals getting NABH accreditation fastest aren't the biggest ones. They're the ones with the clearest internal processes."
- "Pharmacy stock-outs in Indian hospitals cost more in patient trust than they do in rupees."

Return ONLY a raw JSON array of 3 tweet strings. No markdown, no preamble, no explanation. Just: ["tweet1","tweet2","tweet3"]`;

    const usr = `Content Pillar: ${pc.label}
Topics to draw from: ${topics}
Tone preference: ${tone}
${note ? `Special instruction from Meghna: ${note}` : ""}

Write 3 tweets in Meghna's voice. Each must have a completely different angle, observation, or insight. No two should feel similar in structure or idea. They should read like real thoughts from a founder who spends time in hospitals — not marketing copy.

Return: ["tweet1","tweet2","tweet3"]`;

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 1200,
          temperature: 0.9,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: usr }
          ]
        })
      });
      const d = await r.json();
      const raw = d.choices?.[0]?.message?.content || "[]";
      setTweets(JSON.parse(raw.replace(/```json|```/g,"").trim()));
    } catch {
      setTweets(SAMPLES[pillar]);
      setGenErr("Could not reach OpenAI API — showing sample tweets instead.");
    } finally { setLoading(false); }
  }

  /* ── Post tweet to Twitter ── */
  async function postTweet(text, key) {
    if (!connected) { setShowConnect(true); return; }
    setPosting(key);
    try {
      const r = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail || e.title || "API error"); }
      setPostRes(p => ({...p, [key]: "ok"}));
      setLibrary(prev => [{ id: Date.now(), text, pillar, at: new Date().toLocaleString(), status: "posted" }, ...prev]);
      flash("🚀 Posted to @AkeeraHQ!");
    } catch(e) {
      setPostRes(p => ({...p, [key]: "err"}));
      flash("Error: " + e.message, "err");
    } finally { setPosting(null); }
  }

  function schedule(text) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    setQueue(prev => [...prev, { id: Date.now(), text, pillar, scheduledFor: d.toLocaleString(), ts: d.getTime(), status: "scheduled" }]);
    flash("📅 Scheduled for " + d.toLocaleString());
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key); setTimeout(() => setCopied(null), 2000);
  }

  function save(text) {
    setLibrary(prev => [{ id: Date.now(), text, pillar, at: new Date().toLocaleString(), status: "saved" }, ...prev]);
    flash("🔖 Saved to library");
  }

  const pc = BRAND.pillars[pillar];
  const pendingQ = queue.filter(t => t.status === "scheduled");

  /* ── Reusable Tweet Card ── */
  function TweetCard({ text: initialText, tkey, showBadge }) {
    const [localEdit, setLocalEdit] = useState(false);
    const [editTxt, setEditTxt] = useState(initialText);
    const [finalTxt, setFinalTxt] = useState(initialText);
    const p = BRAND.pillars[pillar];
    const isPosted = postRes[tkey] === "ok";
    const isErr = postRes[tkey] === "err";

    return (
      <div style={{ background:"#0C1118", border:`1px solid ${isPosted?"#10B98125":"#161D2B"}`, borderRadius:14, padding:"18px 20px", marginBottom:14, transition:"all .2s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <div style={{ width:34, height:34, background:"linear-gradient(135deg,#3B82F618,#1D4ED812)", border:"1px solid #3B82F625", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🏥</div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:"#E2E8F4" }}>Akeera</div>
            <div style={{ fontSize:11, color:"#2D3748" }}>@AkeeraHQ</div>
          </div>
          {showBadge && <span style={{ marginLeft:"auto", background:p.glow, color:p.color, border:`1px solid ${p.color}30`, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:600 }}>{p.icon} {p.label}</span>}
        </div>

        {localEdit ? (
          <div>
            <textarea value={editTxt} onChange={e => setEditTxt(e.target.value)} style={{ width:"100%", background:"#07090F", border:"1px solid #3B82F630", borderRadius:8, color:"#E2E8F4", padding:"10px 12px", fontSize:13, height:110, lineHeight:1.65, fontFamily:"inherit", resize:"none", outline:"none" }} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
              <span style={{ fontSize:11, color:editTxt.length>280?"#F87171":"#2D3748" }}>{editTxt.length}/280</span>
              <div style={{ display:"flex", gap:7 }}>
                <BtnSmall onClick={() => { setEditTxt(finalTxt); setLocalEdit(false); }}>Cancel</BtnSmall>
                <BtnSmall onClick={() => { setFinalTxt(editTxt); setLocalEdit(false); }} accent>Save</BtnSmall>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize:13.5, lineHeight:1.7, color:"#94A3B8", whiteSpace:"pre-wrap", marginBottom:12 }}>{finalTxt}</div>
        )}

        {!localEdit && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
            <span style={{ fontSize:11, color:finalTxt.length>280?"#F87171":"#1E293B" }}>{finalTxt.length}/280</span>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              <IconBtn onClick={() => { setLocalEdit(true); setEditTxt(finalTxt); }}>✏️</IconBtn>
              <IconBtn onClick={() => save(finalTxt)}>🔖</IconBtn>
              <TextBtn
                onClick={() => copy(finalTxt, tkey)}
                style={{ background:copied===tkey?"#0E1A14":"#111827", border:`1px solid ${copied===tkey?"#10B98130":"transparent"}`, color:copied===tkey?"#6EE7B7":"#4B5563" }}
              >
                {copied===tkey ? "✓" : "Copy"}
              </TextBtn>
              <TextBtn onClick={() => schedule(finalTxt)} style={{ background:"#0F1624", border:"1px solid #3B82F425", color:"#6EE7B7", fontWeight:500 }}>
                📅 Schedule
              </TextBtn>
              <TextBtn
                onClick={() => postTweet(finalTxt, tkey)}
                disabled={posting===tkey || isPosted}
                style={{
                  background: isPosted?"#0E1A14":isErr?"#1A0E0E":"linear-gradient(135deg,#1D9BF0,#1572B6)",
                  border: `1px solid ${isPosted?"#10B98130":isErr?"#F8717130":"transparent"}`,
                  color: isPosted?"#6EE7B7":isErr?"#F87171":"#fff",
                  fontWeight:600, minWidth:80
                }}
              >
                {posting===tkey ? <Spin/> : isPosted ? "✓ Posted" : isErr ? "✗ Retry" : "Post on 𝕏"}
              </TextBtn>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════ RENDER ══════════════════════════════════ */
  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:"#07090F", minHeight:"100vh", color:"#E2E8F4" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        textarea,input{font-family:inherit;outline:none;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:#161D2B;border-radius:4px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes pulseRing{0%{box-shadow:0 0 0 0 #10B98155}70%{box-shadow:0 0 0 7px transparent}100%{box-shadow:0 0 0 0 transparent}}
        .fade{animation:fadeUp .35s ease both;}
        button{cursor:pointer;font-family:inherit;}
        button:disabled{cursor:not-allowed;opacity:.45;}
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:18, right:18, zIndex:9999, background:toast.type==="err"?"#130A0A":"#0A1610", border:`1px solid ${toast.type==="err"?"#F8717140":"#10B98140"}`, color:toast.type==="err"?"#F87171":"#6EE7B7", padding:"11px 18px", borderRadius:10, fontSize:13, fontWeight:500, animation:"fadeUp .2s ease", boxShadow:"0 8px 32px #00000066" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ borderBottom:"1px solid #0F1623", padding:"0 24px", background:"#07090F" }}>
        <div style={{ maxWidth:980, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:58 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:32, height:32, background:"linear-gradient(135deg,#3B82F6,#1D4ED8)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🏥</div>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:800, color:"#F1F5FF", letterSpacing:"-.3px" }}>
                Akeera <span style={{ color:"#3B82F6" }}>×</span> Twitter Agent
              </div>
              <div style={{ fontSize:9, color:"#1E293B", letterSpacing:"1.4px", textTransform:"uppercase" }}>AI · Daily · Auto-Publish</div>
            </div>
          </div>
          <button onClick={() => setShowConnect(true)} style={{ background:connected?"#0A160F":"#0D1320", border:`1px solid ${connected?"#10B98130":"#3B82F630"}`, color:connected?"#6EE7B7":"#93C5FD", padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:500, display:"flex", alignItems:"center", gap:8 }}>
            {connected
              ? <><span style={{ width:7, height:7, borderRadius:"50%", background:"#10B981", display:"inline-block", animation:"pulseRing 1.5s ease infinite" }}/>Connected</>
              : <>⚡ Connect Twitter</>}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ borderBottom:"1px solid #0F1623", padding:"0 24px" }}>
        <div style={{ maxWidth:980, margin:"0 auto", display:"flex" }}>
          {[
            { id:"generate", label:"Generate", ico:"✦" },
            { id:"schedule", label:"Schedule", ico:"◷", n:pendingQ.length },
            { id:"library", label:"History", ico:"▤", n:library.length },
            { id:"settings", label:"Settings", ico:"◈" }
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background:"none", border:"none", borderBottom:tab===t.id?"2px solid #3B82F6":"2px solid transparent", color:tab===t.id?"#F1F5FF":"#2D3748", padding:"13px 16px", fontSize:13, fontWeight:tab===t.id?600:400, display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:10 }}>{t.ico}</span>{t.label}
              {t.n > 0 && <span style={{ background:"#3B82F6", color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:9, fontWeight:700 }}>{t.n}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ maxWidth:980, margin:"0 auto", padding:"26px 24px" }}>

        {/* ═══ GENERATE ═══ */}
        {tab === "generate" && (
          <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:22 }}>
            {/* Controls */}
            <div>
              <SLabel>Content Pillar</SLabel>
              {Object.entries(BRAND.pillars).map(([k,p]) => (
                <button key={k} onClick={() => setPillar(k)} style={{ width:"100%", textAlign:"left", background:pillar===k?p.glow:"transparent", border:`1px solid ${pillar===k?p.color+"30":"#0F1623"}`, color:pillar===k?p.color:"#2D3748", padding:"9px 12px", borderRadius:8, fontSize:12, marginBottom:5, fontWeight:pillar===k?600:400, display:"flex", alignItems:"center", gap:9 }}>
                  <span style={{ fontSize:14 }}>{p.icon}</span>
                  <div>
                    <div>{p.label}</div>
                    <div style={{ fontSize:10, opacity:.5, marginTop:1 }}>{p.topics[0]}</div>
                  </div>
                  {pillar===k && <span style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:p.color, flexShrink:0 }}/>}
                </button>
              ))}

              <SLabel style={{ marginTop:18 }}>Tone</SLabel>
              {TONES.map(t => (
                <button key={t.id} onClick={() => setTone(t.id)} style={{ width:"100%", textAlign:"left", background:tone===t.id?"#0D1320":"transparent", border:`1px solid ${tone===t.id?"#3B82F630":"#0F1623"}`, color:tone===t.id?"#93C5FD":"#2D3748", padding:"7px 11px", borderRadius:7, fontSize:12, marginBottom:5 }}>
                  {t.label}
                </button>
              ))}

              <SLabel style={{ marginTop:18 }}>Custom Instructions</SLabel>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. mention LabQR, add a stat, ask a question…" style={{ width:"100%", background:"#0C1118", border:"1px solid #0F1623", borderRadius:8, color:"#6B7280", padding:"9px 11px", fontSize:12, height:64, lineHeight:1.5, resize:"none" }}/>

              <button onClick={generate} disabled={loading} style={{ width:"100%", background:loading?"#0C1118":"linear-gradient(135deg,#3B82F6,#1D4ED8)", color:"#fff", padding:"12px", borderRadius:9, fontSize:13, fontWeight:600, border:"none", marginTop:14, opacity:loading?.6:1, transition:"all .2s" }}>
                {loading
                  ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><Spin/>Generating with Claude AI…</span>
                  : "✦ Generate 3 Tweets"}
              </button>
            </div>

            {/* Tweet Cards */}
            <div>
              {genErr && <div style={{ background:"#0D1320", border:"1px solid #3B82F625", borderRadius:8, padding:"9px 13px", fontSize:12, color:"#6B7280", marginBottom:14 }}>ℹ️ {genErr}</div>}

              {loading && [0,1,2].map(i => (
                <div key={i} style={{ background:"#0C1118", border:"1px solid #0F1623", borderRadius:14, padding:"20px", marginBottom:14 }}>
                  {[100,90,75,55].map((w,j) => (
                    <div key={j} style={{ height:10, borderRadius:5, background:"linear-gradient(90deg,#161D2B 25%,#1E2A3A 50%,#161D2B 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite", marginBottom:8, width:w+"%" }}/>
                  ))}
                </div>
              ))}

              {!loading && tweets.length === 0 && (
                <div style={{ textAlign:"center", padding:"90px 20px", color:"#1E293B" }}>
                  <div style={{ fontSize:52, marginBottom:14, opacity:.2 }}>✦</div>
                  <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>Ready to create</div>
                  <div style={{ fontSize:12 }}>Select a pillar and tone, then generate</div>
                </div>
              )}

              {!loading && tweets.map((t, i) => (
                <div key={i} className="fade" style={{ animationDelay:i*.1+"s" }}>
                  <TweetCard text={t} tkey={i} showBadge />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SCHEDULE ═══ */}
        {tab === "schedule" && (
          <div style={{ maxWidth:660 }}>
            <PageHead title="Daily Schedule" sub="1 tweet per day, queued at your chosen time" />

            <SPanel label="Posting Time (IST)">
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[7,8,9,10,11,12,13,14].map(h => (
                  <button key={h} onClick={() => setHour(h)} style={{ background:hour===h?"#3B82F618":"#0C1118", border:`1px solid ${hour===h?"#3B82F630":"#0F1623"}`, color:hour===h?"#93C5FD":"#2D3748", padding:"7px 12px", borderRadius:7, fontSize:12, fontWeight:hour===h?600:400 }}>
                    {h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`}
                  </button>
                ))}
              </div>
            </SPanel>

            <SPanel label="Active Content Pillars">
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {Object.entries(BRAND.pillars).map(([k,p]) => {
                  const on = activePillars.includes(k);
                  return (
                    <button key={k} onClick={() => setActivePillars(prev => on ? prev.filter(x=>x!==k) : [...prev,k])} style={{ background:on?p.glow:"#0C1118", border:`1px solid ${on?p.color+"30":"#0F1623"}`, color:on?p.color:"#2D3748", padding:"7px 13px", borderRadius:8, fontSize:12, fontWeight:on?600:400 }}>
                      {p.icon} {p.label}
                    </button>
                  );
                })}
              </div>
            </SPanel>

            <SLabel>Scheduled Queue ({pendingQ.length})</SLabel>

            {pendingQ.length === 0 ? (
              <EmptyState icon="◷" msg="No tweets scheduled yet" sub="Generate tweets and hit Schedule to queue them" />
            ) : (
              pendingQ.sort((a,b) => a.ts-b.ts).map(item => {
                const p = BRAND.pillars[item.pillar];
                return (
                  <div key={item.id} style={{ background:"#0C1118", border:"1px solid #0F1623", borderRadius:12, padding:"16px 18px", marginBottom:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:9 }}>
                      <span style={{ background:p?.glow, color:p?.color, border:`1px solid ${p?.color}30`, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:600 }}>{p?.icon} {p?.label}</span>
                      <span style={{ fontSize:11, color:"#1E293B", marginLeft:"auto" }}>📅 {item.scheduledFor}</span>
                    </div>
                    <div style={{ fontSize:13, lineHeight:1.65, color:"#64748B", whiteSpace:"pre-wrap", marginBottom:12 }}>{item.text}</div>
                    <div style={{ display:"flex", gap:7, justifyContent:"flex-end" }}>
                      <TextBtn onClick={() => copy(item.text,`q${item.id}`)} style={copied===`q${item.id}`?{color:"#6EE7B7"}:{}}>
                        {copied===`q${item.id}`?"✓ Copied":"Copy"}
                      </TextBtn>
                      <TextBtn onClick={() => postTweet(item.text, `q${item.id}`)} style={{ background:"linear-gradient(135deg,#1D9BF0,#1572B6)", color:"#fff", fontWeight:600 }}>
                        Post Now on 𝕏
                      </TextBtn>
                      <TextBtn onClick={() => setQueue(prev => prev.filter(t=>t.id!==item.id))} style={{ background:"#130A0A", border:"1px solid #F8717120", color:"#F87171" }}>
                        Cancel
                      </TextBtn>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══ LIBRARY ═══ */}
        {tab === "library" && (
          <div style={{ maxWidth:700 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:22 }}>
              <PageHead title="Tweet History" sub={`${library.length} tweet${library.length!==1?"s":""} saved`} />
              {library.length > 0 && (
                <TextBtn onClick={() => setLibrary([])} style={{ background:"#130A0A", border:"1px solid #F8717120", color:"#F87171", fontSize:11 }}>Clear All</TextBtn>
              )}
            </div>

            {library.length === 0 ? (
              <EmptyState icon="▤" msg="Nothing here yet" sub="Generate and save tweets to build your library" />
            ) : (
              library.map(item => {
                const p = BRAND.pillars[item.pillar];
                return (
                  <div key={item.id} style={{ background:"#0C1118", border:`1px solid ${item.status==="posted"?"#10B98120":"#0F1623"}`, borderRadius:12, padding:"15px 17px", marginBottom:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:9 }}>
                      <span style={{ background:p?.glow, color:p?.color, border:`1px solid ${p?.color}30`, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:600 }}>{p?.icon} {p?.label}</span>
                      {item.status === "posted" && <span style={{ fontSize:10, color:"#6EE7B7" }}>✓ Posted</span>}
                      <span style={{ fontSize:10, color:"#1E293B", marginLeft:"auto" }}>{item.at}</span>
                    </div>
                    <div style={{ fontSize:13, lineHeight:1.65, color:"#64748B", whiteSpace:"pre-wrap", marginBottom:11 }}>{item.text}</div>
                    <div style={{ display:"flex", gap:7, justifyContent:"flex-end" }}>
                      <TextBtn onClick={() => copy(item.text,`l${item.id}`)} style={copied===`l${item.id}`?{color:"#6EE7B7"}:{}}>
                        {copied===`l${item.id}`?"✓ Copied":"Copy"}
                      </TextBtn>
                      {item.status !== "posted" && (
                        <TextBtn onClick={() => postTweet(item.text,`l${item.id}`)} style={{ background:"linear-gradient(135deg,#1D9BF0,#1572B6)", color:"#fff", fontWeight:600 }}>
                          Post on 𝕏
                        </TextBtn>
                      )}
                      <TextBtn onClick={() => setLibrary(prev => prev.filter(t=>t.id!==item.id))} style={{ background:"#130A0A", border:"1px solid #F8717115", color:"#F8717166", fontSize:11 }}>✕</TextBtn>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══ SETTINGS ═══ */}
        {tab === "settings" && (
          <div style={{ maxWidth:520 }}>
            <PageHead title="Settings" />

            <SPanel label="Twitter / X Account" sub="OAuth 2.0 PKCE — your credentials never leave your browser">
              {connected ? (
                <div style={{ background:"#0A160F", border:"1px solid #10B98125", borderRadius:9, padding:"13px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:13, color:"#6EE7B7", fontWeight:600 }}>✓ Connected</div>
                    <div style={{ fontSize:11, color:"#1E293B", marginTop:2 }}>Access token stored in browser storage</div>
                  </div>
                  <TextBtn onClick={() => { setCreds(null); flash("Disconnected","err"); }} style={{ background:"#130A0A", border:"1px solid #F8717120", color:"#F87171" }}>
                    Disconnect
                  </TextBtn>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:11, color:"#2D3748", marginBottom:9 }}>Enter your Twitter App Client ID from developer.twitter.com</div>
                  <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="e.g. abc123XYZclientId..." style={{ width:"100%", background:"#07090F", border:"1px solid #0F1623", borderRadius:8, color:"#E2E8F4", padding:"10px 12px", fontSize:12, marginBottom:9 }}/>
                  {oauthErr && <div style={{ fontSize:11, color:"#F87171", marginBottom:8 }}>⚠ {oauthErr}</div>}
                  <button onClick={connectTwitter} disabled={!clientId.trim()} style={{ width:"100%", background:"linear-gradient(135deg,#1D9BF0,#1572B6)", color:"#fff", padding:"11px", borderRadius:8, fontSize:13, fontWeight:600, border:"none" }}>
                    Connect with Twitter OAuth 2.0 →
                  </button>
                </div>
              )}
            </SPanel>

            <SPanel label="📋 Twitter App Setup Guide" sub="One-time setup on developer.twitter.com">
              {[
                ["1", "Go to developer.twitter.com and create a free account"],
                ["2", "Click 'Create Project' → then 'Create App' inside it"],
                ["3", "Go to 'User Authentication Settings' → enable OAuth 2.0"],
                ["4", `Set Callback URI / Redirect URL to your Vercel URL (e.g. https://your-app.vercel.app)`],
                ["5", "Required scopes: tweet.read   tweet.write   users.read"],
                ["6", "Copy your Client ID → paste it above → click Connect"],
              ].map(([n, text]) => (
                <div key={n} style={{ display:"flex", gap:10, marginBottom:9, fontSize:12, lineHeight:1.5 }}>
                  <span style={{ background:"#111827", color:"#374151", borderRadius:"50%", width:20, height:20, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700 }}>{n}</span>
                  <span style={{ color:"#374151" }}>{text}</span>
                </div>
              ))}
            </SPanel>
          </div>
        )}
      </div>

      {/* ── Connect Modal ── */}
      {showConnect && !connected && (
        <div style={{ position:"fixed", inset:0, background:"#07090FDD", backdropFilter:"blur(8px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#0C1118", border:"1px solid #161D2B", borderRadius:16, padding:"28px", width:"100%", maxWidth:440, animation:"fadeUp .25s ease" }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, color:"#F1F5FF", marginBottom:5 }}>Connect Twitter Account</div>
            <div style={{ fontSize:12, color:"#374151", marginBottom:20 }}>You need a Twitter Developer account. The free Basic tier is enough.</div>
            <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Twitter App Client ID" style={{ width:"100%", background:"#07090F", border:"1px solid #0F1623", borderRadius:8, color:"#E2E8F4", padding:"11px 13px", fontSize:13, marginBottom:10 }}/>
            {oauthErr && <div style={{ fontSize:11, color:"#F87171", marginBottom:8 }}>⚠ {oauthErr}</div>}
            <button onClick={connectTwitter} disabled={!clientId.trim()} style={{ width:"100%", background:"linear-gradient(135deg,#1D9BF0,#1572B6)", color:"#fff", padding:"12px", borderRadius:9, fontSize:13, fontWeight:600, border:"none", marginBottom:8 }}>
              Authorize with Twitter →
            </button>
            <button onClick={() => setShowConnect(false)} style={{ width:"100%", background:"#111827", color:"#374151", padding:"10px", borderRadius:9, fontSize:12, border:"none" }}>
              Not now — I'll copy tweets manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── MINI COMPONENTS ──────────────────────────────────────────── */
function Spin() {
  return <span style={{ display:"inline-block", width:12, height:12, border:"2px solid #ffffff30", borderTopColor:"#fff", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>;
}
function SLabel({ children, style={} }) {
  return <div style={{ fontSize:10, color:"#1E293B", letterSpacing:"1.2px", textTransform:"uppercase", marginBottom:9, ...style }}>{children}</div>;
}
function TextBtn({ children, onClick, disabled, style={} }) {
  return <button onClick={onClick} disabled={disabled} style={{ background:"#111827", border:"none", color:"#4B5563", padding:"6px 10px", borderRadius:7, fontSize:12, display:"inline-flex", alignItems:"center", gap:5, transition:"all .15s", ...style }}>{children}</button>;
}
function IconBtn({ children, onClick }) {
  return <button onClick={onClick} style={{ background:"#111827", border:"none", color:"#4B5563", padding:"6px 10px", borderRadius:7, fontSize:13, transition:"all .15s" }}>{children}</button>;
}
function BtnSmall({ children, onClick, accent }) {
  return <button onClick={onClick} style={{ background:accent?"#3B82F618":"#111827", border:accent?"1px solid #3B82F630":"none", color:accent?"#93C5FD":"#6B7280", padding:"5px 10px", borderRadius:6, fontSize:11, fontWeight:accent?600:400 }}>{children}</button>;
}
function PageHead({ title, sub }) {
  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:"#F1F5FF", marginBottom:4 }}>{title}</div>
      {sub && <div style={{ fontSize:13, color:"#374151" }}>{sub}</div>}
    </div>
  );
}
function SPanel({ label, sub, children }) {
  return (
    <div style={{ background:"#0C1118", border:"1px solid #0F1623", borderRadius:12, padding:"20px", marginBottom:14 }}>
      <div style={{ fontSize:10, color:"#1E293B", letterSpacing:"1.2px", textTransform:"uppercase", marginBottom:sub?5:12 }}>{label}</div>
      {sub && <div style={{ fontSize:12, color:"#374151", marginBottom:12 }}>{sub}</div>}
      {children}
    </div>
  );
}
function EmptyState({ icon, msg, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"44px 20px", color:"#1E293B", background:"#0C1118", border:"1px solid #0F1623", borderRadius:12 }}>
      <div style={{ fontSize:30, marginBottom:10, opacity:.3 }}>{icon}</div>
      <div style={{ fontSize:13, marginBottom:4 }}>{msg}</div>
      {sub && <div style={{ fontSize:11 }}>{sub}</div>}
    </div>
  );
}
