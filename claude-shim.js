/* PMB Word Garden · 외부 호스팅용 어댑터
   Claude 안에서 열 때는 window.claude가 이미 있으므로 아무것도 하지 않습니다.
   Claude 밖(일반 웹/앱 설치)에서만 아래 기능을 대신 채워 줍니다.
   - downloads : PDF·카드 이미지·백업 파일을 브라우저 다운로드로 저장
   - sample    : config.js의 aiEndpoint가 있을 때만 AI 기능 사용 (없으면 안내 문구)
   - db / user : config.js의 backendUrl이 있으면 backend/worker.js(D1)로 온라인 계정 저장.
                 주소 뒤에 #owner=열쇠 를 한 번 붙여 열면 이 기기가 선생님 기기로 기억돼요.
                 backendUrl이 없거나 응답하지 않으면 이 기기 전용 계정으로 동작해요. */
(function () {
  if (window.claude) return;
  var CFG = window.PMB_CONFIG || {};

  function toDataUrl(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  /* 선생님 열쇠: 주소 뒤 #owner=... 로 한 번 열면 기억하고, 주소에서는 지워요 */
  try {
    var om = /[#&]owner=([^&]+)/.exec(location.hash);
    if (om) {
      localStorage.setItem("pmb-wg-owner", decodeURIComponent(om[1]));
      history.replaceState(null, "", location.pathname + location.search);
    }
  } catch (e) {}
  function ownerKey() { try { return localStorage.getItem("pmb-wg-owner") || ""; } catch (e) { return ""; } }

  var BACKEND = CFG.backendUrl || "";
  var dbPing = null;
  function backendCall(payload) {
    var headers = { "content-type": "application/json" };
    var k = ownerKey();
    if (k) headers["x-owner"] = k;
    return fetch(BACKEND, { method: "POST", headers: headers, body: JSON.stringify(payload) }).then(async function (res) {
      var j = {};
      try { j = await res.json(); } catch (e) {}
      if (!res.ok) { var err = new Error(j.code || "unavailable"); err.code = j.code || "unavailable"; throw err; }
      return j;
    });
  }
  function makeDb() {
    return {
      doc: function (path) {
        return {
          get: async function () {
            var r = await backendCall({ op: "get", path: path });
            return { exists: !!r.exists, data: function () { return r.data; } };
          },
          set: async function (d) { await backendCall({ op: "set", path: path, data: d }); },
          update: async function (d) { await backendCall({ op: "update", path: path, data: d }); },
          delete: async function () { await backendCall({ op: "delete", path: path }); },
          acquire: async function (o) {
            var r = await backendCall({ op: "acquire", path: path, holder: o.holder, ttlMs: o.ttlMs });
            return { acquired: !!r.acquired };
          }
        };
      },
      collection: function (name) {
        return {
          get: async function () {
            var r = await backendCall({ op: "list", collection: name });
            return { docs: r.docs.map(function (d) { return { id: d.id, data: function () { return d.data; } }; }) };
          }
        };
      }
    };
  }
  var dbObj = null;
  async function getDb() {
    if (!BACKEND) return null;
    if (dbPing === null) {
      dbPing = backendCall({ op: "ping" }).then(function () { return true; }, function () { return false; });
    }
    if (!(await dbPing)) return null;
    if (!dbObj) dbObj = makeDb();
    return dbObj;
  }
  var user = {
    can: async function () { return true; },
    isOwner: async function () { return !!ownerKey(); },
    canEdit: async function () { return !!ownerKey(); }
  };

  var downloads = {
    save: async function (opt) {
      var data = opt.data;
      var blob = data instanceof Blob ? data
        : new Blob([data], { type: typeof data === "string" ? "application/json" : "application/octet-stream" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = opt.filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return { ok: true };
    }
  };

  var ai = CFG.aiEndpoint ? {
    limits: async function () { return { images: CFG.aiImages !== false }; },
    json: async function (prompt, opts) {
      opts = opts || {};
      var body = { prompt: prompt, tier: opts.modelTier || "default", images: [] };
      var imgs = opts.images || [];
      for (var i = 0; i < imgs.length; i++) {
        var im = imgs[i];
        body.images.push(im instanceof Blob ? await toDataUrl(im) : String(im));
      }
      var res = await fetch(CFG.aiEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("ai " + res.status);
      return await res.json();
    }
  } : null;

  window.claude = {
    use: async function (name) {
      if (name === "downloads") return downloads;
      if (name === "sample") return ai;
      if (name === "user") return user;
      if (name === "db") return await getDb();
      return null;
    }
  };
})();
