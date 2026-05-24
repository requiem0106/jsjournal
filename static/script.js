const contentUrl = "/api/content";

async function fetchContent() {
  try {
    const response = await fetch(contentUrl);
    if (!response.ok) {
      throw new Error(`Unable to retrieve content: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

function formatDate(dateString) {
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function renderHome(data) {
  const grid = document.getElementById("thoughts-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!data.posts || data.posts.length === 0) {
    grid.innerHTML = `<div class="card"><h3>Quiet moment</h3><p>New journal entries will appear here as you add them with the admin API.</p></div>`;
    return;
  }

  data.posts.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${entry.title}</h3>
      <p>${entry.body}</p>
      <div class="meta"><span>${entry.category}</span><span>${formatDate(entry.created_at)}</span></div>
      ${renderMedia(entry.images, entry.attachments)}
    `;
    grid.appendChild(card);
  });
}

function renderStudy(data) {
  const grid = document.getElementById("study-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!data.study || data.study.length === 0) {
    grid.innerHTML = `<div class="card"><h3>Start tracking your progress</h3><p>Use the admin API to add study subjects, notes, and resources.</p></div>`;
    return;
  }

  data.study.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.cursor = "pointer";
    card.style.display = "flex";
    card.style.alignItems = "center";
    card.style.justifyContent = "center";
    card.style.minHeight = "160px";
    card.style.transition = "transform 140ms ease, box-shadow 140ms ease";

    card.innerHTML = `<h3 style="margin: 0; text-align: center; font-size: 1.4rem;">${item.subject}</h3>`;
    
    card.addEventListener('click', () => openSubject(item.subject));
    card.addEventListener('mouseenter', () => {
      card.style.transform = "translateY(-4px)";
      card.style.boxShadow = "0 16px 48px rgba(1, 14, 34, 0.5)";
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "none";
    });
    
    grid.appendChild(card);
  });
}

async function openSubject(subject) {
  const modal = document.getElementById('subject-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  title.textContent = subject;
  body.innerHTML = '<p>Loading…</p>';
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('visible');

  try {
    const res = await fetch(`${contentUrl}?category=${encodeURIComponent(subject)}`);
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    const posts = data.posts || [];
    if (posts.length === 0) {
      body.innerHTML = '<div class="card"><h3>No posts yet</h3><p>No posts or media for this subject yet.</p></div>';
      return;
    }

    body.innerHTML = '';
    posts.forEach((entry) => {
      const el = document.createElement('article');
      el.className = 'card';
      el.innerHTML = `
        <h3>${entry.title}</h3>
        <div class="meta"><span>${entry.category}</span><span>${formatDate(entry.created_at)}</span></div>
        <p>${entry.body}</p>
        ${renderMedia(entry.images, entry.attachments)}
      `;
// Add delete button if the admin is logged in
        const storedToken = localStorage.getItem("adminToken") || ""; 

        if (storedToken === "stargaze-2026") {
            const deleteBtn = document.createElement("button");
            deleteBtn.innerText = "Delete";
            deleteBtn.style.background = "#ff4d4d";
            deleteBtn.style.color = "white";
            deleteBtn.style.border = "none";
            deleteBtn.style.padding = "5px 10px";
            deleteBtn.style.borderRadius = "4px";
            deleteBtn.style.cursor = "pointer";
            deleteBtn.style.marginTop = "10px";
            
            deleteBtn.onclick = async (e) => {
                e.stopPropagation(); 
                if (confirm("Are you sure you want to delete this post?")) {
                    const response = await fetch(`/api/posts/${post.id}?admin_token=${storedToken}`, {
                        method: "DELETE"
                    });
                    if (response.ok) {
                        alert("Post deleted!");
                        location.reload(); 
                    } else {
                        alert("Failed to delete post.");
                    }
                }
            };
            card.appendChild(deleteBtn); 
        }
      body.appendChild(el);
    });
  } catch (e) {
    body.innerHTML = '<div class="card"><h3>Error</h3><p>Unable to load posts.</p></div>';
  }
}

// modal close handling
window.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('subject-modal');
  const close = document.getElementById('modal-close');
  if (close) close.addEventListener('click', () => {
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
  });
  // close on overlay click
  if (modal) modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
    }
  });
});

function renderMedia(images = [], attachments = []) {
  const imageHtml = images
    .map((imageUrl) => `<img src="${imageUrl}" alt="Journal image" style="border-radius: 18px; margin-top: 20px; width:100%" />`)
    .join("");

  const attachmentsHtml = attachments
    .map(
      (attachment) => `
        <li><a href="${attachment.url}" target="_blank" rel="noopener noreferrer">${attachment.label || attachment.filename}</a></li>
      `
    )
    .join("");

  return `
    ${imageHtml}
    ${attachmentsHtml ? `<ul class="attachment-list">${attachmentsHtml}</ul>` : ""}
  `;
}

function renderResources(resources = []) {
  if (!resources || resources.length === 0) {
    return "";
  }
  const resourceHtml = resources
    .map((resource) => `
      <li><a href="${resource.url}" target="_blank" rel="noopener noreferrer">${resource.label}</a></li>
    `)
    .join("");
  return `<ul class="resource-list">${resourceHtml}</ul>`;
}

window.addEventListener("DOMContentLoaded", async () => {
  const data = await fetchContent();
  if (!data) return;
  renderHome(data);
  renderStudy(data);
});
