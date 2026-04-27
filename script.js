const ZALO_URL = "https://zalo.me/sdt_cua_ban";
const DATA_URL = new URL("./data.json", window.location.href).toString();

function openZalo() {
  window.open(ZALO_URL, "_blank", "noopener,noreferrer");
}

function safeText(value) {
  return String(value ?? "");
}

function createStatusBadge(status) {
  const normalized = safeText(status).toLowerCase();
  const isOut = normalized.includes("hết");

  const badge = document.createElement("span");
  badge.className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1";

  if (isOut) {
    badge.classList.add("bg-black/5", "text-ink/70", "ring-black/10");
    badge.textContent = "Hết hàng";
  } else {
    badge.classList.add("bg-accent/25", "text-ink", "ring-accent/30");
    badge.textContent = "Còn hàng";
  }

  return { badge, isOut };
}

function renderProductCard(product) {
  const wrap = document.createElement("article");
  wrap.className =
    "group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-soft";

  const imgWrap = document.createElement("div");
  imgWrap.className = "relative overflow-hidden bg-base";

  const img = document.createElement("img");
  img.src = safeText(product.image_url);
  img.alt = safeText(product.name);
  img.loading = "lazy";
  img.className =
    "h-44 w-full object-cover transition duration-300 group-hover:scale-[1.03]";

  const content = document.createElement("div");
  content.className = "p-5";

  const title = document.createElement("h3");
  title.className = "text-sm font-semibold tracking-tight";
  title.textContent = safeText(product.name);

  const metaRow = document.createElement("div");
  metaRow.className = "mt-3 flex items-center justify-between gap-3";

  const price = document.createElement("p");
  price.className = "text-sm font-bold";
  price.textContent = safeText(product.price);

  const { badge, isOut } = createStatusBadge(product.status);

  metaRow.appendChild(price);
  metaRow.appendChild(badge);

  const actions = document.createElement("div");
  actions.className = "mt-4";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "w-full rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm ring-1 focus:outline-none focus:ring-2 focus:ring-accent/60";

  if (isOut) {
    btn.disabled = true;
    btn.classList.add("bg-black/5", "text-ink/60", "ring-black/10");
    btn.textContent = "Hết hàng";
  } else {
    btn.classList.add("bg-ink", "text-white", "ring-black/5", "hover:bg-ink/90");
    btn.textContent = "Liên hệ";
    btn.addEventListener("click", openZalo);
  }

  actions.appendChild(btn);

  imgWrap.appendChild(img);
  content.appendChild(title);
  content.appendChild(metaRow);
  content.appendChild(actions);

  wrap.appendChild(imgWrap);
  wrap.appendChild(content);

  return wrap;
}

function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  grid.innerHTML = "";

  if (!Array.isArray(products) || products.length === 0) {
    const empty = document.createElement("div");
    empty.className =
      "rounded-2xl bg-white p-6 text-sm text-ink/70 shadow-sm ring-1 ring-black/5 sm:col-span-2 lg:col-span-3 xl:col-span-4";
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
    // Fallback nếu bạn vẫn muốn nhúng data.js ở nơi khác
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }
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
  const products = await loadProducts();
  renderProducts(products);
});
