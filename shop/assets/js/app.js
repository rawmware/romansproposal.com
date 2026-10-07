/* Northline Finds — cart + UI logic. Depends on catalog.js (window.CATALOG) and products.js (window.STORE_CONFIG). */
(function () {
  "use strict";
  var CART_KEY = "northline_cart_v1";
  var CATALOG = window.CATALOG || {};
  var CONFIG = window.STORE_CONFIG || { storeName: "Northline Finds", contactEmail: "roman.proposal@gmail.com", stripeLinks: {} };

  function money(n) { return "$" + Number(n).toFixed(2); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- cart state ---------- */
  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); }
  function cartCount() {
    var c = loadCart(), n = 0;
    for (var k in c) n += c[k];
    return n;
  }
  function cartTotal() {
    var c = loadCart(), t = 0;
    for (var id in c) { var p = CATALOG[id]; if (p) t += p.retail_price * c[id]; }
    return t;
  }
  function addToCart(id, qty) {
    qty = qty || 1;
    if (!CATALOG[id]) return;
    var c = loadCart();
    c[id] = (c[id] || 0) + qty;
    saveCart(c);
    updateBadge();
    renderDrawer();
    openDrawer();
    toast("Added to cart");
  }
  function setQty(id, qty) {
    var c = loadCart();
    if (qty <= 0) delete c[id]; else c[id] = qty;
    saveCart(c);
    updateBadge(); renderDrawer(); renderCartPage();
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  /* ---------- header badge ---------- */
  function updateBadge() {
    var els = document.querySelectorAll("[data-cart-count]");
    for (var i = 0; i < els.length; i++) els[i].textContent = cartCount();
  }

  /* ---------- drawer ---------- */
  function drawerEls() {
    return {
      overlay: document.getElementById("drawer-overlay"),
      drawer: document.getElementById("cart-drawer"),
      items: document.getElementById("drawer-items"),
      foot: document.getElementById("drawer-foot"),
      total: document.getElementById("drawer-total")
    };
  }
  function openDrawer() {
    var d = drawerEls();
    if (!d.drawer) return;
    d.overlay.classList.add("open");
    d.drawer.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    var d = drawerEls();
    if (!d.drawer) return;
    d.overlay.classList.remove("open");
    d.drawer.classList.remove("open");
    document.body.style.overflow = "";
  }
  function lineHtml(id, qty) {
    var p = CATALOG[id];
    if (!p) return "";
    return (
      '<div class="cart-line" data-id="' + esc(id) + '">' +
        '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
        '<div class="cart-line-info"><div class="t">' + esc(p.name) + '</div>' +
        '<div class="p">' + money(p.retail_price) + ' each</div>' +
        '<button class="rm" data-remove="' + esc(id) + '">remove</button></div>' +
        '<div class="qty"><button data-dec="' + esc(id) + '" aria-label="Decrease">−</button>' +
        '<span>' + qty + '</span>' +
        '<button data-inc="' + esc(id) + '" aria-label="Increase">+</button></div>' +
      '</div>'
    );
  }
  function renderDrawer() {
    var d = drawerEls();
    if (!d.items) return;
    var c = loadCart(), ids = Object.keys(c).filter(function (id) { return CATALOG[id]; });
    if (!ids.length) {
      d.items.innerHTML = '<div class="drawer-empty"><p><strong>Your cart is empty.</strong></p><p class="small">Browse the trending finds and add something you\u2019ll actually use.</p></div>';
      d.foot.style.display = "none";
      return;
    }
    d.items.innerHTML = ids.map(function (id) { return lineHtml(id, c[id]); }).join("");
    d.total.textContent = money(cartTotal());
    d.foot.style.display = "";
  }

  /* ---------- category filter (index) ---------- */
  function initFilter() {
    var pills = document.querySelectorAll(".pill");
    if (!pills.length) return;
    pills.forEach(function (pill) {
      pill.addEventListener("click", function () {
        pills.forEach(function (p) { p.classList.remove("active"); });
        pill.classList.add("active");
        var cat = pill.getAttribute("data-cat");
        document.querySelectorAll("[data-category]").forEach(function (card) {
          card.classList.toggle("hidden", cat !== "all" && card.getAttribute("data-category") !== cat);
        });
      });
    });
  }

  /* ---------- buy / checkout buttons ---------- */
  function stripeLinkFor(id) {
    var links = CONFIG.stripeLinks || {};
    return links[id] || "";
  }
  function checkoutHref(id) {
    var link = stripeLinkFor(id);
    if (link) return { href: link, external: true };
    var p = CATALOG[id] || {};
    var subject = encodeURIComponent("Order inquiry: " + (p.name || id));
    return { href: "mailto:" + CONFIG.contactEmail + "?subject=" + subject, external: false };
  }

  /* ---------- cart page ---------- */
  function renderCartPage() {
    var wrap = document.getElementById("cart-page-lines");
    if (!wrap) return;
    var c = loadCart(), ids = Object.keys(c).filter(function (id) { return CATALOG[id]; });
    var empty = document.getElementById("cart-empty");
    var list = document.getElementById("cart-list");
    if (!ids.length) {
      empty.classList.remove("hidden");
      list.classList.add("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.classList.remove("hidden");
    list.innerHTML = ids.map(function (id) {
      var p = CATALOG[id], q = c[id];
      var co = checkoutHref(id);
      var btn = co.external
        ? '<a class="btn btn-primary" href="' + esc(co.href) + '" target="_blank" rel="noopener">Pay ' + money(p.retail_price * q) + ' securely</a>'
        : '<a class="btn btn-outline" href="' + esc(co.href) + '">Email us to order</a>' +
          '<p class="small muted" style="margin:8px 0 0">Online checkout for this item opens soon — email us and we\u2019ll take care of your order.</p>';
      return (
        '<div class="checkout-line">' +
          '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' +
          '<div class="grow"><div style="font-weight:750">' + esc(p.name) + '</div>' +
          '<div class="small muted">Qty ' + q + ' × ' + money(p.retail_price) + ' = <strong>' + money(p.retail_price * q) + '</strong></div>' +
          '<div style="margin-top:6px"><button class="rm" data-remove="' + esc(id) + '">remove</button></div></div>' +
          '<div style="min-width:170px">' + btn + '</div>' +
        '</div>'
      );
    }).join("") +
    '<div class="order-summary"><div class="drawer-total"><span>Order total</span><span>' + money(cartTotal()) + '</span></div>' +
    '<p class="small muted" style="margin:10px 0 0">Shipping: free. Delivery in 7–12 business days with tracking. 30-day returns, no questions asked.</p></div>';
  }

  /* ---------- product page qty ---------- */
  function initProductPage() {
    var qtyVal = 1;
    var qtyEl = document.getElementById("qty-val");
    document.querySelectorAll("[data-qty]").forEach(function (b) {
      b.addEventListener("click", function () {
        qtyVal = Math.max(1, Math.min(99, qtyVal + parseInt(b.getAttribute("data-qty"), 10)));
        if (qtyEl) qtyEl.textContent = qtyVal;
      });
    });
    var addBtn = document.getElementById("add-to-cart");
    if (addBtn) addBtn.addEventListener("click", function () { addToCart(addBtn.getAttribute("data-id"), qtyVal); });
    var buyBtn = document.getElementById("buy-now");
    if (buyBtn) {
      var co = checkoutHref(buyBtn.getAttribute("data-id"));
      if (co.external) { buyBtn.setAttribute("href", co.href); buyBtn.setAttribute("target", "_blank"); buyBtn.setAttribute("rel", "noopener"); }
      else { buyBtn.setAttribute("href", co.href); buyBtn.textContent = "Email us to order"; }
    }
  }

  /* ---------- global click delegation ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target;
    var add = t.closest("[data-add]");
    if (add) { addToCart(add.getAttribute("data-add"), 1); return; }
    var inc = t.closest("[data-inc]");
    if (inc) { var c1 = loadCart(); setQty(inc.getAttribute("data-inc"), (c1[inc.getAttribute("data-inc")] || 0) + 1); return; }
    var dec = t.closest("[data-dec]");
    if (dec) { var c2 = loadCart(); setQty(dec.getAttribute("data-dec"), (c2[dec.getAttribute("data-dec")] || 0) - 1); return; }
    var rm = t.closest("[data-remove]");
    if (rm) { setQty(rm.getAttribute("data-remove"), 0); return; }
    if (t.closest("[data-open-cart]")) { renderDrawer(); openDrawer(); return; }
    if (t.closest("[data-close-cart]") || t.id === "drawer-overlay") { closeDrawer(); return; }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });

  document.addEventListener("DOMContentLoaded", function () {
    updateBadge();
    renderDrawer();
    renderCartPage();
    initFilter();
    initProductPage();
  });
})();
