import { useEffect, useState } from "react";
import "./App.css";
import api from "./api/api";

const navItems = ["Feed", "How it works", "My reports"];

const toInitials = (name) => {
  const sanitized = (name || "Anonymous citizen").trim();
  if (!sanitized) return "AC";
  const parts = sanitized.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]).join("").toUpperCase() || "AC";
};

const formatDisplayDate = (value) => {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-BD", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
};

const normalizePost = (post) => ({
  id: post.public_id || post.id,
  name: post.author_name || "Anonymous citizen",
  initials: toInitials(post.author_name || "Anonymous citizen"),
  time: formatDisplayDate(post.created_at),
  place: post.location || "Bangladesh",
  category: post.category || "Community voice",
  body: post.body || "",
  reactions: Number(post.reaction_count || 0),
  comments: Number(post.comment_count || 0),
  tone: ["blue", "green", "purple", "orange"][Math.abs((post.id || post.public_id || "").split("").reduce((total, char) => total + char.charCodeAt(0), 0)) % 4],
});

const normalizeReport = (report) => ({
  id: report.public_id ? `RPT-${String(report.public_id).slice(0, 5).toUpperCase()}` : `RPT-${report.id}`,
  public_id: report.public_id,
  title: report.title || "Untitled report",
  description: report.description || "",
  category: report.category || "General",
  location: report.incident_location || report.location || "Location not provided",
  date: formatDisplayDate(report.created_at || report.incident_at),
  priority: report.priority ? report.priority.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Normal",
  status: report.status ? report.status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Submitted",
  reporter: report.is_anonymous ? "Anonymous" : (report.reporter_name || "Anonymous"),
  evidence: report.evidence || [],
});

function EvidencePreview({ evidence }) {
  const source = evidence.storage_path || evidence.external_url;
  const label = evidence.original_name || `${evidence.kind.replace("_", " ")} evidence`;
  const youtubeId = source?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/)?.[1];
  if (evidence.kind === "image" && source) return <a className="evidence-preview image-preview" href={source} target="_blank" rel="noreferrer"><img src={source} alt={label}/><span>⌕ View full image</span></a>;
  if ((evidence.kind === "video" || youtubeId) && source) return <div className="evidence-preview video-preview">{youtubeId ? <iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId}`} title={label} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen/> : <video controls><source src={source}/></video>}<a href={source} target="_blank" rel="noreferrer">↗ Open original video</a></div>;
  return <a className="evidence-file" href={source || "#"} target="_blank" rel="noreferrer"><span>{evidence.kind === "document" ? "▤" : "↗"}</span><div><b>{label}</b><small>{evidence.mime_type || evidence.kind.replace("_", " ")}</small></div><em>Open</em></a>;
}

function App() {
  const [page, setPage] = useState("feed");
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [showComposer, setShowComposer] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [posts, setPosts] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [adminReports, setAdminReports] = useState([]);
  const [toast, setToast] = useState("");

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const changePage = (target) => {
    setPage(target);
    setSelectedReport(null);
  };

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const response = await api.get("/posts");
        const nextPosts = Array.isArray(response.data?.data) ? response.data.data.map(normalizePost) : [];
        setPosts(nextPosts);
      } catch (error) {
        console.error("Failed to load posts", error);
        setPosts([]);
      }
    };

    loadPosts();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("antiCorruptionToken");
    if (!token) {
      setMyReports([]);
      return;
    }

    const loadMyReports = async () => {
      try {
        const response = await api.get("/reports/mine", { headers: { Authorization: `Bearer ${token}` } });
        const nextReports = Array.isArray(response.data?.data) ? response.data.data.map(normalizeReport) : [];
        setMyReports(nextReports);
      } catch (error) {
        console.error("Failed to load my reports", error);
        setMyReports([]);
      }
    };

    loadMyReports();
  }, [page]);

  useEffect(() => {
    const token = localStorage.getItem("antiCorruptionToken");
    if (!token || page !== "admin") {
      setAdminReports([]);
      return;
    }

    const loadAdminReports = async () => {
      try {
        const response = await api.get("/reports/admin", { headers: { Authorization: `Bearer ${token}` } });
        const nextReports = Array.isArray(response.data?.data) ? response.data.data.map(normalizeReport) : [];
        setAdminReports(nextReports);
        if (!selectedReport && nextReports[0]) setSelectedReport(nextReports[0]);
      } catch (error) {
        console.error("Failed to load staff queue", error);
        setAdminReports([]);
      }
    };

    loadAdminReports();
  }, [page, selectedReport]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => changePage("feed")} aria-label="Go to home">
          <span className="brand-mark">◈</span>
          <span>Anti Corruption <span>Prevent</span></span>
        </button>
        <nav className="main-nav" aria-label="Primary navigation">
          {navItems.map((item) => <button key={item} className={page === item.toLowerCase().replace(" ", "-") ? "active" : ""} onClick={() => changePage(item.toLowerCase().replace(" ", "-"))}>{item}</button>)}
          <button className={page === "admin" ? "active" : ""} onClick={() => changePage("admin")}>Admin</button>
        </nav>
        <div className="top-actions">
          <button className="text-button" onClick={() => { setAuthMode("login"); setShowAuth(true); }}>Sign in</button>
          <button className="primary-button small" onClick={() => { setAuthMode("register"); setShowAuth(true); }}>Create account</button>
        </div>
      </header>

      {page === "feed" && <Feed posts={posts} setPosts={setPosts} onReport={() => setShowComposer(true)} onPost={() => setShowPostComposer(true)} onAuth={() => { setAuthMode("login"); setShowAuth(true); }} notify={notify} />}
      {page === "my-reports" && <MyReports reports={myReports} onReport={() => setShowComposer(true)} />}
      {page === "how-it-works" && <HowItWorks />}
      {page === "admin" && <AdminDashboard reports={adminReports} selected={selectedReport} onSelect={setSelectedReport} notify={notify} />}

      <footer className="footer"><span>© 2026 Anti Corruption Prevent</span><span>Private reporting • Community accountability • Safer public services</span></footer>
      {showAuth && <AuthModal mode={authMode} setMode={setAuthMode} close={() => setShowAuth(false)} notify={notify} />}
      {showPostComposer && <CommunityPostComposer close={() => setShowPostComposer(false)} notify={notify} onSuccess={(newPost) => setPosts((current) => [newPost, ...current])} />}
      {showComposer && <ReportSubmissionModal close={() => setShowComposer(false)} notify={notify} />}
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}

function Feed({ posts, onReport, onPost, onAuth, notify }) {
  return <main className="page-content feed-layout">
    <aside className="side-card help-card"><div className="icon-circle">?</div><h3>Need to report an incident?</h3><p>Your report stays private unless you choose to make it public.</p><button className="primary-button full" onClick={onReport}>Report safely</button><button className="link-button">Learn how reporting works →</button></aside>
    <section className="feed-column">
      <section className="hero"><div><p className="eyebrow">A safer way to speak up</p><h1>Better public services start with accountable voices.</h1><p>Share experiences, support your community, and report concerns securely.</p><button className="primary-button" onClick={onReport}>Submit a report <span>→</span></button></div><div className="hero-shape"><span>✦</span><i></i><b></b></div></section>
      <section className="feed-heading"><div><h2>Community feed</h2><p>Public updates from citizens and verified organizations</p></div><button className="filter-button">⌄ Latest</button></section>
      <section className="post-composer"><div className="avatar avatar-blue">Y</div><button onClick={() => {
        const token = localStorage.getItem("antiCorruptionToken");
        if (token) onPost(); else onAuth();
      }}>Share an update with your community...</button></section>
      {posts.map((post) => <Post key={post.id} post={post} notify={notify} />)}
    </section>
    <aside className="right-rail"><section className="side-card"><p className="eyebrow">Your impact</p><h3>Every report matters.</h3><div className="stat"><strong>1,248</strong><span>reports submitted safely</span></div><div className="stat"><strong>312</strong><span>cases being reviewed</span></div><div className="stat"><strong>89%</strong><span>of citizens feel safer speaking up</span></div></section><section className="side-card topics"><h3>Explore topics</h3>{["Public service", "Procurement", "Bribery", "Safety & rights"].map(t => <button key={t}># {t}</button>)}</section></aside>
  </main>;
}

function Post({ post, notify }) {
  const [liked, setLiked] = useState(false);
  const [commenting, setCommenting] = useState(false);
  return <article className="post-card"><header><div className={`avatar avatar-${post.tone}`}>{post.initials}</div><div><strong>{post.name}</strong><p>{post.time} · {post.place}</p></div><button className="more">•••</button></header><span className="topic-tag">{post.category}</span><p className="post-body">{post.body}</p><div className="post-footer"><span>{liked ? post.reactions + 1 : post.reactions} supporters</span><span>{post.comments} comments</span></div><div className="post-actions"><button className={liked ? "liked" : ""} onClick={() => setLiked(!liked)}>♡ {liked ? "Supported" : "Support"}</button><button onClick={() => setCommenting(!commenting)}>◌ Comment</button><button onClick={() => notify("Share link copied to clipboard")}>↗ Share</button></div>{commenting && <div className="comment-box"><input placeholder="Write a respectful comment…"/><button onClick={() => { setCommenting(false); notify("Your comment was added"); }}>Send</button></div>}</article>;
}

function MyReports({ reports = [], onReport }) { return <main className="page-content single-page"><div className="page-intro"><p className="eyebrow">Personal workspace</p><h1>My reports</h1><p>Follow each case without exposing your identity to the public.</p><button className="primary-button" onClick={onReport}>+ New report</button></div><section className="report-list">{reports.length ? reports.map(r => <article key={r.public_id || r.id} className="report-row"><div><span className="report-id">{r.id}</span><h3>{r.title}</h3><p>{r.category} · {r.location} · {r.date}</p></div><Status status={r.status}/><button className="outline-button">View details</button></article>) : <p className="no-evidence">No reports yet. Submit your first incident to see it here.</p>}</section></main>; }

function HowItWorks() { return <main className="page-content single-page"><div className="page-intro center"><p className="eyebrow">Simple and protected</p><h1>How Anti Corruption Prevent works</h1><p>We make it easier to raise concerns while keeping reporters in control.</p></div><section className="steps"><Step n="01" title="Share safely" text="Submit a report with supporting evidence. You may stay anonymous."/><Step n="02" title="Review with care" text="Authorized administrators review each report and record every decision."/><Step n="03" title="Track the outcome" text="Receive status updates as your report is reviewed, forwarded, or closed."/></section></main>; }
function Step({ n, title, text }) { return <article className="step"><span>{n}</span><h2>{title}</h2><p>{text}</p></article>; }

function AdminDashboard({ reports = [], selected, onSelect, notify }) { return <main className="admin-page"><aside className="admin-sidebar"><div className="admin-title">Administration</div>{["Overview", "Review queue", "Forwarded cases", "Team members", "Audit log"].map((x,i)=><button className={i===1?"selected":""} key={x}>{x}</button>)}<div className="admin-user"><div className="avatar avatar-blue">SA</div><div><strong>System Admin</strong><small>Administrator</small></div></div></aside><section className="admin-content"><header className="admin-header"><div><p className="eyebrow">Case management</p><h1>Review queue</h1><p>Review incoming reports and record every decision.</p></div><button className="outline-button">⇩ Export</button></header><section className="metrics"><Metric value={String(reports.length).padStart(2, "0")} label="Awaiting review"/><Metric value="08" label="High priority" alert/><Metric value="16" label="Forwarded this week"/><Metric value="4.2h" label="Average first response"/></section><section className="admin-grid"><div className="queue"><div className="queue-toolbar"><h2>Incoming reports</h2><button className="filter-button">All status ⌄</button></div>{reports.length ? reports.map(r=><button className={`case-row ${selected?.id===r.id?"case-active":""}`} key={r.public_id || r.id} onClick={()=>onSelect(r)}><div><span className="report-id">{r.id}</span><h3>{r.title}</h3><p>{r.category} · {r.location}</p></div><div><Priority value={r.priority}/><small>{r.date}</small></div></button>) : <p className="no-evidence">No reports queued for review.</p>}</div><CaseDetail report={selected || reports[0]} notify={notify}/></section></section></main>; }
function Metric({value,label,alert}) { return <article className="metric"><strong className={alert?"alert-text":""}>{value}</strong><span>{label}</span></article>; }
function Priority({value}) { return <span className={`priority ${String(value || "Normal").toLowerCase()}`}>{value || "Normal"}</span>; }
function Status({status}) { const text = String(status || "Submitted"); const className = text.toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-"); return <span className={`status ${className}`}>{text}</span>; }
function CaseDetail({report,notify}) { const [action,setAction]=useState(""); const evidence = report.evidence || []; return <aside className="case-detail"><div className="detail-top"><div><span className="report-id">{report.id}</span><Status status={report.status}/></div><button className="more">•••</button></div><h2>{report.title}</h2><div className="case-meta"><span>⌖ {report.location}</span><span>◷ {report.date}</span><span>◉ {report.reporter}</span></div><div className="detail-section"><h3>Report summary</h3><p>{report.description || "The reporter describes an incident requiring careful review. Supporting details and files should be assessed before a final decision."}</p></div><div className="detail-section"><h3>Evidence <small>({evidence.length} {evidence.length === 1 ? "file" : "files"})</small></h3>{evidence.length ? <div className="evidence-list">{evidence.map(item => <EvidencePreview key={item.id} evidence={item}/>)}</div> : <p className="no-evidence">No evidence was attached to this report.</p>}</div><div className="detail-section"><h3>Activity</h3><div className="timeline"><p><b>Report submitted</b><span>{report.date}</span></p><p><b>Awaiting administrator review</b><span>Current status</span></p></div></div><div className="admin-actions"><button className="outline-button" onClick={()=>setAction("rejected")}>Cancel</button><button className="outline-button" onClick={()=>setAction("forwarded")}>Forward</button><button className="primary-button" onClick={()=>{setAction("accepted");notify("Report accepted and the audit log was updated")}}>Accept</button></div>{action && <p className="action-note">Draft action: <b>{action}</b> — add a case note before confirming in the API.</p>}</aside>; }

function CommunityPostComposer({ close, notify, onSuccess }) {
  const [form, setForm] = useState({ category: "Public service", body: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.category.trim()) nextErrors.category = "Choose a topic.";
    if (form.body.trim().length < 10) nextErrors.body = "Write at least 10 characters so your community can understand the issue.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const token = localStorage.getItem("antiCorruptionToken");
    if (!token) {
      setErrors({ form: "Please sign in before posting to the community feed." });
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post("/posts", { category: form.category, body: form.body.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      const post = response.data?.data || response.data;
      const createdPost = {
        id: post.id || Date.now(),
        name: post.author?.fullName || "You",
        initials: (post.author?.fullName || "You").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "YO",
        time: "Just now",
        place: post.location || "Bangladesh",
        category: post.category || form.category,
        body: post.body || form.body.trim(),
        reactions: 0,
        comments: 0,
        tone: "blue",
      };
      onSuccess(createdPost);
      close();
      notify("Your community post was published.");
    } catch (error) {
      setErrors({ form: error.response?.data?.message || error.response?.data?.error || "Post failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="modal-backdrop"><form className="modal report-modal" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-label="Create community post"><button type="button" className="modal-close" onClick={close}>×</button><p className="eyebrow">Community update</p><h2>Share an update</h2><p>Post a message to help others understand the issue and encourage accountability.</p><label>Category<select name="category" value={form.category} onChange={update} aria-invalid={Boolean(errors.category)}><option value="">Select category</option><option>Public service</option><option>Community voice</option><option>Procurement</option><option>Bribery</option><option>Safety & rights</option></select>{errors.category && <small className="field-error">{errors.category}</small>}</label><label>Message<textarea name="body" value={form.body} onChange={update} rows={6} placeholder="Share what you noticed, what needs attention, or what would help your community." aria-invalid={Boolean(errors.body)}/>{errors.body && <small className="field-error">{errors.body}</small>}</label>{errors.form && <p className="form-error" role="alert">{errors.form}</p>}<div className="modal-actions"><button type="button" className="text-button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Posting…" : "Post update"}</button></div></form></div>;
}

function AuthModal({ mode,setMode,close,notify }) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const validateRegistration = () => {
    const nextErrors = {};
    if (form.fullName.trim().length < 3) nextErrors.fullName = "Enter your full name (at least 3 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email address.";
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) nextErrors.password = "Use 8+ characters with uppercase, lowercase, and a number.";
    if (form.phone && !/^[+\d][\d\s-]{7,19}$/.test(form.phone)) nextErrors.phone = "Enter a valid phone number.";
    return nextErrors;
  };

  const submitRegistration = async (event) => {
    event.preventDefault();
    const nextErrors = validateRegistration();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      setSubmitting(true);
      const response = await api.post("/auth/register", { fullName: form.fullName.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim() || undefined });
      localStorage.setItem("antiCorruptionToken", response.data.data.token);
      close();
      notify("Account created successfully. Please sign in.");
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data?.error || "Registration failed. Please try again.";
      setErrors({ form: message });
    } finally { setSubmitting(false); }
  };

  if (mode === "register") return <div className="modal-backdrop" role="presentation"><form className="modal auth-modal" onSubmit={submitRegistration} noValidate role="dialog" aria-modal="true" aria-label="Create account"><button type="button" className="modal-close" onClick={close}>×</button><span className="brand-mark large">◈</span><h2>Create your account</h2><p>Join a community that values safe, accountable public services.</p><label>Full name<input name="fullName" value={form.fullName} onChange={update} placeholder="Rahul Islam" autoComplete="name" aria-invalid={Boolean(errors.fullName)}/>{errors.fullName && <small className="field-error">{errors.fullName}</small>}</label><label>Email address<input name="email" value={form.email} onChange={update} type="email" placeholder="rahul@example.com" autoComplete="email" aria-invalid={Boolean(errors.email)}/>{errors.email && <small className="field-error">{errors.email}</small>}</label><label>Phone number <span className="optional">Optional</span><input name="phone" value={form.phone} onChange={update} type="tel" placeholder="01700000000" autoComplete="tel" aria-invalid={Boolean(errors.phone)}/>{errors.phone && <small className="field-error">{errors.phone}</small>}</label><label>Password<input name="password" value={form.password} onChange={update} type="password" placeholder="Password123" autoComplete="new-password" aria-invalid={Boolean(errors.password)}/>{errors.password && <small className="field-error">{errors.password}</small>}</label>{errors.form && <p className="form-error" role="alert">{errors.form}</p>}<label className="checkbox"><input type="checkbox" required/> I agree to the community guidelines and privacy policy.</label><button className="primary-button full" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button><p className="switcher">Already have an account? <button type="button" onClick={()=>setMode("login")}>Sign in</button></p></form></div>;
  return <div className="modal-backdrop" role="presentation"><section className="modal auth-modal" role="dialog" aria-modal="true" aria-label="Account access"><button className="modal-close" onClick={close}>×</button><span className="brand-mark large">◈</span><h2>Welcome back</h2><p>Sign in to manage your reports and support your community.</p><label>Email address<input type="email" placeholder="you@example.com" /></label><label>Password<input type="password" placeholder="••••••••" /></label><button className="primary-button full" onClick={()=>{close();notify("Sign-in API will be connected next")}}>Sign in</button><p className="switcher">New here? <button onClick={()=>setMode("register")}>Create an account</button></p></section></div>;
}
function ReportModal({close,notify}) { return <div className="modal-backdrop"><section className="modal report-modal" role="dialog" aria-modal="true" aria-label="Submit report"><button className="modal-close" onClick={close}>×</button><p className="eyebrow">Secure submission</p><h2>Report an incident</h2><p>Only authorized reviewers can see private report details.</p><div className="form-grid"><label>Incident title<input placeholder="Brief, clear description"/></label><label>Category<select><option>Select category</option><option>Bribery</option><option>Public service</option><option>Procurement</option></select></label></div><label>What happened?<textarea placeholder="Include what happened, when, and who was involved."></textarea></label><div className="form-grid"><label>Location<input placeholder="District or service location"/></label><label>Incident date<input type="date"/></label></div><button className="upload-zone">↑ <span><b>Add evidence</b><small>Images, video, documents, or external video links</small></span></button><label className="checkbox"><input type="checkbox" defaultChecked/> Submit this report anonymously</label><div className="modal-actions"><button className="text-button" onClick={close}>Save for later</button><button className="primary-button" onClick={()=>{close();notify("Your report was submitted securely")}}>Submit report →</button></div></section></div>; }

void ReportModal;

function ReportSubmissionModal({ close, notify }) {
  const [form, setForm] = useState({ title: "", category: "", description: "", location: "", incidentAt: "", externalVideoUrl: "", isAnonymous: true });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const addFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    const accepted = /^(image\/(jpeg|png|webp)|video\/(mp4|webm)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/;
    const invalid = selected.find((file) => !accepted.test(file.type) || file.size > 25 * 1024 * 1024);
    if (invalid) { setErrors((current) => ({ ...current, files: "Use JPG, PNG, WEBP, MP4, WEBM, PDF, DOC or DOCX files up to 25 MB." })); return; }
    setFiles((current) => [...current, ...selected].slice(0, 10));
    setErrors((current) => ({ ...current, files: files.length + selected.length > 10 ? "Only the first 10 files were selected." : "" }));
    event.target.value = "";
  };
  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (form.title.trim().length < 5) nextErrors.title = "Add a clear incident title (at least 5 characters).";
    if (!form.category) nextErrors.category = "Choose the incident category.";
    if (form.description.trim().length < 20) nextErrors.description = "Please explain what happened in at least 20 characters.";
    if (form.externalVideoUrl && !/^https?:\/\/.+/i.test(form.externalVideoUrl)) nextErrors.externalVideoUrl = "Enter a full URL starting with http:// or https://.";
    const token = localStorage.getItem("antiCorruptionToken");
    if (!token) nextErrors.form = "Please sign in or create an account before submitting a report.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = new FormData();
    const descriptionText = form.description.trim();
    const titleText = form.title.trim();
    const locationText = form.location.trim();
    const externalVideoText = form.externalVideoUrl.trim();

    payload.append("title", titleText);
    payload.append("description", descriptionText);
    payload.append("body", descriptionText);
    payload.append("category", form.category);
    payload.append("location", locationText);
    payload.append("incidentAt", form.incidentAt ? new Date(form.incidentAt).toISOString() : "");
    payload.append("incident_time", form.incidentAt ? new Date(form.incidentAt).toISOString() : "");
    payload.append("isAnonymous", String(form.isAnonymous));
    payload.append("is_anonymous", String(form.isAnonymous));
    payload.append("externalVideoUrl", externalVideoText);
    payload.append("external_video_url", externalVideoText);

    files.forEach((file) => payload.append("evidence", file));

    try {
      setSubmitting(true);
      const response = await api.post("/submitComplain", payload, { headers: { Authorization: `Bearer ${token}` } });
      const complaint = response.data?.data || {};
      close();
      notify(`Complaint submitted securely. Reference: ${complaint.public_id || complaint.id || "Submitted"}`);
    } catch (error) {
      setErrors({ form: error.response?.data?.message || error.response?.data?.error || "Could not submit the complaint. Check your connection and try again." });
    } finally { setSubmitting(false); }
  };
  return <div className="modal-backdrop"><form className="modal report-modal" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-label="Submit report"><button type="button" className="modal-close" onClick={close}>×</button><p className="eyebrow">Secure submission</p><h2>Report an incident</h2><p>Private reports are visible only to authorized reviewers. You may submit anonymously.</p><div className="form-grid"><label>Incident title<input name="title" value={form.title} onChange={update} placeholder="Example: Unofficial payment requested" aria-invalid={Boolean(errors.title)}/>{errors.title && <small className="field-error">{errors.title}</small>}</label><label>Category<select name="category" value={form.category} onChange={update} aria-invalid={Boolean(errors.category)}><option value="">Select category</option><option>Bribery</option><option>Public service</option><option>Procurement</option><option>Abuse of power</option><option>Safety & rights</option><option>Other</option></select>{errors.category && <small className="field-error">{errors.category}</small>}</label></div><label>What happened?<textarea name="description" value={form.description} onChange={update} placeholder="Describe what happened, who was involved, and any relevant details." aria-invalid={Boolean(errors.description)}/>{errors.description && <small className="field-error">{errors.description}</small>}</label><div className="form-grid"><label>Location <span className="optional">Optional</span><input name="location" value={form.location} onChange={update} placeholder="District, office, or service location"/></label><label>Incident date and time <span className="optional">Optional</span><input name="incidentAt" value={form.incidentAt} onChange={update} type="datetime-local"/></label></div><fieldset className="evidence-section"><legend>Supporting evidence <span className="optional">Optional</span></legend><label className="upload-zone"><input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,.doc,.docx" onChange={addFiles}/><span className="upload-icon">↑</span><span><b>Upload photos, video, PDF, DOC or DOCX</b><small>Up to 10 files · 25 MB per file</small></span></label>{errors.files && <small className="field-error">{errors.files}</small>}{files.length > 0 && <ul className="selected-files">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.type.startsWith("image/") ? "Image" : file.type.startsWith("video/") ? "Video" : "Document"} · {file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></li>)}</ul>}<div className="url-divider"><span>or</span></div><label>Video URL <span className="optional">Optional</span><input name="externalVideoUrl" value={form.externalVideoUrl} onChange={update} type="url" placeholder="https://www.youtube.com/watch?v=..." aria-invalid={Boolean(errors.externalVideoUrl)}/>{errors.externalVideoUrl && <small className="field-error">{errors.externalVideoUrl}</small>}<small className="field-hint">Paste a YouTube or other publicly accessible video link.</small></label></fieldset><label className="checkbox anonymous-choice"><input name="isAnonymous" checked={form.isAnonymous} onChange={update} type="checkbox"/> Submit anonymously — your name will not be shown to reviewers.</label>{errors.form && <p className="form-error" role="alert">{errors.form}</p>}<div className="modal-actions"><button type="button" className="text-button" onClick={close}>Cancel</button><button className="primary-button" disabled={submitting}>{submitting ? "Submitting securely…" : "Submit report"}</button></div></form></div>;
}

export default App;
