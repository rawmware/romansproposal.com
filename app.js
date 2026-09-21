/* Roman's Proposal — app.js
   EDIT YOUR NUMBERS HERE: prices, contact email, timelines. Everything else just works. */
(function () {
  "use strict";

  var CONFIG = {
    contactEmail: "roman.proposal@gmail.com", // Roman's inbox
    prices: {
      website:  { label: "New website",                 from: 1200 },
      "ai-chat": { label: "AI chat assistant",          from: 900  },
      "lead-auto": { label: "Lead follow-up automation", from: 700 },
      booking:  { label: "Booking & intake system",     from: 600  },
      crm:      { label: "CRM integration",             from: 500  }
    },
    timelineByScope: [
      { max: 1, text: "about 1 week" },
      { max: 3, text: "about 2 weeks" },
      { max: 99, text: "2–3 weeks" }
    ],
    rushNote: "Rush available — tell me your deadline and I'll confirm."
  };

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Mobile nav ---------- */
  var navToggle = $("#nav-toggle"), nav = $("#site-nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    $$("a", nav).forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && !reducedMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Hero terminal ---------- */
  var term = $("#terminal-body");
  var script = [
    { t: "$ whoami", d: 700 },
    { t: "roman — I build software for local business", cls: "dim", d: 900 },
    { t: "$ deploy client-site", d: 700 },
    { t: "✓ Live in 38s — loads in under a second", cls: "ok", d: 900 },
    { t: "$ ai-assistant --train \"your business\"", d: 700 },
    { t: "✓ Answering clients 24/7, booking while you sleep", cls: "ok", d: 900 },
    { t: "$ automate leads --follow-up instant", d: 700 },
    { t: "✓ 142 follow-ups sent. Zero leads lost.", cls: "ok", d: 1400 }
  ];
  function runTerminal() {
    if (!term) return;
    if (reducedMotion) {
      term.innerHTML = script.map(function (s) {
        return '<div class="' + (s.cls || (s.t[0] === "$" ? "cmd" : "")) + '">' + s.t + "</div>";
      }).join("");
      return;
    }
    var i = 0;
    function next() {
      if (i >= script.length) { setTimeout(function () { term.innerHTML = ""; i = 0; next(); }, 2600); return; }
      var s = script[i++];
      var line = document.createElement("div");
      line.className = (s.cls || (s.t.charAt(0) === "$" ? "cmd" : "")) + (s.t.charAt(0) === "$" ? " caret" : "");
      term.appendChild(line);
      var chars = s.t.split(""), c = 0;
      var speed = s.t.charAt(0) === "$" ? 34 : 12;
      (function type() {
        if (c < chars.length) { line.textContent += chars[c++]; setTimeout(type, speed); }
        else { line.classList.remove("caret"); setTimeout(next, s.d); }
      })();
    }
    next();
  }
  runTerminal();

  /* ---------- Proposal builder ---------- */
  var builder = $("#builder");
  if (builder) {
    var state = { biz: null, needs: [], time: null };
    var tabs = $$(".builder-tab", builder);
    var panels = $$(".builder-panel", builder);

    function goStep(n) {
      tabs.forEach(function (t) {
        var active = t.getAttribute("data-step") === String(n);
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach(function (p) {
        p.classList.toggle("is-active", p.getAttribute("data-panel") === String(n));
      });
      if (n === 4) renderProposal();
      builder.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        var n = parseInt(t.getAttribute("data-step"), 10);
        if (n === 2 && !state.biz) return;
        if (n === 3 && state.needs.length === 0) return;
        if (n === 4 && (!state.biz || state.needs.length === 0 || !state.time)) return;
        goStep(n);
      });
    });

    // Step 1: business
    $$("#biz-choices .choice").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$("#biz-choices .choice").forEach(function (b) { b.classList.remove("is-selected"); });
        btn.classList.add("is-selected");
        state.biz = btn.getAttribute("data-biz");
        setTimeout(function () { goStep(2); }, 220);
      });
    });

    // Step 2: needs (multi)
    var needsNext = $("#needs-next");
    $$("#need-choices .choice").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var need = btn.getAttribute("data-need");
        var idx = state.needs.indexOf(need);
        if (idx > -1) {
          state.needs.splice(idx, 1);
          btn.classList.remove("is-selected");
          btn.setAttribute("aria-pressed", "false");
        } else {
          state.needs.push(need);
          btn.classList.add("is-selected");
          btn.setAttribute("aria-pressed", "true");
        }
        needsNext.disabled = state.needs.length === 0;
      });
    });
    $$("[data-next]", builder).forEach(function (b) {
      b.addEventListener("click", function () { goStep(parseInt(b.getAttribute("data-next"), 10)); });
    });
    $$("[data-back]", builder).forEach(function (b) {
      b.addEventListener("click", function () { goStep(parseInt(b.getAttribute("data-back"), 10)); });
    });

    // Step 3: timeline
    $$("#time-choices .choice").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$("#time-choices .choice").forEach(function (b) { b.classList.remove("is-selected"); });
        btn.classList.add("is-selected");
        state.time = btn.getAttribute("data-time");
        setTimeout(function () { goStep(4); }, 220);
      });
    });

    $("#proposal-restart").addEventListener("click", function () {
      state = { biz: null, needs: [], time: null };
      $$(".choice.is-selected", builder).forEach(function (b) {
        b.classList.remove("is-selected");
        b.setAttribute("aria-pressed", "false");
      });
      needsNext.disabled = true;
      goStep(1);
    });

    var bizLabels = {
      "real-estate": "Real estate",
      "law-firm": "Law firm",
      "contractor": "Contractor / home services",
      "other": "Local business"
    };
    var timeLabels = { asap: "ASAP", month: "2–4 weeks", exploring: "Exploring" };

    function money(n) { return "$" + n.toLocaleString("en-US"); }

    function renderProposal() {
      var out = $("#proposal-output");
      var total = 0, lines = "";
      state.needs.forEach(function (need) {
        var p = CONFIG.prices[need];
        total += p.from;
        lines += '<div class="proposal-line"><span>' + p.label + '</span><span>from ' + money(p.from) + '</span></div>';
      });
      var timeline = CONFIG.timelineByScope[0].text;
      CONFIG.timelineByScope.forEach(function (t) {
        if (state.needs.length <= t.max) { timeline = t.text; return; }
      });
      var rush = state.time === "asap" ? "<p class=\"proposal-meta\">" + CONFIG.rushNote + "</p>" : "";
      out.innerHTML =
        '<div class="proposal-line"><span>Business type</span><span>' + bizLabels[state.biz] + '</span></div>' +
        lines +
        '<div class="proposal-total"><span>Estimated investment</span><span>from ' + money(total) + '</span></div>' +
        '<p class="proposal-meta">Typical timeline: <strong>' + timeline + '</strong> &middot; Preferred start: ' + timeLabels[state.time] + '<br>' +
        'Fixed quote confirmed before any work begins. You own 100% of the code.</p>' + rush;

      var body = "Hi Roman,%0D%0A%0D%0AHere's my proposal-builder estimate:%0D%0A" +
        "- Business: " + encodeURIComponent(bizLabels[state.biz]) + "%0D%0A" +
        state.needs.map(function (n) { return "- " + encodeURIComponent(CONFIG.prices[n].label) + " (from " + money(CONFIG.prices[n].from) + ")"; }).join("%0D%0A") + "%0D%0A" +
        "- Estimated total: from " + money(total) + "%0D%0A" +
        "- Timeline: " + encodeURIComponent(timeline) + "%0D%0A" +
        "- Start: " + encodeURIComponent(timeLabels[state.time]) + "%0D%0A%0D%0A" +
        "Name:%0D%0ABusiness:%0D%0APhone:%0D%0A";
      $("#proposal-send").href = "mailto:" + CONFIG.contactEmail +
        "?subject=" + encodeURIComponent("Proposal request — " + bizLabels[state.biz]) + "&body=" + body;
    }
  }

  /* ---------- Contact form → email ---------- */
  var form = $("#contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim(),
          business = form.business.value.trim(),
          contact = form.contact.value.trim(),
          message = form.message.value.trim();
      var body = encodeURIComponent(
        "Name: " + name + "\n" +
        "Business: " + business + "\n" +
        "Contact: " + contact + "\n\n" + message
      );
      window.location.href = "mailto:" + CONFIG.contactEmail +
        "?subject=" + encodeURIComponent("New inquiry from " + (business || name)) + "&body=" + body;
    });
  }

  /* ---------- Misc ---------- */
  var emailLink = $("#contact-email");
  if (emailLink) {
    emailLink.href = "mailto:" + CONFIG.contactEmail;
    emailLink.textContent = CONFIG.contactEmail;
  }
  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
