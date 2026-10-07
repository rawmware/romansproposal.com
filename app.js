/* Roman's Proposal — storefront.
   Products come live from /api/products. Prices shown here are for display;
   the server recalculates everything at checkout. */
(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var money = function (cents) {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var track = function (name, data) { if (window.track) window.track(name, data); };

  var state = {
    products: [],
    collections: [],
    bundle: { minQty: 2, percentOff: 15 },
    delivery: { min: 3, max: 8 },
    category: "all",
    sort: "featured",
    current: null
  };

  var bundlePrice = function (cents) { return Math.round(cents * (1 - state.bundle.percentOff / 100)); };

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- Bag (saved on this device) ---------- */
  var BAG_KEY = "rp_bag_v1";
  var bag = [];
  try { bag = JSON.parse(localStorage.getItem(BAG_KEY) || "[]") || []; } catch (e) { bag = []; }
  function saveBag() {
    try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch (e) { /* private mode */ }
    renderBagCount();
  }
  var bagQty = function () { return bag.reduce(function (n, l) { return n + l.qty; }, 0); };
  function renderBagCount() {
    var n = bagQty(), el = $("#bag-count");
    el.textContent = n;
    el.hidden = n === 0;
  }
  function addToBag(line) {
    var existing = bag.find(function (l) { return l.vid === line.vid; });
    if (existing) existing.qty = Math.min(5, existing.qty + line.qty);
    else bag.push(line);
    saveBag();
  }

  /* ---------- Catalog ---------- */
  function loadCatalog() {
    return fetch("/api/products")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.products = data.products || [];
        state.collections = data.collections || [];
        if (data.bundle) state.bundle = data.bundle;
        if (data.delivery) state.delivery = data.delivery;
        renderChips();
        renderGrid();
      })
      .catch(function () {
        state.products = [];
        renderGrid();
      });
  }

  function renderChips() {
    var present = {};
    state.products.forEach(function (p) { present[p.category] = true; });
    var chips = [{ key: "all", label: "All deals" }].concat(
      state.collections.filter(function (c) { return present[c.key]; })
    );
    $("#chips").innerHTML = chips.map(function (c) {
      return '<button class="chip" role="tab" type="button" data-cat="' + esc(c.key) + '" aria-selected="' +
        (c.key === state.category) + '">' + esc(c.label) + "</button>";
    }).join("");
  }

  function visibleProducts() {
    var list = state.products.filter(function (p) { return state.category === "all" || p.category === state.category; });
    if (state.sort === "price") list = list.slice().sort(function (a, b) { return a.priceCents - b.priceCents; });
    return list;
  }

  function cardHTML(p) {
    var hot = p.stock != null && p.stock < 60
      ? '<span class="badge badge-hot">Only ' + p.stock + " left</span>"
      : p.priceCents < 1500 ? '<span class="badge badge-hot">Under $15</span>' : "<span></span>";
    return '<button class="card" type="button" data-id="' + esc(p.id) + '">' +
      '<div class="badges">' + hot + '<span class="badge badge-code">#' + esc(p.code) + "</span></div>" +
      '<img class="card-img" src="' + esc(p.image) + '" alt="" loading="lazy" decoding="async" width="400" height="400" />' +
      '<div class="card-body">' +
        '<span class="card-title">' + esc(p.title) + "</span>" +
        '<span class="card-price">' + money(p.priceCents) + "</span>" +
        '<span class="card-deal">2 for ' + money(bundlePrice(p.priceCents) * 2) + "</span>" +
        '<span class="card-meta">Free US shipping</span>' +
      "</div></button>";
  }

  function renderGrid() {
    var list = visibleProducts();
    var grid = $("#grid"), empty = $("#empty");
    if (state.products.length === 0) {
      grid.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = list.map(cardHTML).join("");
  }

  $("#chips").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-cat]");
    if (!btn) return;
    state.category = btn.getAttribute("data-cat");
    renderChips();
    renderGrid();
  });
  $("#sort").addEventListener("change", function (e) { state.sort = e.target.value; renderGrid(); });
  $("#grid").addEventListener("click", function (e) {
    var card = e.target.closest("[data-id]");
    if (card) openProduct(card.getAttribute("data-id"));
  });

  /* ---------- Item code search ---------- */
  function findByCode(code) {
    code = String(code || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
    return state.products.find(function (p) { return p.code === code; });
  }
  $("#code-search").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("#code-input"), msg = $("#code-msg");
    var p = findByCode(input.value);
    if (p) { msg.textContent = ""; openProduct(p.id); }
    else msg.textContent = input.value ? "No item with that code right now. It may have sold out." : "Type the code from the video.";
  });

  /* ---------- Product sheet ---------- */
  var sheet = $("#product-sheet");

  function setUrl(params) {
    try {
      var url = new URL(window.location.href);
      ["p", "i", "bag"].forEach(function (k) { url.searchParams.delete(k); });
      Object.keys(params || {}).forEach(function (k) { url.searchParams.set(k, params[k]); });
      history.replaceState(null, "", url.pathname + url.search);
    } catch (e) { /* old browsers */ }
  }

  function openProduct(id) {
    var listing = state.products.find(function (p) { return p.id === id; });
    state.current = { id: id, product: null, vid: null, qty: 1 };
    $("#ps-body").innerHTML = listing
      ? '<div class="ps"><div class="gallery"><img src="' + esc(listing.image) + '" alt="" /></div>' +
        "<div><h2 id=\"ps-title\">" + esc(listing.title) + '</h2><div class="ps-price"><strong>' + money(listing.priceCents) +
        "</strong></div><p class=\"card-meta\">Loading options…</p></div></div>"
      : '<p class="ps-error" id="ps-title">Loading…</p>';
    if (!sheet.open) sheet.showModal();
    setUrl({ p: id });

    fetch("/api/product?id=" + encodeURIComponent(id))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!state.current || state.current.id !== id) return;
        if (!res.ok) throw new Error(res.data.error || "Unavailable");
        var p = res.data;
        state.current.product = p;
        state.current.vid = p.variants[0].vid;
        renderProduct();
        track("ViewContent", { content_ids: [p.id], content_type: "product", content_name: p.title, value: p.fromPriceCents / 100, currency: "USD" });
      })
      .catch(function (err) {
        if (!state.current || state.current.id !== id) return;
        $("#ps-body").innerHTML = '<div class="ps-error"><h2 id="ps-title">' + esc(err.message || "This deal sold out.") +
          '</h2><p>Plenty more cheap finds below.</p><button class="btn btn-dark" type="button" data-close>See all deals</button></div>';
      });
  }

  function currentVariant() {
    var c = state.current;
    return c && c.product && c.product.variants.find(function (v) { return v.vid === c.vid; });
  }

  function renderProduct() {
    var c = state.current, p = c.product, v = currentVariant();
    var images = v && v.image && p.images.indexOf(v.image) === -1 ? [v.image].concat(p.images) : p.images;
    var multi = p.variants.length > 1;
    var low = v.stock != null && v.stock < 60 ? '<p class="ps-stock">Only ' + v.stock + " left in the US warehouse</p>" : "";
    $("#ps-body").innerHTML =
      '<div class="ps">' +
        "<div>" +
          '<div class="gallery">' + images.map(function (src) { return '<img src="' + esc(src) + '" alt="" loading="lazy" />'; }).join("") + "</div>" +
          (images.length > 1 ? '<p class="gallery-hint">Swipe for more photos (' + images.length + ")</p>" : "") +
        "</div>" +
        "<div>" +
          '<span class="ps-code">ITEM #' + esc(p.code) + "</span>" +
          '<h2 id="ps-title">' + esc(p.title) + "</h2>" +
          '<div class="ps-price"><strong>' + money(v.priceCents) + "</strong>" +
            '<span class="bundle">2+ for ' + money(bundlePrice(v.priceCents)) + " each</span></div>" +
          low +
          '<p class="ps-ship">✓ Free shipping · arrives in ' + state.delivery.min + "–" + state.delivery.max + " business days</p>" +
          (multi
            ? '<p class="opt-label">Option: ' + esc(v.name) + '</p><div class="variants">' +
              p.variants.map(function (x) {
                return '<button type="button" class="variant" data-vid="' + esc(x.vid) + '" aria-pressed="' + (x.vid === c.vid) + '">' + esc(x.name) + "</button>";
              }).join("") + "</div>"
            : "") +
          '<p class="opt-label">Quantity</p>' +
          '<div class="qty"><button type="button" data-qty="-1" aria-label="Less">−</button><output>' + c.qty + '</output><button type="button" data-qty="1" aria-label="More">+</button></div>' +
          '<div class="ps-actions">' +
            '<button class="btn btn-primary btn-block" type="button" data-buy>Buy now · ' + money(lineTotal(v.priceCents, c.qty)) + "</button>" +
            '<button class="btn btn-ghost btn-block" type="button" data-add>Add to bag</button>' +
            '<p class="form-error" id="ps-error" role="alert"></p>' +
          "</div>" +
          '<ul class="ps-perks"><li>🔒 Secure checkout with Stripe (Apple Pay, Google Pay, cards)</li>' +
          "<li>✅ Arrives damaged or wrong? Full refund</li><li>📦 Tracking for every order</li></ul>" +
          (p.description ? '<details class="ps-desc"><summary>Details</summary><p>' + esc(p.description) + "</p></details>" : "") +
          '<button class="share-link" type="button" data-share>Copy link to this item</button>' +
        "</div>" +
      "</div>";
  }

  function lineTotal(unitCents, qty) {
    var each = qty >= state.bundle.minQty ? bundlePrice(unitCents) : unitCents;
    return each * qty;
  }

  sheet.addEventListener("click", function (e) {
    if (e.target === sheet || e.target.closest("[data-close]")) { closeProduct(); return; }
    var c = state.current;
    if (!c || !c.product) return;
    var vbtn = e.target.closest("[data-vid]");
    if (vbtn) { c.vid = vbtn.getAttribute("data-vid"); renderProduct(); return; }
    var q = e.target.closest("[data-qty]");
    if (q) { c.qty = Math.max(1, Math.min(5, c.qty + Number(q.getAttribute("data-qty")))); renderProduct(); return; }
    if (e.target.closest("[data-add]")) {
      var v = currentVariant();
      addToBag({ id: c.product.id, vid: v.vid, qty: c.qty, title: c.product.title, variant: v.name, image: v.image || c.product.images[0], priceCents: v.priceCents });
      track("AddToCart", { content_ids: [c.product.id], content_type: "product", value: lineTotal(v.priceCents, c.qty) / 100, currency: "USD" });
      closeProduct();
      toast(bagQty() >= state.bundle.minQty ? "Added! " + state.bundle.percentOff + "% bundle discount unlocked 🎉" : "Added! Add 1 more to save " + state.bundle.percentOff + "%");
      return;
    }
    if (e.target.closest("[data-buy]")) {
      var cv = currentVariant();
      checkout([{ id: c.product.id, vid: cv.vid, qty: c.qty }], e.target.closest("[data-buy]"), $("#ps-error"), lineTotal(cv.priceCents, c.qty));
      return;
    }
    if (e.target.closest("[data-share]")) {
      var link = window.location.origin + "/?p=" + encodeURIComponent(c.product.id);
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
        .then(function () { toast("Link copied"); })
        .catch(function () { window.prompt("Copy this link:", link); });
    }
  });
  sheet.addEventListener("close", function () { state.current = null; setUrl({}); });
  function closeProduct() { if (sheet.open) sheet.close(); }

  /* ---------- Bag sheet ---------- */
  var bagSheet = $("#bag-sheet");
  function renderBag() {
    var lines = $("#bag-lines"), foot = $("#bag-foot");
    if (bag.length === 0) {
      lines.innerHTML = '<p class="bag-empty">Your bag is empty. Go grab a deal!</p>';
      foot.innerHTML = '<button class="btn btn-dark btn-block" type="button" data-close>Keep shopping</button>';
      return;
    }
    var qty = bagQty(), bundled = qty >= state.bundle.minQty;
    var full = 0, total = 0;
    lines.innerHTML = bag.map(function (l, i) {
      var each = bundled ? bundlePrice(l.priceCents) : l.priceCents;
      full += l.priceCents * l.qty;
      total += each * l.qty;
      return '<div class="bag-line"><img src="' + esc(l.image) + '" alt="" />' +
        '<div><div class="t">' + esc(l.title) + '</div><div class="v">' + (l.variant && l.variant !== "Standard" ? esc(l.variant) : "") + "</div>" +
        '<div class="qty"><button type="button" data-line="' + i + '" data-step="-1" aria-label="Less">−</button><output>' + l.qty +
        '</output><button type="button" data-line="' + i + '" data-step="1" aria-label="More">+</button></div></div>' +
        '<div class="p">' + money(each * l.qty) + "</div></div>";
    }).join("");
    foot.innerHTML =
      (bundled
        ? '<p class="bag-nudge ok">🎉 Bundle deal: ' + state.bundle.percentOff + "% off everything in your bag</p>"
        : '<p class="bag-nudge">Add 1 more item to save ' + state.bundle.percentOff + "% on everything</p>") +
      '<div class="bag-total"><span>Total</span><span>' + (bundled ? "<s>" + money(full) + "</s>" : "") + money(total) + "</span></div>" +
      '<p class="bag-note">Free US shipping. Any sales tax is shown at checkout.</p>' +
      '<button class="btn btn-primary btn-block" type="button" data-checkout>Checkout securely</button>' +
      '<p class="form-error" id="bag-error" role="alert"></p>';
    foot.dataset.total = total;
  }
  function openBag() { renderBag(); if (!bagSheet.open) bagSheet.showModal(); }
  $("#bag-open").addEventListener("click", openBag);
  bagSheet.addEventListener("click", function (e) {
    if (e.target === bagSheet || e.target.closest("[data-close]")) { bagSheet.close(); return; }
    var step = e.target.closest("[data-step]");
    if (step) {
      var i = Number(step.getAttribute("data-line")), line = bag[i];
      if (!line) return;
      line.qty = Math.min(5, line.qty + Number(step.getAttribute("data-step")));
      if (line.qty <= 0) bag.splice(i, 1);
      saveBag();
      renderBag();
      return;
    }
    var go = e.target.closest("[data-checkout]");
    if (go) {
      checkout(bag.map(function (l) { return { id: l.id, vid: l.vid, qty: l.qty }; }), go, $("#bag-error"), Number($("#bag-foot").dataset.total) || 0);
    }
  });

  /* ---------- Checkout ---------- */
  function checkout(items, button, errorEl, valueCents) {
    var label = button.textContent;
    button.disabled = true;
    button.textContent = "Opening secure checkout…";
    errorEl.textContent = "";
    track("InitiateCheckout", { value: valueCents / 100, currency: "USD", num_items: items.reduce(function (n, i) { return n + i.qty; }, 0) });
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.data.url) throw new Error(res.data.error || "Checkout hiccup. Please try again.");
        window.location.href = res.data.url;
      })
      .catch(function (err) {
        errorEl.textContent = err.message || "Checkout hiccup. Please try again.";
        button.disabled = false;
        button.textContent = label;
      });
  }

  /* ---------- Boot ---------- */
  $("#year").textContent = new Date().getFullYear();
  renderBagCount();
  var params = new URLSearchParams(window.location.search);
  loadCatalog().then(function () {
    var code = params.get("i");
    if (code) {
      var hit = findByCode(code);
      if (hit) openProduct(hit.id);
    }
  });
  if (params.get("p")) openProduct(params.get("p"));
  if (params.get("bag")) openBag();
})();
