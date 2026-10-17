/* 오프라인에서도 열리도록 앱 파일을 기기에 보관합니다. 업데이트는 온라인일 때 자동 반영됩니다. */
var V = "pmb-wg-v1";
var SHELL = ["./", "index.html", "config.js", "claude-shim.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var save = function (res) {
    var copy = res.clone();
    caches.open(V).then(function (c) { c.put(req, copy); }).catch(function () {});
    return res;
  };
  e.respondWith(
    fetch(req).then(save).catch(function () {
      return caches.match(req).then(function (r) {
        return r || caches.match("index.html");
      });
    })
  );
});
