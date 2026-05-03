const ZALO_URL = "https://zalo.me/sdt_cua_ban";
const DATA_URL = new URL("./data.json", window.location.href).toString();

const PRODUCT_HASH_PREFIX = "#product-";
const PRODUCT_HASH_RE = /^#product-(.+)$/;
const HASH_SHIPPING_SERVICES = "#shipping-services";
const DESIGN_HASH_PREFIX = "#design-";
const DESIGN_HASH_RE = /^#design-(.+)$/;
const EMBROIDERY_HASH_PREFIX = "#embroidery-";
const EMBROIDERY_HASH_RE = /^#embroidery-(.+)$/;

/** Tim màu chỉ mặc định (có thể ghi đè bằng `thread_colors` trong data) */
const DEFAULT_EMBROIDERY_THREADS = [
  { id: "black", label: "Black", hex: "#1c1c1c" },
  { id: "caramel", label: "Caramel", hex: "#c48b5f" },
  { id: "choco", label: "Choco", hex: "#5d4037" },
  { id: "dust-pink", label: "Dust pink", hex: "#e8c6c9" },
  { id: "fairy-grey", label: "Fairy Grey", hex: "#bbb8bc" },
  { id: "fairy-pink", label: "Fairy Pink", hex: "#f5b8c8" },
  { id: "fairy-purple", label: "Fairy Purple", hex: "#b39ddb" },
  { id: "grey", label: "Grey", hex: "#7a7a7a" },
  { id: "icy-blue", label: "Icy Blue", hex: "#9ec9e0" },
  { id: "light-purple", label: "Light Purple", hex: "#d1c4e9" },
  { id: "matcha", label: "Matcha", hex: "#9dad7f" },
  { id: "milk", label: "Milk", hex: "#e8e0d5" },
  { id: "navy", label: "Navy", hex: "#2c3e50" },
  { id: "valentine", label: "Valentine", hex: "#e879a3" },
];

const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

const THREAD_SWATCH_IDLE =
  "flex flex-col items-center gap-1.5 rounded-xl bg-white p-2 ring-1 ring-black/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25";
const THREAD_SWATCH_ACTIVE =
  "flex flex-col items-center gap-1.5 rounded-xl bg-white p-2 ring-2 ring-black ring-offset-2 ring-offset-headerTop transition focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

const DEFAULT_PRODUCT_DETAILS = [
  "Giới hạn thêu 10 kí tự.",
  "Thông tin kích thước & mẫu theo tên sản phẩm (cập nhật trong chi tiết phiên bản đặt).",
  "Đơn hàng có thể đã gồm chi phí đóng gói (hộp + thiệp) — xác nhận khi thanh toán.",
  "Thời gian hoàn thiện 7–10 ngày làm việc.",
];

let productsCache = [];
/** @type {{ gallery: string[], index: number } | null} */
let productDetailCarousel = null;

function openZalo() {
  window.open(ZALO_URL, "_blank", "noopener,noreferrer");
}

function safeText(value) {
  return String(value ?? "");
}

function isOutOfStock(status) {
  return safeText(status).toLowerCase().includes("hết");
}

/** Định dạng giá hiển thị: 230.000 đ */
function formatPriceDisplay(raw) {
  const s = safeText(raw);
  const digits = s.replace(/\D/g, "");
  if (!digits) return s.trim() || "—";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return s.trim();
  const withDots = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots} đ`;
}

function getProductGallery(product) {
  if (Array.isArray(product.gallery) && product.gallery.length > 0) {
    return product.gallery.map((u) => safeText(u)).filter(Boolean);
  }
  const u = safeText(product.image_url);
  return u ? [u] : [];
}

function getProductDetails(product) {
  if (Array.isArray(product.details) && product.details.length > 0) {
    return product.details.map((t) => safeText(t)).filter(Boolean);
  }
  return DEFAULT_PRODUCT_DETAILS.slice();
}

const DESIGN_COLOR_PILL_IDLE =
  "rounded-full border border-black bg-white px-4 py-2.5 text-left text-sm font-medium text-black transition hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-headerTop";
const DESIGN_COLOR_PILL_ACTIVE =
  "rounded-full border border-black bg-black px-4 py-2.5 text-left text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-headerTop";

/** @typedef {{ id: string, label: string, image_url: string }} DesignColorChoice */

/** @returns {DesignColorChoice} */
function normalizeDesignColor(raw, idx) {
  if (typeof raw === "string") {
    const label = raw.trim();
    return { id: `color-${idx}`, label, image_url: "" };
  }
  const label = safeText(raw.label || raw.name);
  const idRaw = safeText(raw.id);
  const id = idRaw || `color-${idx}`;
  const image_url = safeText(raw.image_url || raw.image);
  return { id, label, image_url };
}

/** @returns {DesignColorChoice[]} */
function getProductColorChoices(product) {
  const arr = product?.colors;
  if (!Array.isArray(arr)) return [];
  return arr.map((x, i) => normalizeDesignColor(x, i)).filter((x) => x.label);
}

function resolveDesignHeroUrl(product, colorChoice) {
  const cu = safeText(colorChoice?.image_url);
  if (cu) return cu;
  const g = getProductGallery(product);
  if (g.length) return g[0];
  return safeText(product.image_url);
}

function designFlowMainTitle(product) {
  const name = safeText(product.name);
  if (isOutOfStock(product.status)) {
    return `Thiết kế & Mua hàng [HẾT HÀNG] – ${name}`;
  }
  return `Thiết kế & Mua hàng ${name}`;
}

function embPreviewStorageKey(productId) {
  return `cgf-emb-preview-${safeText(productId)}`;
}

function persistDesignPreviewForEmbroidery(productId) {
  const hero = document.getElementById("designHeroImage");
  const src = safeText(hero?.currentSrc || hero?.src);
  const options = document.getElementById("designColorOptions");
  const checked = options?.querySelector('[role="radio"][aria-checked="true"]');
  try {
    sessionStorage.setItem(
      embPreviewStorageKey(productId),
      JSON.stringify({
        src,
        colorId: safeText(checked?.dataset.colorId),
      }),
    );
  } catch (_) {}
}

function getEmbroideryPreviewUrl(product) {
  try {
    const raw = sessionStorage.getItem(embPreviewStorageKey(product.id));
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.src) return o.src;
    }
  } catch (_) {}
  const colors = getProductColorChoices(product);
  return resolveDesignHeroUrl(product, colors[0] || {});
}

function getEmbroideryHint(product) {
  const h = safeText(product.embroider_hint);
  if (h) return h;
  return "thêu <10 kí tự + 2 icon nhỏ";
}

function normalizeThreadSwatch(raw, i) {
  if (typeof raw === "string") {
    const label = raw.trim();
    return { id: `t${i}`, label, hex: "#999999" };
  }
  return {
    id: safeText(raw.id) || `t${i}`,
    label: safeText(raw.label || raw.name || `Màu ${i + 1}`),
    hex: safeText(raw.hex || raw.color || "#888888"),
  };
}

function getEmbroideryThreadSwatches(product) {
  const arr = product?.thread_colors;
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.map((x, i) => normalizeThreadSwatch(x, i)).filter((x) => x.label);
  }
  return DEFAULT_EMBROIDERY_THREADS;
}

/** Font trong bước thêu — map với <select id="embroideryFontSelect"> */
const EMB_FONT_FAMILY = {
  candy: '"Dancing Script", "Brush Script MT", cursive',
  poppins: "Poppins, system-ui, sans-serif",
  script: '"Dancing Script", cursive',
  serif: 'Georgia, "Times New Roman", serif',
};

/**
 * @typedef {{ kind?: 'text', id: string, text: string, nx: number, ny: number, rotate: number, scale: number, fontKey: string, fontSize: number, colorHex: string }} EmbTextLayer
 * @typedef {{ kind: 'icon', id: string, iconId: string, nx: number, ny: number, rotate: number, scale: number, sizePx: number, colorHex: string }} EmbIconLayer
 * @typedef {EmbTextLayer | EmbIconLayer} EmbDesignLayer
 */

/** @type {EmbDesignLayer[]} */
let embDesignLayers = [];

/** @type {string | null} */
let embSelectedLayerId = null;

/** @type {null | { mode: string, pid: number, id: string, [key: string]: number }} */
let embPointerSession = null;

let embroideryPointerGloballyWired = false;

const SVG_NS = "http://www.w3.org/2000/svg";

const EMB_MODAL_ICON_CHOICES = [
  { id: "paw", label: "Chân chó mèo" },
  { id: "kitty", label: "Kitty" },
  { id: "bow", label: "Nơ" },
  { id: "heart", label: "Trái tim" },
  { id: "crown", label: "Vương miện" },
];

function makeEmbLayerId() {
  return `emb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** @param {EmbDesignLayer} layer */
function embLayerKind(layer) {
  return layer.kind === "icon" ? "icon" : "text";
}

/**
 * @param {string} iconId
 * @param {number} sizePx
 * @param {string} colorHex
 */
function buildEmbIconVisual(iconId, sizePx, colorHex) {
  const wrap = document.createElement("span");
  wrap.dataset.embIcon = "1";
  wrap.className = "inline-flex items-center justify-center leading-none";
  wrap.style.color = colorHex;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(sizePx));
  svg.setAttribute("height", String(sizePx));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.style.overflow = "visible";

  switch (iconId) {
    case "paw": {
      svg.setAttribute("fill", "currentColor");
      const g = document.createElementNS(SVG_NS, "g");
      g.innerHTML =
        '<ellipse cx="8.2" cy="7.3" rx="1.6" ry="1.9"/><ellipse cx="15.8" cy="7.3" rx="1.6" ry="1.9"/><ellipse cx="6.4" cy="10.6" rx="1.35" ry="1.7"/><ellipse cx="17.6" cy="10.6" rx="1.35" ry="1.7"/><path d="M12 12.2c2.8 0 5 2.1 4.3 4.7-.6 2.2-4.3 3.5-7.4 2.1-2.5-1-1.5-4.4 3.1-6.8z"/>';
      svg.appendChild(g);
      break;
    }
    case "kitty": {
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "1.35");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      const g = document.createElementNS(SVG_NS, "g");
      g.innerHTML =
        '<path d="M12 16.95c4.05 0 6.35-4 6.1-7.2-.22-2.5-2.55-5.15-6.1-6.65-3.55 1.5-5.88 4.15-6.1 6.65-.25 3.2 2.05 7.2 6.1 7.2z"/><path d="M7.15 6.45L6.1 4.05 9 6M16.85 6.45 17.9 4.05 15 6"/><ellipse fill="currentColor" stroke="none" cx="9.65" cy="11.9" rx=".68" ry="1"/><ellipse fill="currentColor" stroke="none" cx="14.35" cy="11.9" rx=".68" ry="1"/><path stroke-linecap="round" d="M9.95 13.95q2.05 1.45 4.1 0"/>';
      svg.appendChild(g);
      break;
    }
    case "bow": {
      svg.setAttribute("fill", "currentColor");
      svg.innerHTML =
        '<path d="M8.5 10.4C6.3 9.6 4.5 10.2 4 12c-.5 1.8 1.4 3.3 3.7 3.1 1.6-.1 2.7-.8 3.3-1.8V12c-.6-1-1.7-1.6-3.5-1.6zm7 0c2.2-.8 4-.2 4.5 1.6s-1.4 3.3-3.7 3.1c-1.6-.1-2.7-.8-3.3-1.8V12c.6-1 1.7-1.6 3.5-1.6z"/><circle cx="12" cy="12" r="1.25"/>';
      break;
    }
    case "heart": {
      svg.setAttribute("fill", "currentColor");
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute(
        "d",
        "M12 20.35l-1.06-.97C7.06 15.71 4 13.06 4 9.92 4 7.24 6.06 5.2 8.73 5.2c1.61 0 3.17.74 4.27 1.93 1.1-1.19 2.66-1.93 4.27-1.93C19.94 5.2 22 7.24 22 9.92c0 3.14-3.06 5.79-6.94 10.46L12 20.35z",
      );
      svg.appendChild(p);
      break;
    }
    case "crown": {
      svg.setAttribute("fill", "currentColor");
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute(
        "d",
        "M5 16.5h14l-1-7.2-3.2 2.6L12 5.5 9.2 11.9 6 9.3 5 16.5zm0 0l-.5 2.5h15L19 16.5H5z",
      );
      svg.appendChild(p);
      break;
    }
    default: {
      svg.setAttribute("fill", "currentColor");
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", "12");
      c.setAttribute("cy", "12");
      c.setAttribute("r", "4");
      svg.appendChild(c);
    }
  }

  wrap.appendChild(svg);
  return wrap;
}

let embIconModalPrepared = false;

function ensureEmbIconModalGrid() {
  const grid = document.getElementById("embIconModalGrid");
  if (!grid || embIconModalPrepared) return;
  embIconModalPrepared = true;
  const previewColor = "#4b5563";

  for (const def of EMB_MODAL_ICON_CHOICES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className =
      "flex aspect-square min-h-0 items-center justify-center rounded-xl border border-pink-200/90 bg-gradient-to-b from-pink-50 to-rose-50/60 p-2 shadow-sm transition hover:ring-2 hover:ring-pink-300/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400";
    b.setAttribute("aria-label", def.label);
    b.appendChild(buildEmbIconVisual(def.id, 34, previewColor));
    b.addEventListener("click", () => attachEmbroideryIconFromPick(def.id));
    grid.appendChild(b);
  }
}

function openEmbIconModal() {
  ensureEmbIconModalGrid();
  const modal = document.getElementById("embIconModal");
  if (!(modal instanceof HTMLElement)) return;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("overflow-hidden");
}

function closeEmbIconModal() {
  const modal = document.getElementById("embIconModal");
  if (!(modal instanceof HTMLElement)) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("overflow-hidden");
}

function wireEmbIconModalOnce() {
  const modal = document.getElementById("embIconModal");
  if (!(modal instanceof HTMLElement) || modal.dataset.wired === "1") return;
  modal.dataset.wired = "1";
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeEmbIconModal();
  });
  document.getElementById("btnEmbIconModalClose")?.addEventListener("click", closeEmbIconModal);
}

function attachEmbroideryIconFromPick(iconId) {
  embroideryWireGlobalPointerHandlers();
  embroideryBindOverlayBackdrop();
  closeEmbIconModal();

  let fz = parseInt(safeText(document.getElementById("embroideryFontSize")?.value), 10);
  if (!Number.isFinite(fz)) fz = 28;
  const sizePx = Math.min(140, Math.max(18, Math.round(fz * 1.35)));

  const hex = getEmbroideryActiveThreadHex();

  embDesignLayers.push({
    kind: "icon",
    id: makeEmbLayerId(),
    iconId,
    nx: 0.5,
    ny: 0.52,
    rotate: 0,
    scale: 1,
    sizePx,
    colorHex: hex,
  });

  embSelectedLayerId = embDesignLayers[embDesignLayers.length - 1].id;
  const layer = embDesignLayers[embDesignLayers.length - 1];
  syncEmbroideryControlsFromLayer(layer);
  renderEmbroideryOverlayLayers();
}

function updateEmbroideryTypographyUiLock() {
  const sel = document.getElementById("embroideryFontSelect");
  const layer = embDesignLayers.find((l) => l.id === embSelectedLayerId);
  const lock = !!(layer && embLayerKind(layer) === "icon");
  if (sel) sel.disabled = lock;
}

function embroideryInitIconUi() {
  wireEmbIconModalOnce();
}

function getEmbroideryCurrentProduct() {
  const sid = document.getElementById("product-embroidery-step")?.dataset.productId;
  if (!sid || !productsCache.length) return null;
  return productsCache.find((x) => safeText(x.id) === safeText(sid)) || null;
}

function getEmbroideryActiveThreadHex() {
  const product = getEmbroideryCurrentProduct();
  if (!product) return "#1c1c1c";
  const sec = document.getElementById("product-embroidery-step");
  const tid = safeText(sec?.dataset.threadId);
  const list = getEmbroideryThreadSwatches(product);
  const found = list.find((x) => safeText(x.id) === tid);
  return safeText(found?.hex) || safeText(list[0]?.hex) || "#1c1c1c";
}

function resetEmbroideryEditorState() {
  embDesignLayers = [];
  embSelectedLayerId = null;
  embPointerSession = null;
  closeEmbIconModal();
  const overlay = document.getElementById("embroideryOverlay");
  if (overlay) overlay.innerHTML = "";
  const msg = document.getElementById("embroideryTextValidation");
  if (msg) msg.textContent = "";
  updateEmbroideryTypographyUiLock();
}

function embFontCss(key) {
  return EMB_FONT_FAMILY[key] || EMB_FONT_FAMILY.candy;
}

function syncEmbroideryControlsFromLayer(layer) {
  const sel = document.getElementById("embroideryFontSelect");
  const si = document.getElementById("embroideryFontSize");
  if (embLayerKind(layer) === "icon") {
    if (si) si.value = String(Math.round(layer.sizePx));
    return;
  }
  if (sel && layer.fontKey) sel.value = layer.fontKey in EMB_FONT_FAMILY ? layer.fontKey : "candy";
  if (si) si.value = String(layer.fontSize);
}

function syncSelectedLayerTypographyFromInputs() {
  const layer = embDesignLayers.find((l) => l.id === embSelectedLayerId);
  if (!layer) return;
  let fz = parseInt(safeText(document.getElementById("embroideryFontSize")?.value), 10);
  if (!Number.isFinite(fz)) fz = 28;
  if (embLayerKind(layer) === "icon") {
    layer.sizePx = Math.min(140, Math.max(18, fz));
    return;
  }
  let fk = safeText(document.getElementById("embroideryFontSelect")?.value) || "candy";
  if (!(fk in EMB_FONT_FAMILY)) fk = "candy";
  layer.fontKey = fk;
  layer.fontSize = Math.min(96, Math.max(10, fz));
}

function applyEmbroideryThreadColorToLayersFromUi() {
  if (!embDesignLayers.length) return;
  const hex = getEmbroideryActiveThreadHex();
  for (const L of embDesignLayers) {
    L.colorHex = hex;
  }
  renderEmbroideryOverlayLayers();
}

function refreshEmbroideryLayerTransformsOnly() {
  const overlay = document.getElementById("embroideryOverlay");
  if (!overlay) return;
  for (const L of embDesignLayers) {
    const root = overlay.querySelector(`[data-emb-layer-id="${L.id}"]`);
    if (root instanceof HTMLElement) {
      root.style.left = `${L.nx * 100}%`;
      root.style.top = `${L.ny * 100}%`;
      root.style.transform = `translate(-50%,-50%) rotate(${L.rotate}deg) scale(${L.scale})`;
    }
    if (embLayerKind(L) === "icon") {
      const holder = root?.querySelector?.("[data-emb-icon]");
      if (holder instanceof HTMLElement) {
        holder.style.color = L.colorHex;
        const svg = holder.querySelector("svg");
        if (svg) {
          svg.setAttribute("width", String(L.sizePx));
          svg.setAttribute("height", String(L.sizePx));
        }
      }
    } else {
      const span = root?.querySelector?.("[data-emb-text]");
      if (span instanceof HTMLElement) {
        span.style.fontFamily = embFontCss(L.fontKey);
        span.style.fontSize = `${L.fontSize}px`;
        span.style.color = L.colorHex;
      }
    }
  }
}

function renderEmbroideryOverlayLayers() {
  const overlay = document.getElementById("embroideryOverlay");
  if (!(overlay instanceof HTMLElement)) return;

  overlay.innerHTML = "";

  embDesignLayers.forEach((layer) => {
    const root = document.createElement("div");
    root.dataset.embLayerId = layer.id;
    root.style.position = "absolute";
    root.style.left = `${layer.nx * 100}%`;
    root.style.top = `${layer.ny * 100}%`;
    root.style.transform = `translate(-50%,-50%) rotate(${layer.rotate}deg) scale(${layer.scale})`;
    root.style.touchAction = "none";
    root.style.zIndex = embSelectedLayerId === layer.id ? "15" : "14";
    root.tabIndex = -1;

    root.className =
      embSelectedLayerId === layer.id
        ? "cursor-move outline-none select-none"
        : "cursor-grab outline-none select-none";

    const inner = document.createElement("div");
    inner.className =
      embLayerKind(layer) === "icon"
        ? "relative inline-block px-1 py-0.5"
        : "relative inline-block whitespace-nowrap px-1 py-0.5";
    inner.style.boxShadow = embSelectedLayerId === layer.id ? "0 0 0 2px dashed rgb(139 115 85)" : "none";
    inner.style.borderRadius = "2px";

    if (embLayerKind(layer) === "icon") {
      inner.appendChild(buildEmbIconVisual(layer.iconId, layer.sizePx, layer.colorHex));
    } else {
      const span = document.createElement("span");
      span.dataset.embText = "1";
      span.textContent = layer.text;
      span.style.fontFamily = embFontCss(layer.fontKey);
      span.style.fontSize = `${layer.fontSize}px`;
      span.style.color = layer.colorHex;
      span.style.fontWeight = "600";
      span.style.lineHeight = "1.12";
      span.style.textShadow = "0 1px 2px rgba(255,255,255,0.45)";
      inner.appendChild(span);
    }

    const hCls =
      "pointer-events-auto absolute z-20 h-2.5 w-2.5 rounded-full border border-white bg-[#6b4f2e] shadow-md touch-none";

    if (embSelectedLayerId === layer.id) {
      const corners = [
        { l: "-0.62rem", t: "-0.62rem", c: "nwse-resize" },
        { l: "calc(100% - 0.52rem)", t: "-0.62rem", c: "nesw-resize" },
        { l: "calc(100% - 0.52rem)", t: "calc(100% - 0.52rem)", c: "nwse-resize" },
        { l: "-0.62rem", t: "calc(100% - 0.52rem)", c: "nesw-resize" },
      ];
      for (const c of corners) {
        const h = document.createElement("div");
        h.dataset.embHandle = "resize";
        h.className = hCls;
        h.style.cursor = c.c;
        h.style.left = c.l;
        h.style.top = c.t;
        h.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          embSelectedLayerId = layer.id;
          beginEmbroideryResizeSession(ev, layer);
        });
        inner.appendChild(h);
      }

      const rot = document.createElement("div");
      rot.dataset.embHandle = "rotate";
      rot.style.left = "50%";
      rot.style.top = "calc(100% + 10px)";
      rot.style.transform = "translateX(-50%)";
      rot.className = `${hCls} cursor-grab active:cursor-grabbing`;
      rot.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        embSelectedLayerId = layer.id;
        beginEmbroideryRotateSession(ev, layer);
      });
      inner.appendChild(rot);
    }

    root.addEventListener("pointerdown", (ev) => {
      if (
        ev.target instanceof Element &&
        ev.target.closest("[data-emb-handle]")
      )
        return;
      ev.preventDefault();
      ev.stopPropagation();
      const prevSel = embSelectedLayerId;
      embSelectedLayerId = layer.id;
      syncEmbroideryControlsFromLayer(layer);
      if (prevSel !== layer.id) renderEmbroideryOverlayLayers();
      beginEmbroideryMoveSession(ev, layer);
    });

    root.appendChild(inner);
    overlay.appendChild(root);
  });
  updateEmbroideryTypographyUiLock();
}

function beginEmbroideryMoveSession(ev, layer) {
  const stage = document.getElementById("embroideryStage");
  if (!(stage instanceof HTMLElement)) return;
  const r = stage.getBoundingClientRect();
  embPointerSession = {
    mode: "move",
    pid: ev.pointerId,
    id: layer.id,
    sx: ev.clientX,
    sy: ev.clientY,
    snx: layer.nx,
    sny: layer.ny,
    rw: Math.max(r.width, 1),
    rh: Math.max(r.height, 1),
  };
}

function beginEmbroideryResizeSession(ev, layer) {
  const stage = document.getElementById("embroideryStage");
  if (!(stage instanceof HTMLElement)) return;
  const r = stage.getBoundingClientRect();
  const cx = r.left + layer.nx * r.width;
  const cy = r.top + layer.ny * r.height;
  const d0 = Math.hypot(ev.clientX - cx, ev.clientY - cy);
  embPointerSession = {
    mode: "resize",
    pid: ev.pointerId,
    id: layer.id,
    cx,
    cy,
    d0: Math.max(d0, 22),
    s0: layer.scale,
  };
}

function beginEmbroideryRotateSession(ev, layer) {
  const stage = document.getElementById("embroideryStage");
  if (!(stage instanceof HTMLElement)) return;
  const r = stage.getBoundingClientRect();
  const cx = r.left + layer.nx * r.width;
  const cy = r.top + layer.ny * r.height;
  const a = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;
  embPointerSession = {
    mode: "rotate",
    pid: ev.pointerId,
    id: layer.id,
    cx,
    cy,
    a0: a,
    r0: layer.rotate,
  };
}

function onEmbGlobalPointerMove(ev) {
  if (!embPointerSession || ev.pointerId !== embPointerSession.pid) return;
  const layer = embDesignLayers.find((l) => l.id === embPointerSession.id);
  if (!layer) return;

  if (embPointerSession.mode === "move") {
    const s = embPointerSession;
    const dx = (ev.clientX - s.sx) / s.rw;
    const dy = (ev.clientY - s.sy) / s.rh;
    layer.nx = Math.min(0.96, Math.max(0.04, s.snx + dx));
    layer.ny = Math.min(0.96, Math.max(0.04, s.sny + dy));
  } else if (embPointerSession.mode === "resize") {
    const s = embPointerSession;
    const d = Math.hypot(ev.clientX - s.cx, ev.clientY - s.cy);
    const ratio = Math.max(d, 12) / s.d0;
    layer.scale = Math.min(4, Math.max(0.22, s.s0 * ratio));
  } else if (embPointerSession.mode === "rotate") {
    const s = embPointerSession;
    const a = (Math.atan2(ev.clientY - s.cy, ev.clientX - s.cx) * 180) / Math.PI;
    layer.rotate = s.r0 + (a - s.a0);
  }
  refreshEmbroideryLayerTransformsOnly();
}

function onEmbGlobalPointerEnd(ev) {
  if (!embPointerSession || ev.pointerId !== embPointerSession.pid) return;
  embPointerSession = null;
  renderEmbroideryOverlayLayers();
}

function embroideryWireGlobalPointerHandlers() {
  if (embroideryPointerGloballyWired) return;
  embroideryPointerGloballyWired = true;
  document.addEventListener("pointermove", onEmbGlobalPointerMove, { passive: false });
  document.addEventListener("pointerup", onEmbGlobalPointerEnd);
  document.addEventListener("pointercancel", onEmbGlobalPointerEnd);
}

function embroideryBindOverlayBackdrop() {
  const overlay = document.getElementById("embroideryOverlay");
  if (!(overlay instanceof HTMLElement) || overlay.dataset.embBackdrop === "1") return;
  overlay.dataset.embBackdrop = "1";
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target !== overlay) return;
    embSelectedLayerId = null;
    renderEmbroideryOverlayLayers();
  });
}

function embroideryTryAddTextLayer() {
  embroideryWireGlobalPointerHandlers();
  embroideryBindOverlayBackdrop();

  const inp = document.getElementById("embroideryTextInput");
  const val = inp?.value?.trim();
  const msgEl = document.getElementById("embroideryTextValidation");

  if (!val) {
    if (msgEl) msgEl.textContent = "Vui lòng nhập chữ vào ô trên — nội dung đang trống.";
    inp?.focus();
    inp?.classList.add("ring-2", "ring-red-400", "rounded-lg");
    window.setTimeout(() => inp?.classList.remove("ring-2", "ring-red-400", "rounded-lg"), 850);
    return;
  }

  if (msgEl) msgEl.textContent = "";

  let fk = safeText(document.getElementById("embroideryFontSelect")?.value) || "candy";
  if (!(fk in EMB_FONT_FAMILY)) fk = "candy";
  let fz = parseInt(safeText(document.getElementById("embroideryFontSize")?.value), 10);
  if (!Number.isFinite(fz)) fz = 28;
  fz = Math.min(96, Math.max(10, fz));

  const hex = getEmbroideryActiveThreadHex();

  embDesignLayers.push({
    kind: "text",
    id: makeEmbLayerId(),
    text: val,
    nx: 0.52,
    ny: 0.38,
    rotate: 0,
    scale: 1,
    fontKey: fk,
    fontSize: fz,
    colorHex: hex,
  });

  embSelectedLayerId = embDesignLayers[embDesignLayers.length - 1].id;
  inp.value = "";
  renderEmbroideryOverlayLayers();
}

function renderEmbroideryThreadGrid(product) {
  const container = document.getElementById("embroideryThreadGrid");
  const section = document.getElementById("product-embroidery-step");
  if (!container) return;

  const list = getEmbroideryThreadSwatches(product);
  container.innerHTML = "";

  /** @param {number} activeIdx */
  function applyThreadSelection(activeIdx) {
    for (let i = 0; i < list.length; i++) {
      const b = container.children[i];
      if (!(b instanceof HTMLButtonElement)) continue;
      const on = i === activeIdx;
      b.setAttribute("aria-checked", String(on));
      b.className = on ? THREAD_SWATCH_ACTIVE : THREAD_SWATCH_IDLE;
    }
    if (section && list[activeIdx]) {
      section.dataset.threadId = list[activeIdx].id;
    }
    applyEmbroideryThreadColorToLayersFromUi();
  }

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(i === 0));
    btn.className = i === 0 ? THREAD_SWATCH_ACTIVE : THREAD_SWATCH_IDLE;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "h-8 w-8 md:h-9 md:w-9");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", HEART_PATH);
    path.setAttribute("fill", s.hex);
    svg.appendChild(path);
    btn.appendChild(svg);

    const lbl = document.createElement("span");
    lbl.className =
      "max-w-[4.25rem] text-center text-[10px] font-medium leading-tight text-neutral-800";
    lbl.textContent = s.label;
    btn.appendChild(lbl);

    btn.addEventListener("click", () => applyThreadSelection(i));
    container.appendChild(btn);
  }

  applyThreadSelection(0);
}

function renderDesignColorOptions(product) {
  const tray = document.getElementById("designColorTray");
  const options = document.getElementById("designColorOptions");
  const badge = document.getElementById("designStepBadge");
  const hero = document.getElementById("designHeroImage");
  const colors = getProductColorChoices(product);

  if (!tray || !options || !badge) return;

  if (!colors.length) {
    tray.classList.add("hidden");
    options.innerHTML = "";
    badge.textContent = "② Chọn biến thể";
    if (hero) {
      const g = getProductGallery(product);
      hero.src = g.length ? g[0] : safeText(product.image_url);
      hero.alt = safeText(product.name);
    }
    return;
  }

  tray.classList.remove("hidden");
  badge.textContent = "② Chọn màu sắc";
  options.innerHTML = "";

  /** @param {number} activeIdx */
  function applySelection(activeIdx) {
    for (let i = 0; i < colors.length; i++) {
      const btn = options.children[i];
      if (!(btn instanceof HTMLButtonElement)) continue;
      const on = i === activeIdx;
      btn.setAttribute("aria-checked", String(on));
      btn.className = on ? DESIGN_COLOR_PILL_ACTIVE : DESIGN_COLOR_PILL_IDLE;
    }

    const c = colors[activeIdx];
    if (hero && c) {
      hero.src = resolveDesignHeroUrl(product, c);
      hero.alt = `${safeText(product.name)} — ${c.label}`;
    }
  }

  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(i === 0));
    btn.dataset.colorId = c.id;
    btn.textContent = c.label;
    btn.className = i === 0 ? DESIGN_COLOR_PILL_ACTIVE : DESIGN_COLOR_PILL_IDLE;
    btn.addEventListener("click", () => applySelection(i));
    options.appendChild(btn);
  }

  applySelection(0);
}

function setBaseVisibility({ showMain, showDetail, showShipping, showDesign, showEmbroidery }) {
  const mainEl = document.getElementById("mainListing");
  const detailEl = document.getElementById("productDetail");
  const shipEl = document.getElementById("shipping-services");
  const designEl = document.getElementById("product-design");
  const embEl = document.getElementById("product-embroidery-step");

  if (mainEl) mainEl.classList.toggle("hidden", !showMain);
  if (detailEl) {
    detailEl.classList.toggle("hidden", !showDetail);
    detailEl.setAttribute("aria-hidden", String(!showDetail));
  }
  if (shipEl) {
    shipEl.classList.toggle("hidden", !showShipping);
    shipEl.setAttribute("aria-hidden", String(!showShipping));
  }
  if (designEl) {
    designEl.classList.toggle("hidden", !showDesign);
    designEl.setAttribute("aria-hidden", String(!showDesign));
  }
  if (embEl) {
    embEl.classList.toggle("hidden", !showEmbroidery);
    embEl.setAttribute("aria-hidden", String(!showEmbroidery));
  }
}

function populateProductDetail(product) {
  const gallery = getProductGallery(product);
  productDetailCarousel = { gallery, index: 0 };

  const titleEl = document.getElementById("productDetailTitle");
  if (titleEl) titleEl.textContent = safeText(product.name);

  const priceEl = document.getElementById("productDetailPrice");
  if (priceEl) {
    priceEl.textContent = `Giá sản phẩm: ${formatPriceDisplay(product.price)} (*)`;
  }

  const mainImg = document.getElementById("productDetailImage");
  if (mainImg && gallery.length) {
    mainImg.src = gallery[0];
    mainImg.alt = safeText(product.name);
  }

  const dots = document.getElementById("productDetailDots");
  if (dots) {
    if (gallery.length <= 1) {
      dots.innerHTML = "";
      dots.classList.add("hidden");
    } else {
      dots.classList.remove("hidden");
      renderDetailDots(dots, gallery.length, 0);
    }
  }

  const list = document.getElementById("productDetailBullets");
  if (list) {
    list.innerHTML = "";
    for (const line of getProductDetails(product)) {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    }
  }

  const isOut = isOutOfStock(product.status);
  const label = document.getElementById("btnStartDesignLabel");
  if (label) label.textContent = isOut ? "LIÊN HỆ SHOP" : "BẮT ĐẦU THIẾT KẾ";
}

function setDetailCarouselIndex(nextIndex) {
  if (!productDetailCarousel?.gallery?.length) return;

  const n = productDetailCarousel.gallery.length;
  const idx = Math.max(0, Math.min(nextIndex, n - 1));
  productDetailCarousel.index = idx;

  const mainImg = document.getElementById("productDetailImage");
  if (mainImg) mainImg.src = productDetailCarousel.gallery[idx];

  const dots = document.getElementById("productDetailDots");
  if (dots) renderDetailDots(dots, productDetailCarousel.gallery.length, idx);
}

function renderDetailDots(container, count, selectedIndex) {
  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const isActive = i === selectedIndex;
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Ảnh ${i + 1} trong ${count}`);
    if (isActive) dot.setAttribute("aria-current", "true");
    dot.className = isActive
      ? "h-2 w-2 rounded-full bg-black ring-2 ring-black ring-offset-2 ring-offset-headerTop transition"
      : "h-2 w-2 rounded-full bg-stone-300 transition hover:bg-stone-400";
    dot.addEventListener("click", () => setDetailCarouselIndex(i));
    container.appendChild(dot);
  }
}

function showProductDetail(product) {
  populateProductDetail(product);
  setBaseVisibility({
    showMain: false,
    showDetail: true,
    showShipping: false,
    showDesign: false,
    showEmbroidery: false,
  });
  window.scrollTo({ top: 0, behavior: "auto" });
  document.getElementById("btnCloseProductDetail")?.focus();
}

function showDefaultListingView() {
  productDetailCarousel = null;
  setBaseVisibility({
    showMain: true,
    showDetail: false,
    showShipping: false,
    showDesign: false,
    showEmbroidery: false,
  });
}

function showShippingServicesView() {
  productDetailCarousel = null;
  setBaseVisibility({
    showMain: false,
    showDetail: false,
    showShipping: true,
    showDesign: false,
    showEmbroidery: false,
  });
  window.scrollTo({ top: 0, behavior: "auto" });
  document.getElementById("btnCloseShipping")?.focus();
}

function populateDesignFlow(product) {
  const section = document.getElementById("product-design");
  if (section) section.dataset.productId = safeText(product.id);

  const titleEl = document.getElementById("designPageTitle");
  if (titleEl) titleEl.textContent = designFlowMainTitle(product);

  renderDesignColorOptions(product);
}

function showDesignFlowView(product) {
  productDetailCarousel = null;
  populateDesignFlow(product);
  setBaseVisibility({
    showMain: false,
    showDetail: false,
    showShipping: false,
    showDesign: true,
    showEmbroidery: false,
  });
  window.scrollTo({ top: 0, behavior: "auto" });
  document.getElementById("btnDesignNext")?.focus();
}

function populateEmbroideryStep(product) {
  resetEmbroideryEditorState();

  const sec = document.getElementById("product-embroidery-step");
  if (sec) sec.dataset.productId = safeText(product.id);

  const tit = document.getElementById("embroideryPageTitle");
  if (tit) tit.textContent = designFlowMainTitle(product);

  const url = getEmbroideryPreviewUrl(product);
  const preview = document.getElementById("embroideryPreviewImage");
  if (preview && url) {
    preview.src = url;
    preview.alt = safeText(product.name);
  }

  const hint = document.getElementById("embroideryInstructionLine");
  if (hint) hint.textContent = getEmbroideryHint(product);

  const inp = document.getElementById("embroideryTextInput");
  if (inp) inp.value = "";

  embroideryWireGlobalPointerHandlers();
  embroideryBindOverlayBackdrop();

  renderEmbroideryThreadGrid(product);
}

function showEmbroideryStepView(product) {
  productDetailCarousel = null;
  populateEmbroideryStep(product);
  setBaseVisibility({
    showMain: false,
    showDetail: false,
    showShipping: false,
    showDesign: false,
    showEmbroidery: true,
  });
  window.scrollTo({ top: 0, behavior: "auto" });
  document.getElementById("embroideryTextInput")?.focus();
}

function syncRouteFromHash() {
  const hash = location.hash;

  const emb = EMBROIDERY_HASH_RE.exec(hash);
  if (emb && productsCache.length) {
    const embId = decodeURIComponent(emb[1]);
    const embProduct = productsCache.find((x) => safeText(x.id) === embId);
    if (embProduct) {
      showEmbroideryStepView(embProduct);
      return;
    }
  }

  const d = DESIGN_HASH_RE.exec(hash);
  if (d && productsCache.length) {
    const designId = decodeURIComponent(d[1]);
    const designProduct = productsCache.find((x) => safeText(x.id) === designId);
    if (designProduct) {
      showDesignFlowView(designProduct);
      return;
    }
  }

  const m = PRODUCT_HASH_RE.exec(hash);
  if (m && productsCache.length) {
    const id = decodeURIComponent(m[1]);
    const product = productsCache.find((x) => safeText(x.id) === id);
    if (product) {
      showProductDetail(product);
      return;
    }
  }

  if (hash === HASH_SHIPPING_SERVICES) {
    showShippingServicesView();
    return;
  }

  showDefaultListingView();
}

function openProductDetailById(productId) {
  location.hash = `${PRODUCT_HASH_PREFIX}${encodeURIComponent(productId)}`;
}

function goToDesignFlowFromDetail() {
  const m = PRODUCT_HASH_RE.exec(location.hash);
  if (!m) return;

  const id = decodeURIComponent(m[1]);
  const product = productsCache.find((x) => safeText(x.id) === id);
  if (!product) return;

  if (isOutOfStock(product.status)) {
    openZalo();
    return;
  }

  location.hash = `${DESIGN_HASH_PREFIX}${encodeURIComponent(id)}`;
}

function designFlowGoBackToProduct() {
  const section = document.getElementById("product-design");
  const id = section ? safeText(section.dataset.productId) : "";
  if (!id) {
    location.hash = "#products";
    return;
  }
  location.hash = `${PRODUCT_HASH_PREFIX}${encodeURIComponent(id)}`;
}

function designFlowGoForwardToEmbroidery() {
  const section = document.getElementById("product-design");
  const id = section ? safeText(section.dataset.productId) : "";
  if (!id) return;
  persistDesignPreviewForEmbroidery(id);
  location.hash = `${EMBROIDERY_HASH_PREFIX}${encodeURIComponent(id)}`;
}

function embroideryGoBackToDesign() {
  const sec = document.getElementById("product-embroidery-step");
  const id = sec ? safeText(sec.dataset.productId) : "";
  if (!id) {
    location.hash = "#products";
    return;
  }
  location.hash = `${DESIGN_HASH_PREFIX}${encodeURIComponent(id)}`;
}

function closeProductDetail() {
  if (PRODUCT_HASH_RE.test(location.hash)) location.hash = "#products";
}

function closeShippingServices() {
  if (location.hash === HASH_SHIPPING_SERVICES) location.hash = "#products";
}

function renderProductCard(product) {
  const isOut = isOutOfStock(product.status);

  const wrap = document.createElement("article");
  wrap.className =
    "group flex cursor-pointer flex-col items-center rounded-xl outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-productInk/30 focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

  wrap.setAttribute("role", "button");
  wrap.setAttribute("tabindex", "0");
  wrap.dataset.productId = safeText(product.id);

  wrap.addEventListener("click", () => {
    openProductDetailById(product.id);
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openProductDetailById(product.id);
    }
  });

  const imgWrap = document.createElement("div");
  imgWrap.className =
    "w-full overflow-hidden rounded-3xl bg-stone-100/90 shadow-sm ring-1 ring-stone-200/80 pointer-events-none";

  const img = document.createElement("img");
  img.src = safeText(product.image_url);
  img.alt = safeText(product.name);
  img.loading = "lazy";
  img.className = "aspect-square w-full object-cover transition duration-300 group-hover:opacity-95 pointer-events-none";
  img.draggable = false;

  const title = document.createElement("h3");
  title.className =
    "pointer-events-none mt-4 w-full px-0.5 text-center text-sm font-bold leading-snug text-productInk md:text-[15px]";
  const name = safeText(product.name);
  title.textContent = isOut ? `[HẾT HÀNG] ${name}` : name;

  const price = document.createElement("p");
  price.className =
    "pointer-events-none mt-2 text-center text-sm font-normal text-productInk md:text-[15px]";
  price.textContent = formatPriceDisplay(product.price);

  imgWrap.appendChild(img);
  wrap.appendChild(imgWrap);
  wrap.appendChild(title);
  wrap.appendChild(price);

  return wrap;
}

function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  grid.innerHTML = "";

  if (!Array.isArray(products) || products.length === 0) {
    const empty = document.createElement("div");
    empty.className =
      "col-span-2 rounded-3xl bg-white/55 py-10 text-center text-sm text-navMuted md:col-span-4";
    empty.textContent = "Chưa có sản phẩm để hiển thị.";
    grid.appendChild(empty);
    return;
  }

  for (const p of products) {
    grid.appendChild(renderProductCard(p));
  }
}

async function loadProducts() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Dữ liệu không đúng định dạng mảng");
    return data;
  } catch (_) {
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }
}

function wireRoutes() {
  const btnClose = document.getElementById("btnCloseProductDetail");
  if (btnClose) btnClose.addEventListener("click", closeProductDetail);

  const btnDesign = document.getElementById("btnStartDesign");
  if (btnDesign) btnDesign.addEventListener("click", () => goToDesignFlowFromDetail());

  document.getElementById("btnDesignBack")?.addEventListener("click", designFlowGoBackToProduct);
  document.getElementById("btnDesignNext")?.addEventListener("click", () => designFlowGoForwardToEmbroidery());

  document.getElementById("btnEmbroideryBack")?.addEventListener("click", embroideryGoBackToDesign);
  document.getElementById("btnEmbroideryFinish")?.addEventListener("click", () => openZalo());

  document.getElementById("btnEmbroideryClearText")?.addEventListener("click", () => {
    const inp = document.getElementById("embroideryTextInput");
    if (inp) {
      inp.value = "";
      inp.focus();
    }
  });
  document.getElementById("btnEmbroideryAddText")?.addEventListener("click", () =>
    embroideryTryAddTextLayer(),
  );
  document.getElementById("btnEmbroideryAddIcon")?.addEventListener("click", () => {
    embroideryInitIconUi();
    openEmbIconModal();
  });

  document.getElementById("embroideryFontSelect")?.addEventListener("change", () => {
    syncSelectedLayerTypographyFromInputs();
    renderEmbroideryOverlayLayers();
  });
  document.getElementById("embroideryFontSize")?.addEventListener("change", () => {
    syncSelectedLayerTypographyFromInputs();
    renderEmbroideryOverlayLayers();
  });
  document.getElementById("embroideryFontSize")?.addEventListener("input", () => {
    syncSelectedLayerTypographyFromInputs();
    renderEmbroideryOverlayLayers();
  });

  document.getElementById("embroideryTextInput")?.addEventListener("input", () => {
    const msg = document.getElementById("embroideryTextValidation");
    if (msg) msg.textContent = "";
  });

  const btnShippingBack = document.getElementById("btnCloseShipping");
  if (btnShippingBack) btnShippingBack.addEventListener("click", closeShippingServices);

  window.addEventListener("hashchange", () => syncRouteFromHash());
}

function wireUI() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const btns = [
    document.getElementById("btnContactHeader"),
    document.getElementById("btnContactHero"),
    document.getElementById("btnContactFooter"),
  ].filter(Boolean);

  for (const b of btns) b.addEventListener("click", openZalo);

  const btnMenu = document.getElementById("btnMenu");
  const mobileNav = document.getElementById("mobileNav");

  if (btnMenu && mobileNav) {
    btnMenu.addEventListener("click", () => {
      const isHidden = mobileNav.classList.contains("hidden");
      mobileNav.classList.toggle("hidden", !isHidden);
      btnMenu.setAttribute("aria-expanded", String(isHidden));
    });

    mobileNav.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      mobileNav.classList.add("hidden");
      btnMenu.setAttribute("aria-expanded", "false");
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  wireUI();
  productsCache = await loadProducts();
  renderProducts(productsCache);
  wireRoutes();
  embroideryInitIconUi();
  syncRouteFromHash();
});
