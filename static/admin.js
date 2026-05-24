const API_BASE = "/api";
let postImages = [];
let postFiles = [];

function getToken() {
  return localStorage.getItem("jj_admin_token") || "";
}

function setToken(t) {
  if (t) localStorage.setItem("jj_admin_token", t);
  else localStorage.removeItem("jj_admin_token");
  updateAuthUI();
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function setAdminVisible(visible) {
  const adminActions = document.getElementById("admin-actions");
  if (!adminActions) return;
  if (visible) {
    adminActions.classList.add("visible");
    adminActions.setAttribute("aria-hidden", "false");
  } else {
    adminActions.classList.remove("visible");
    adminActions.setAttribute("aria-hidden", "true");
  }
}

async function checkToken() {
  try {
    const res = await fetch(`${API_BASE}/admin/token-status`, { headers: authHeaders() });
    const txt = document.getElementById("auth-msg");
    if (res.ok) {
      txt.textContent = "Token valid — admin unlocked.";
      setAdminVisible(true);
      return true;
    } else {
      const data = await res.json().catch(() => ({}));
      txt.textContent = data.detail || "Token invalid";
      setAdminVisible(false);
      return false;
    }
  } catch (e) {
    document.getElementById("auth-msg").textContent = "Network error";
    setAdminVisible(false);
    return false;
  }
}

function updateAuthUI() {
  const token = getToken();
  document.getElementById("token-input").value = token;
  if (token) {
    document.getElementById("auth-msg").textContent = "Admin token loaded. Click 'Check Token' or 'Log in' to validate.";
  } else {
    document.getElementById("auth-msg").textContent = "Not signed in.";
    setAdminVisible(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateAuthUI();
  // If a token exists locally, validate it quietly on load
  if (getToken()) checkToken();

  document.getElementById("login-btn").addEventListener("click", () => {
    (async () => {
      const t = document.getElementById("token-input").value.trim();
      if (!t) return alert("Enter token");
      setToken(t);
      await checkToken();
    })();
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    setToken("");
  });

  document.getElementById("token-check").addEventListener("click", () => {
    checkToken();
  });

  document.getElementById("create-post").addEventListener("click", async () => {
    const title = document.getElementById("post-title").value.trim();
    const category = document.getElementById("post-category").value.trim() || "Daily Life";
    const body = document.getElementById("post-body").value.trim();
    if (!title || !body) return alert("Title and body required");

    const payload = { title, category, body, images: postImages.slice(), attachments: postFiles.slice() };
    const res = await fetch(`${API_BASE}/admin/post`, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify(payload),
    });
    const out = document.getElementById("post-msg");
    if (res.ok) {
      out.textContent = "Post created.";
      document.getElementById("post-title").value = "";
      document.getElementById("post-body").value = "";
      // clear attached lists
      postImages = [];
      postFiles = [];
      const imgList = document.getElementById("post-images-list");
      const fileList = document.getElementById("post-files-list");
      if (imgList) imgList.innerHTML = "";
      if (fileList) fileList.innerHTML = "";
    } else {
      const data = await res.json().catch(() => ({}));
      out.textContent = data.detail || "Failed to create post";
    }
      // refresh managed posts list after creating
      await loadPosts();
  });

  document.getElementById("upload-image").addEventListener("click", async () => {
    const fileInput = document.getElementById("image-file");
    if (!fileInput.files || fileInput.files.length === 0) return alert("Choose an image file first");
    const form = new FormData();
    form.append("image", fileInput.files[0]);
    const res = await fetch(`${API_BASE}/admin/upload-image`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    const out = document.getElementById("image-msg");
    if (res.ok) {
      const data = await res.json();
      out.innerHTML = `Uploaded: <a href="${data.image.url}" target="_blank">${data.image.filename}</a>`;
      // add to post images list so it can be attached to a post
      postImages.push(data.image.url);
      const list = document.getElementById("post-images-list");
      if (list) {
        const li = document.createElement("li");
        li.innerHTML = `<a href="${data.image.url}" target="_blank">${data.image.filename}</a>`;
        list.appendChild(li);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      out.textContent = data.detail || "Upload failed";
    }
  });

  document.getElementById("upload-file").addEventListener("click", async () => {
    const fileInput = document.getElementById("attach-file");
    if (!fileInput.files || fileInput.files.length === 0) return alert("Choose a file first");
    const label = document.getElementById("attach-label").value.trim();
    const form = new FormData();
    form.append("file", fileInput.files[0]);
    const res = await fetch(`${API_BASE}/admin/upload-file`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    const out = document.getElementById("file-msg");
    if (res.ok) {
      const data = await res.json();
      out.innerHTML = `Uploaded: <a href="${data.file.url}" target="_blank">${data.file.filename}</a>`;
      if (label) out.innerHTML += `<div>Label: ${label}</div>`;
      // add to post files list so it can be attached to a post
      postFiles.push({ url: data.file.url, filename: data.file.filename, label });
      const list = document.getElementById("post-files-list");
      if (list) {
        const li = document.createElement("li");
        li.innerHTML = `<a href="${data.file.url}" target="_blank">${data.file.filename}</a>${label? ' — '+label : ''}`;
        list.appendChild(li);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      out.textContent = data.detail || "Upload failed";
    }
    // refresh managed posts in case attachments are used
    await loadPosts();
  });

  // Manage posts: load and render
  document.getElementById("refresh-posts").addEventListener("click", async () => {
    await loadPosts();
  });

  async function loadPosts() {
    const list = document.getElementById("manage-posts-list");
    const msg = document.getElementById("manage-msg");
    if (!list) return;
    list.innerHTML = "Loading...";
    try {
      const res = await fetch(`${API_BASE}/content`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      const data = await res.json();
      const posts = data.posts || [];
      if (posts.length === 0) {
        list.innerHTML = "<li>No posts available</li>";
        return;
      }
      list.innerHTML = "";
      for (const p of posts) {
        const li = document.createElement("li");
        li.className = "manage-item";
        const title = document.createElement("div");
        title.innerHTML = `<strong>${p.title}</strong> <span style=\"color:var(--text-muted);\">(${p.category} — ${p.created_at||''})</span>`;
        const actions = document.createElement("div");
        actions.style = "margin-top:6px;";
        const view = document.createElement("a");
        view.href = `/`; // leave as placeholder
        view.textContent = "View";
        view.target = "_blank";
        const del = document.createElement("button");
        del.textContent = "Delete";
        del.className = "button secondary";
        del.style = "margin-left:8px;";
        del.addEventListener("click", async () => {
          if (!confirm(`Delete post: ${p.title}?`)) return;
          try {
            const dres = await fetch(`${API_BASE}/admin/post/${p.id}`, { method: "DELETE", headers: authHeaders() });
            if (!dres.ok) {
              const err = await dres.json().catch(() => ({}));
              msg.textContent = err.detail || "Failed to delete post";
            } else {
              msg.textContent = "Post deleted";
              await loadPosts();
            }
          } catch (e) {
            msg.textContent = "Network error";
          }
        });
        actions.appendChild(view);
        actions.appendChild(del);
        li.appendChild(title);
        li.appendChild(actions);
        list.appendChild(li);
      }
    } catch (e) {
      list.innerHTML = "<li>Error loading posts</li>";
    }
  }

  // expose loadPosts when token validated
  window.loadPosts = loadPosts;
});
