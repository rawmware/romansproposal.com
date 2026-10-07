/* Loads the Meta Pixel only when an ID is set in store-config.js. */
(function () {
  "use strict";
  var id = window.STORE_CONFIG && window.STORE_CONFIG.metaPixelId;
  window.track = function () {};
  if (!id) return;
  /* Standard Meta Pixel base code */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", id);
  window.fbq("track", "PageView");
  window.track = function (name, data, opts) { window.fbq("track", name, data || {}, opts || {}); };
})();
