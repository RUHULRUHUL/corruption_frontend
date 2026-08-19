import { useEffect, useState } from "react";
import "./App.css";
import api from "./api/api";

const navItems = ["Feed", "How it works", "My reports"];

const pageFromPath = (pathname) => {
  const route = pathname.replace(/^\/+|\/+$/g, "");
  if (route === "admin") return "admin";
  if (route === "how-it-works") return "how-it-works";
  if (route === "my-reports") return "my-reports";
  return "feed";
};

const pathFromPage = (page) => page === "feed" ? "/" : `/${page}`;

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
  description: report.description || report.body || "",
  category: report.category || "General",
  location: report.incident_location || report.location || "Location not provided",
  date: formatDisplayDate(report.created_at || report.incident_at),
  priority: report.priority ? report.priority.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Normal",
  status: report.status ? report.status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Submitted",
  reporter: report.is_anonymous ? "Anonymous" : (report.reporter_name || report.author_name || "Anonymous"),
  evidence: report.evidence || report.media || [],
});

const normalizeComplaint = (complaint) => {
  const bodyText = complaint.body || complaint.description || "";
  const descriptionMatch = bodyText.match(/Description:\s*(.*)/i)?.[1];
  const bodyMatch = bodyText.match(/Body:\s*(.*)/i)?.[1];
  const categoryMatch = bodyText.match(/Category:\s*(.*)/i)?.[1];
  const locationMatch = bodyText.match(/Location:\s*(.*)/i)?.[1];
  const timeMatch = bodyText.match(/Incident time:\s*(.*)/i)?.[1];
  const media = Array.isArray(complaint.media) ? complaint.media : [];

  return {
    id: complaint.public_id || complaint.id,
    title: complaint.title || "Complaint",
    description: descriptionMatch || bodyMatch || complaint.description || bodyText,
    category: categoryMatch || complaint.category || "General",
    location: locationMatch || complaint.location || "Bangladesh",
    incidentTime: timeMatch || complaint.incident_time || complaint.incidentAt,
    createdAt: complaint.created_at || complaint.updated_at,
    media,
  };
};

function EvidencePreview({ evidence }) {
  const source = evidence.storage_path || evidence.external_url;
  const label = evidence.original_name || `${evidence.kind.replace("_", " ")} evidence`;
  const youtubeId = source?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/)?.[1];
  if (evidence.kind === "image" && source) return <a className="evidence-preview image-preview" href={source} target="_blank" rel="noreferrer"><img src={source} alt={label}/><span>⌕ View full image</span></a>;
  if ((evidence.kind === "video" || youtubeId) && source) return <div className="evidence-preview video-preview">{youtubeId ? <iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId}`} title={label} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen/> : <video controls><source src={source}/></video>}<a href={source} target="_blank" rel="noreferrer">↗ Open original video</a></div>;
  return <a className="evidence-file" href={source || "#"} target="_blank" rel="noreferrer"><span>{evidence.kind === "document" ? "▤" : "↗"}</span><div><b>{label}</b><small>{evidence.mime_type || evidence.kind.replace("_", " ")}</small></div><em>Open</em></a>;
}

function App() {
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname));
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [showComposer, setShowComposer] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedMyReport, setSelectedMyReport] = useState(null);
  const [posts, setPosts] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [adminReports, setAdminReports] = useState([]);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("antiCorruptionAdminToken"));
  const [toast, setToast] = useState("");

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const changePage = (target) => {
    setPage(target);
    setSelectedReport(null);
    window.history.pushState({}, "", pathFromPage(target));
  };

  useEffect(() => {
    const handlePopState = () => {
      setPage(pageFromPath(window.location.pathname));
      setSelectedReport(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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

    const loadComplaints = async () => {
      try {
        const response = await api.get("/getAllComplaints");
        const nextComplaints = Array.isArray(response.data?.data) ? response.data.data.map(normalizeComplaint) : [];
        setComplaints(nextComplaints);
      } catch (error) {
        console.error("Failed to load complaints", error);
        setComplaints([]);
      }
    };

    loadPosts();
    loadComplaints();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("antiCorruptionToken");
    if (!token) {
      setMyReports([]);
      return;
    }

    const loadMyReports = async () => {
      try {
        const response = await api.get("/myComplaints", { headers: { Authorization: `Bearer ${token}` } });
        const payload = response.data?.data || response.data?.complaints || response.data || [];
        const nextReports = Array.isArray(payload) ? payload.map(normalizeComplaint) : (payload ? [normalizeComplaint(payload)] : []);
        setMyReports(nextReports);
        if (!selectedMyReport && nextReports[0]) setSelectedMyReport(nextReports[0]);
      } catch (error) {
        console.error("Failed to load my complaints", error);
        setMyReports([]);
        setSelectedMyReport(null);
      }
    };

    loadMyReports();
  }, [page, selectedMyReport]);

  useEffect(() => {
    if (!adminToken || page !== "admin") {
      return;
    }

    const loadAdminReports = async () => {
      try {
        const response = await api.get("/admin/complaints", { headers: { Authorization: `Bearer ${adminToken}` } });
        const nextReports = Array.isArray(response.data?.data) ? response.data.data.map(normalizeReport) : [];
        setAdminReports(nextReports);
        setSelectedReport((current) => current && nextReports.some((report) => report.id === current.id) ? nextReports.find((report) => report.id === current.id) : nextReports[0] || null);
      } catch (error) {
        console.error("Failed to load staff queue", error);
        setAdminReports([]);
        setSelectedReport(null);
      }
    };

    loadAdminReports();
  }, [page, adminToken]);

  const handleAdminLogout = () => {
    localStorage.removeItem("antiCorruptionAdminToken");
    setAdminToken(null);
    setSelectedReport(null);
    notify("Admin session ended.");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => changePage("feed")} aria-label="Go to home">
          <span className="brand-mark">◈</span>
          <span>Anti Corruption <span>Prevent</span></span>
        </button>
        {page !== "admin" && <nav className="main-nav" aria-label="Primary navigation">
          {navItems.map((item) => <button key={item} className={page === item.toLowerCase().replace(" ", "-") ? "active" : ""} onClick={() => changePage(item.toLowerCase().replace(" ", "-"))}>{item}</button>)}
        </nav>}
        <div className="top-actions">
          <button className="text-button" onClick={() => { setAuthMode("login"); setShowAuth(true); }}>Sign in</button>
          {page !== "admin" && <button className="primary-button small" onClick={() => { setAuthMode("register"); setShowAuth(true); }}>Create account</button>}
        </div>
      </header>

      {page === "feed" && <Feed posts={posts} complaints={complaints} setPosts={setPosts} onReport={() => setShowComposer(true)} onPost={() => setShowPostComposer(true)} onAuth={() => { setAuthMode("login"); setShowAuth(true); }} notify={notify} />}
      {page === "my-reports" && <MyReports reports={myReports} selected={selectedMyReport} onSelect={setSelectedMyReport} onReport={() => setShowComposer(true)} />}
      {page === "how-it-works" && <HowItWorks />}
      {page === "admin" && (adminToken ? <AdminDashboard reports={adminReports} selected={selectedReport} onSelect={setSelectedReport} notify={notify} onLogout={handleAdminLogout} onReviewed={(reportId, status) => { setAdminReports((current) => current.map((report) => report.id === reportId ? { ...report, status } : report)); setSelectedReport((current) => current?.id === reportId ? { ...current, status } : current); }} /> : <AdminLogin onSuccess={(token) => { localStorage.setItem("antiCorruptionAdminToken", token); setAdminToken(token); notify("Admin login successful."); }} />)}

      <footer className="footer"><span>© 2026 Anti Corruption Prevent</span><span>Private reporting • Community accountability • Safer public services</span></footer>
      {showAuth && <AuthModal mode={authMode} setMode={setAuthMode} close={() => setShowAuth(false)} notify={notify} />}
      {showPostComposer && <CommunityPostComposer close={() => setShowPostComposer(false)} notify={notify} onSuccess={(newPost) => setPosts((current) => [newPost, ...current])} />}
      {showComposer && <ReportSubmissionModal close={() => setShowComposer(false)} notify={notify} />}
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}

function Feed({ posts, complaints = [], onReport, onPost, onAuth, notify }) {
  const totalPosts = (posts?.length || 0) + (complaints?.length || 0);
  const resolvedCount = complaints.filter(c => c.status?.toLowerCase().includes("resolved") || c.status?.toLowerCase().includes("accepted")).length;
  const userCount = new Set([
    ...(posts?.map(p => p.id) || []),
    ...(complaints?.map(c => c.id) || [])
  ]).size;

  return <main className="page-content feed-layout">
    <aside className="side-card stats-card">
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-number">{totalPosts}</div>
          <div className="stat-label">Total Posts</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{resolvedCount}</div>
          <div className="stat-label">Resolved</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{userCount}</div>
          <div className="stat-label">Users</div>
        </div>
      </div>
      <button className="primary-button full" onClick={onReport}>+ Report</button>
    </aside>
    <section className="feed-column">
      <section className="feed-heading"><div><h2>Community feed</h2><p>Public updates from citizens and verified organizations</p></div><button className="filter-button">⌄ Latest</button></section>
      {complaints.length > 0 && (
        <div className="complaints-list">
          {complaints.map((complaint) => <ComplaintCard key={complaint.id} complaint={complaint} />)}
        </div>
      )}
      {posts.map((post) => <Post key={post.id} post={post} notify={notify} />)}
    </section>
    <aside className="right-rail"><section className="side-card"><p className="eyebrow">Your impact</p><h3>Every report matters.</h3><div className="stat"><strong>1,248</strong><span>reports submitted safely</span></div><div className="stat"><strong>312</strong><span>cases being reviewed</span></div><div className="stat"><strong>89%</strong><span>of citizens feel safer speaking up</span></div></section><section className="side-card topics"><h3>Explore topics</h3>{["Public service", "Procurement", "Bribery", "Safety & rights"].map(t => <button key={t}># {t}</button>)}</section></aside>
  </main>;
}

function ComplaintCard({ complaint }) {
  const [liked, setLiked] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const media = complaint.media || [];
  const baseMediaUrl = "http://localhost:3000/";
  const getSource = (item) => {
    const cleanStoragePath = item.storage_path ? String(item.storage_path).replace(/^\/+/, "") : "";
    return cleanStoragePath ? `${baseMediaUrl}${cleanStoragePath.startsWith("uploads/") ? cleanStoragePath : `uploads/${cleanStoragePath}`}` : item.external_url;
  };
  const imageItems = media.filter((item) => item.kind === "image" || String(item.mime_type || "").startsWith("image/")).map((item, index) => ({
    source: getSource(item),
    name: item.original_name,
    key: item.id || item.original_name || item.external_url || item.storage_path || index,
  }));

  const renderMedia = (item) => {
    const source = getSource(item);
    const mime = item.mime_type || "";
    const kind = item.kind || "document";
    const youtubeId = source?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/)?.[1];

    if (youtubeId) {
      return <div className="complaint-media complaint-video"><iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId}`} title={complaint.title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>;
    }

    if (kind === "image" || mime.startsWith("image/")) {
      const imageIndex = imageItems.findIndex((image) => image.source === source && image.name === item.original_name);
      return <button className="complaint-media complaint-image" type="button" onClick={() => setSelectedImage({ images: imageItems, index: imageIndex, title: complaint.title })} aria-label={`View ${item.original_name || complaint.title} in detail`}><img src={source} alt={item.original_name || complaint.title} /><span className="image-expand-hint">View image</span></button>;
    }

    if (kind === "video" || mime.startsWith("video/")) {
      return <div className="complaint-media complaint-video"><video controls src={source} /></div>;
    }

    if (source && (mime.includes("pdf") || String(source).toLowerCase().endsWith(".pdf"))) {
      return <div className="complaint-media complaint-file"><a href={source} target="_blank" rel="noreferrer">Open PDF: {item.original_name || "attachment.pdf"}</a></div>;
    }

    if (source) {
      return <div className="complaint-media complaint-file"><a href={source} target="_blank" rel="noreferrer">Open file: {item.original_name || item.kind || "attachment"}</a></div>;
    }

    return null;
  };

  const handleShare = async () => {
    const shareText = `${complaint.title}\n${complaint.description}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
    }
    alert("Post link copied to clipboard");
  };

  return <article className="complaint-card">
    <div className="complaint-header">
      <div>
        <span className="complaint-tag">{complaint.category}</span>
        <h3>{complaint.title}</h3>
      </div>
      <small>{complaint.location}</small>
    </div>
    <p className="complaint-description">{complaint.description}</p>
    {media.length > 0 && <div className="complaint-media-list">{media.map((item) => <div key={`${complaint.id}-${item.id || item.original_name || item.external_url || item.storage_path}`}>{renderMedia(item)}</div>)}</div>}
    {complaint.incidentTime && <p className="complaint-meta">Incident time: {formatDisplayDate(complaint.incidentTime)}</p>}
    <div className="complaint-actions">
      <button className={liked ? "liked" : ""} onClick={() => setLiked(!liked)}>♡ {liked ? "Supported" : "Support"}</button>
      <button onClick={() => setCommenting(!commenting)}>◌ Comment</button>
      <button onClick={handleShare}>↗ Share</button>
    </div>
    {commenting && <div className="comment-box complaint-comment-box"><input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Write a respectful comment…" /><button onClick={() => { setCommenting(false); setCommentText(""); }}>Send</button></div>}
    {selectedImage && <ImageDetailModal image={selectedImage} close={() => setSelectedImage(null)} />}
  </article>;
}

function ImageDetailModal({ image, close }) {
  const [currentIndex, setCurrentIndex] = useState(image.index || 0);
  const currentImage = image.images[currentIndex] || image.images[0];
  const hasMultipleImages = image.images.length > 1;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  return <div className="image-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="image-detail-modal" role="dialog" aria-modal="true" aria-label={`${image.title} image details`}>
      <div className="image-detail-header">
        <div><span className="eyebrow">Evidence image</span><h2>{currentImage.name || image.title}</h2></div>
        <button className="close-button" type="button" onClick={close} aria-label="Close image preview">✕</button>
      </div>
      <div className="image-detail-frame"><img src={currentImage.source} alt={currentImage.name || image.title} />{hasMultipleImages && <><button className="image-gallery-control previous" type="button" onClick={() => setCurrentIndex((currentIndex - 1 + image.images.length) % image.images.length)} aria-label="View previous image">‹</button><button className="image-gallery-control next" type="button" onClick={() => setCurrentIndex((currentIndex + 1) % image.images.length)} aria-label="View next image">›</button></>}</div>
      {hasMultipleImages && <p className="image-gallery-count">{currentIndex + 1} of {image.images.length}</p>}
    </section>
  </div>;
}

function Post({ post, notify }) {
  const [liked, setLiked] = useState(false);
  const [commenting, setCommenting] = useState(false);
  return <article className="post-card"><header><div className={`avatar avatar-${post.tone}`}>{post.initials}</div><div><strong>{post.name}</strong><p>{post.time} · {post.place}</p></div><button className="more">•••</button></header><span className="topic-tag">{post.category}</span><p className="post-body">{post.body}</p><div className="post-footer"><span>{liked ? post.reactions + 1 : post.reactions} supporters</span><span>{post.comments} comments</span></div><div className="post-actions"><button className={liked ? "liked" : ""} onClick={() => setLiked(!liked)}>♡ {liked ? "Supported" : "Support"}</button><button onClick={() => setCommenting(!commenting)}>◌ Comment</button><button onClick={() => notify("Share link copied to clipboard")}>↗ Share</button></div>{commenting && <div className="comment-box"><input placeholder="Write a respectful comment…"/><button onClick={() => { setCommenting(false); notify("Your comment was added"); }}>Send</button></div>}</article>;
}

function MyReports({ reports = [], selected, onSelect, onReport }) {
  const activeReport = selected || reports[0] || null;
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", description: "", category: "General", location: "" });
  const [uploading, setUploading] = useState(false);

  const handleUploadChange = (e) => {
    setUploadForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.title.trim() || !uploadForm.description.trim()) {
      alert("Please fill in all fields");
      return;
    }

    const token = localStorage.getItem("antiCorruptionToken");
    if (!token) {
      alert("Please sign in first");
      return;
    }

    try {
      setUploading(true);
      const response = await api.post("/submitComplain", {
        title: uploadForm.title,
        description: uploadForm.description,
        category: uploadForm.category,
        location: uploadForm.location,
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      alert("Report submitted successfully!");
      setShowUploadForm(false);
      setUploadForm({ title: "", description: "", category: "General", location: "" });
      onReport();
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to submit report");
    } finally {
      setUploading(false);
    }
  };

  return <main className="page-content single-page report-layout">
    <div className="page-intro">
      <p className="eyebrow">Personal workspace</p>
      <h1>My reports</h1>
      <p>Follow each case without exposing your identity to the public.</p>
      <button className="primary-button" onClick={() => setShowUploadForm(!showUploadForm)}>+ New report</button>
    </div>

    {showUploadForm && (
      <div className="upload-form-card">
        <div className="upload-form-header">
          <h3>Submit a new report</h3>
          <button className="close-button" onClick={() => setShowUploadForm(false)}>✕</button>
        </div>
        <form onSubmit={handleUploadSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input type="text" name="title" value={uploadForm.title} onChange={handleUploadChange} placeholder="Brief title of the incident" required />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select name="category" value={uploadForm.category} onChange={handleUploadChange}>
              <option value="General">General</option>
              <option value="Bribery">Bribery</option>
              <option value="Procurement">Procurement</option>
              <option value="Public service">Public service</option>
              <option value="Safety & rights">Safety & rights</option>
            </select>
          </div>
          <div className="form-group">
            <label>Location</label>
            <input type="text" name="location" value={uploadForm.location} onChange={handleUploadChange} placeholder="Where did this happen?" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea name="description" value={uploadForm.description} onChange={handleUploadChange} placeholder="Describe what happened in detail..." rows="6" required></textarea>
          </div>
          <div className="form-actions">
            <button type="button" className="outline-button" onClick={() => setShowUploadForm(false)}>Cancel</button>
            <button type="submit" className="primary-button" disabled={uploading}>{uploading ? "Submitting..." : "Submit Report"}</button>
          </div>
        </form>
      </div>
    )}

    <div className="my-report-panel">
      <section className="report-list">
        {reports.length ? reports.map((report) => (
          <button key={report.public_id || report.id} className={`report-row ${activeReport?.id === report.id ? "report-row-active" : ""}`} onClick={() => onSelect(report)}>
            <div className="report-row-copy">
              <span className="report-id">{report.id}</span>
              <h3>{report.title}</h3>
              <p>{report.category} · {report.location} · {report.createdAt ? formatDisplayDate(report.createdAt) : report.date}</p>
            </div>
            <Status status={report.status || "Submitted"} />
          </button>
        )) : <p className="no-evidence">No reports yet. Submit your first incident to see it here.</p>}
      </section>

      <aside className="report-detail-card">
        {activeReport ? (
          <>
            <div className="detail-top">
              <span className="report-id">{activeReport.id}</span>
              <Status status={activeReport.status || "Submitted"} />
            </div>
            <h2>{activeReport.title}</h2>
            <div className="case-meta">
              <span>⌖ {activeReport.location}</span>
              <span>◷ {activeReport.createdAt ? formatDisplayDate(activeReport.createdAt) : activeReport.date}</span>
            </div>
            <div className="detail-section">
              <h3>Category</h3>
              <p>{activeReport.category}</p>
            </div>
            <div className="detail-section">
              <h3>Details</h3>
              <p>{activeReport.description || "No description was added for this report."}</p>
            </div>
            {activeReport.media?.length > 0 && (
              <div className="detail-section">
                <h3>Attachments</h3>
                <div className="evidence-list">
                  {activeReport.media.map((item, index) => (
                    <a key={`${activeReport.id}-${item.id || item.original_name || index}`} className="evidence-file" href={item.external_url || `${"http://localhost:3000/"}${String(item.storage_path || "").replace(/^\/+/, "")}`} target="_blank" rel="noreferrer">
                      <span>{item.kind === "image" ? "▣" : "▤"}</span>
                      <div>
                        <b>{item.original_name || item.kind || "Attachment"}</b>
                        <small>{item.mime_type || item.kind || "file"}</small>
                      </div>
                      <em>Open</em>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="no-evidence">Select a report to view its details.</p>
        )}
      </aside>
    </div>
  </main>;
}

function HowItWorks() { return <main className="page-content single-page"><div className="page-intro center"><p className="eyebrow">Simple and protected</p><h1>How Anti Corruption Prevent works</h1><p>We make it easier to raise concerns while keeping reporters in control.</p></div><section className="steps"><Step n="01" title="Share safely" text="Submit a report with supporting evidence. You may stay anonymous."/><Step n="02" title="Review with care" text="Authorized administrators review each report and record every decision."/><Step n="03" title="Track the outcome" text="Receive status updates as your report is reviewed, forwarded, or closed."/></section></main>; }
function Step({ n, title, text }) { return <article className="step"><span>{n}</span><h2>{title}</h2><p>{text}</p></article>; }

function AdminLogin({ onSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      setSubmitting(true);
      const response = await api.post("/auth/admin/login", form);
      const token = response.data?.data?.token;
      if (!token) throw new Error("Admin login did not return a token.");
      onSuccess(token);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Admin login failed. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="admin-login-page"><form className="modal admin-login-card" onSubmit={submit}>
    <span className="eyebrow">Restricted access</span>
    <h1>Admin sign in</h1>
    <p>Sign in to review community complaints and record decisions.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="admin@example.com" autoComplete="username" required /></label>
    <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Your admin password" autoComplete="current-password" required /></label>
    <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in as admin"}</button>
  </form></main>;
}

function AdminDashboard({ reports = [], selected, onSelect, notify, onLogout, onReviewed }) {
  return <main className="admin-page"><aside className="admin-sidebar"><div className="admin-title">Administration</div>{["Overview", "Review queue", "Forwarded cases", "Team members", "Audit log"].map((x,i)=><button className={i===1?"selected":""} key={x}>{x}</button>)}<div className="admin-user"><div className="avatar avatar-blue">SA</div><div><strong>System Admin</strong><small>Administrator</small></div><button className="admin-logout" onClick={onLogout}>Log out</button></div></aside><section className="admin-content"><header className="admin-header"><div><p className="eyebrow">Case management</p><h1>Review queue</h1><p>Review incoming reports and record every decision.</p></div><button className="outline-button" onClick={onLogout}>Log out</button></header><section className="metrics"><Metric value={String(reports.filter((report) => ["Submitted", "Pending"].includes(report.status)).length).padStart(2, "0")} label="Awaiting review"/><Metric value={String(reports.filter((report) => report.priority === "High" || report.priority === "Critical").length).padStart(2, "0")} label="High priority" alert/><Metric value={String(reports.filter((report) => report.status === "Forwarded").length).padStart(2, "0")} label="Forwarded cases"/><Metric value={String(reports.length).padStart(2, "0")} label="Total complaints"/></section><section className="admin-grid"><div className="queue"><div className="queue-toolbar"><h2>Incoming complaints</h2><span className="queue-count">{reports.length} total</span></div>{reports.length ? reports.map(r=><button className={`case-row ${selected?.id===r.id?"case-active":""}`} key={r.public_id || r.id} onClick={()=>onSelect(r)}><div><span className="report-id">{r.id}</span><h3>{r.title}</h3><p>{r.category} · {r.location}</p></div><div><Priority value={r.priority}/><small>{r.date}</small></div></button>) : <p className="no-evidence">No complaints available.</p>}</div><CaseDetail report={selected || reports[0]} notify={notify} onReviewed={onReviewed}/></section></section></main>;
}
function Metric({value,label,alert}) { return <article className="metric"><strong className={alert?"alert-text":""}>{value}</strong><span>{label}</span></article>; }
function Priority({value}) { return <span className={`priority ${String(value || "Normal").toLowerCase()}`}>{value || "Normal"}</span>; }
function Status({status}) { const text = String(status || "Submitted"); const className = text.toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-"); return <span className={`status ${className}`}>{text}</span>; }
function CaseDetail({report, notify, onReviewed}) {
  const [note, setNote] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const evidence = report?.evidence || [];

  if (!report) return <aside className="case-detail"><p className="no-evidence">Select a complaint to view its details.</p></aside>;

  const review = async (action) => {
    if (action === "cancelled" && !note.trim()) {
      notify("A cancellation note is required.");
      return;
    }
    try {
      setSubmitting(true);
      const response = await api.patch(`/admin/complaints/${encodeURIComponent(report.public_id || report.id)}/review`, { action, note: note.trim() || undefined }, { headers: { Authorization: `Bearer ${localStorage.getItem("antiCorruptionAdminToken")}` } });
      const nextStatus = response.data?.data?.status === "published" ? "Approved" : response.data?.data?.status || (action === "approved" ? "Approved" : "Cancelled");
      onReviewed(report.id, String(nextStatus).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()));
      setNote("");
      setShowCancel(false);
      notify(`Complaint ${action === "approved" ? "approved" : "cancelled"}.`);
    } catch (error) {
      notify(error.response?.data?.message || "The review action could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  return <aside className="case-detail"><div className="detail-top"><div><span className="report-id">{report.id}</span><Status status={report.status}/></div><button className="more">•••</button></div><h2>{report.title}</h2><div className="case-meta"><span>⌖ {report.location}</span><span>◷ {report.date}</span><span>◉ {report.reporter}</span></div><div className="detail-section"><h3>Complaint details</h3><p>{report.description || "No description was provided."}</p></div><div className="detail-section"><h3>Evidence <small>({evidence.length} {evidence.length === 1 ? "file" : "files"})</small></h3>{evidence.length ? <div className="evidence-list">{evidence.map(item => <EvidencePreview key={item.id} evidence={item}/>)}</div> : <p className="no-evidence">No evidence was attached to this complaint.</p>}</div><div className="detail-section"><h3>Review decision</h3>{showCancel && <textarea className="review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain why this complaint is being cancelled..." rows="3" required />}{!showCancel && <p className="action-note">Approve the complaint for publication or cancel it with a required note.</p>}</div><div className="admin-actions"><button className="outline-button" type="button" onClick={() => setShowCancel(true)} disabled={submitting || showCancel}>Cancel complaint</button><button className="primary-button" type="button" onClick={() => review("approved")} disabled={submitting}>{submitting ? "Saving..." : "Approve complaint"}</button></div>{showCancel && <div className="review-confirm-actions"><button className="outline-button" type="button" onClick={() => { setShowCancel(false); setNote(""); }} disabled={submitting}>Keep complaint</button><button className="danger-button" type="button" onClick={() => review("cancelled")} disabled={submitting}>{submitting ? "Saving..." : "Confirm cancellation"}</button></div>}</aside>;
}

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
