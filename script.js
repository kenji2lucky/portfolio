import { SITE_CONTENT } from "./content.js?v=10";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function renderClients() {
  const section = $("#clients");
  const slots = $("#client-slots");
  const clients = SITE_CONTENT.clients ?? [];

  if (!clients.length) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  slots.replaceChildren();

  clients.slice(0, 3).forEach((client) => {
    const image = document.createElement("img");
    image.src = client.image;
    image.alt = client.alt || client.name || "Client case file";

    if (client.url) {
      const link = document.createElement("a");
      link.className = "client-card";
      link.href = client.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Open ${client.name || "client"} profile`);
      link.append(image);
      slots.append(link);
    } else {
      const wrapper = document.createElement("div");
      wrapper.className = "client-card-static";
      wrapper.append(image);
      slots.append(wrapper);
    }
  });
}

function makeProjectOverlay(project, index) {
  const row = index + 1;
  const frag = document.createDocumentFragment();

  const videoWrap = document.createElement("div");
  videoWrap.className = `project-video row-${row}`;

  const player = document.createElement("mux-player");
  player.setAttribute("playback-id", project.playbackId);
  player.setAttribute("metadata-video-id", project.playbackId);
  player.setAttribute("metadata-video-title", project.title);
  player.setAttribute("stream-type", "on-demand");
  player.setAttribute("preload", "metadata");
  player.setAttribute("playsinline", "");
  player.setAttribute("muted", "");
  player.setAttribute("loop", "");
  player.muted = true;
  player.defaultMuted = true;
  const posterUrl = `https://image.mux.com/${encodeURIComponent(project.playbackId)}/thumbnail.jpg?time=1`;
  const poster = document.createElement("img");
  poster.className = "project-poster";
  poster.src = posterUrl;
  poster.alt = "";
  videoWrap.append(poster);
  player.setAttribute("poster", posterUrl);
  videoWrap.append(player);

  // Keep the thumbnail visible until playback actually starts, including
  // when Safari delays loading or rejects autoplay.
  player.addEventListener("playing", () => videoWrap.classList.add("is-ready"));
  for (const event of ["pause", "ended", "error", "emptied"]) {
    player.addEventListener(event, () => videoWrap.classList.remove("is-ready"));
  }

  const title = document.createElement("div");
  title.className = `project-title row-${row}`;
  title.textContent = project.title;

  const duration = document.createElement("div");
  duration.className = `project-duration row-${row}`;
  duration.textContent = "--:--";

  const updateDuration = () => {
    duration.textContent = formatDuration(player.duration);
  };
  player.addEventListener("loadedmetadata", updateDuration);
  player.addEventListener("durationchange", updateDuration);

  const videoHit = document.createElement("button");
  videoHit.type = "button";
  videoHit.className = `project-open video-hit row-${row}`;
  videoHit.setAttribute("aria-label", `Open ${project.title}`);
  videoHit.addEventListener("click", () => openFullPlayer(project));

  const playHit = document.createElement("button");
  playHit.type = "button";
  playHit.className = `project-open play-hit row-${row}`;
  playHit.setAttribute("aria-label", `Play ${project.title}`);
  playHit.addEventListener("click", () => openFullPlayer(project));

  frag.append(videoWrap, title, duration, videoHit, playHit);
  return { frag, player };
}

const ratios = new Map();
let previewPlayers = [];
let activePreview = null;

function chooseActivePreview() {
  let best = null;
  const suspended = $("#video-dialog").open || document.hidden;
  let bestRatio = 0;

  for (const player of previewPlayers) {
    const ratio = ratios.get(player) || 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = player;
    }
  }

  if (bestRatio < 0.55 || suspended) best = null;

  for (const player of previewPlayers) {
    if (player === best) {
      if (activePreview !== player) {
        player.muted = true;
        if (typeof player.play === "function") player.play().catch(() => {});
      }
    } else if (typeof player.pause === "function" && !player.paused) {
      player.pause();
    }
  }
  activePreview = best;
}

function observePreviews() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const player = entry.target.querySelector("mux-player");
      if (player) ratios.set(player, entry.intersectionRatio);
    }
    chooseActivePreview();
  }, { threshold: [0, .25, .4, .55, .7, .85, 1] });

  $$(".project-video").forEach((wrap) => observer.observe(wrap));
}

function renderProjects() {
  const host = $("#project-overlays");
  host.replaceChildren();
  previewPlayers = [];

  SITE_CONTENT.projects.slice(0, 3).forEach((project, index) => {
    const { frag, player } = makeProjectOverlay(project, index);
    host.append(frag);
    previewPlayers.push(player);
  });

  observePreviews();
}

function openFullPlayer(project) {
  const dialog = $("#video-dialog");
  const wrap = $("#dialog-player-wrap");
  activePreview = null;
  previewPlayers.forEach((p) => { if (typeof p.pause === "function") p.pause(); });

  wrap.replaceChildren();
  const player = document.createElement("mux-player");
  player.setAttribute("playback-id", project.playbackId);
  player.setAttribute("metadata-video-id", project.playbackId);
  player.setAttribute("metadata-video-title", project.title);
  player.setAttribute("stream-type", "on-demand");
  player.setAttribute("playsinline", "");
  player.setAttribute("autoplay", "any");
  player.title = project.title;
  wrap.append(player);

  dialog.showModal();
  requestAnimationFrame(() => {
    if (typeof player.play === "function") player.play().catch(() => {});
  });
}

function closeFullPlayer() {
  const dialog = $("#video-dialog");
  $("#dialog-player-wrap").replaceChildren();
  if (dialog.open) dialog.close();
  chooseActivePreview();
}

function wireSocials() {
  $("#x-link").href = SITE_CONTENT.socials.x;
  $("#discord-link").href = SITE_CONTENT.socials.discord;
}

renderClients();
// Ensure properties and playback methods are available before observing previews.
customElements.whenDefined("mux-player").then(renderProjects);
wireSocials();

$("#dialog-close").addEventListener("click", closeFullPlayer);
$("#video-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeFullPlayer();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFullPlayer();
});

document.addEventListener("visibilitychange", chooseActivePreview);
