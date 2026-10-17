/* PMB Word Garden · 온라인 계정·데이터 저장소 (Cloudflare Worker + D1, 무료)
   Claude의 db·user 기능을 대신합니다. 앱 코드는 바꾸지 않아요.
   설정:
   - D1 데이터베이스를 만들고 이 Worker에 바인딩 이름을 DB로 연결
   - ALLOW_ORIGIN : 앱 주소 (예: https://pmb-word-garden.pages.dev)
   - OWNER_KEY    : 선생님 전용 열쇠 (Secret). 회원 목록은 이 열쇠가 있어야만 볼 수 있어요. */

var COLS = ["acct", "st", "codes", "em"];
var ID_RE = /^[A-Za-z0-9_-]{1,120}$/;
var MAX_BODY = 256 * 1024;
var ready = null;

class HttpErr extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function ensure(db) {
  if (!ready) {
    ready = (async function () {
      await db.prepare("CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, col TEXT NOT NULL, body TEXT NOT NULL, upd INTEGER NOT NULL)").run();
      await db.prepare("CREATE INDEX IF NOT EXISTS docs_col ON docs(col)").run();
      await db.prepare("CREATE TABLE IF NOT EXISTS leases (path TEXT PRIMARY KEY, holder TEXT NOT NULL, exp INTEGER NOT NULL)").run();
    })().catch(function (e) { ready = null; throw e; });
  }
  return ready;
}

function parsePath(p) {
  var parts = String(p || "").split("/");
  if (parts.length !== 2 || COLS.indexOf(parts[0]) < 0 || !ID_RE.test(parts[1])) throw new HttpErr(400, "invalid_argument");
  return parts.join("/");
}

function checkData(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new HttpErr(400, "invalid_argument");
  if (JSON.stringify(d).length > MAX_BODY) throw new HttpErr(400, "invalid_argument");
  return JSON.stringify(d);
}

async function handle(db, body, owner) {
  var op = body.op;
  if (op === "ping") return { ok: true };
  if (op === "list") {
    if (body.collection !== "acct") throw new HttpErr(400, "invalid_argument");
    if (!owner) throw new HttpErr(403, "forbidden");
    var rs = await db.prepare("SELECT path, body FROM docs WHERE col = ? LIMIT 1000").bind("acct").all();
    return { docs: rs.results.map(function (r) { return { id: r.path.split("/")[1], data: JSON.parse(r.body) }; }) };
  }
  var path = parsePath(body.path);
  if (op === "get") {
    var r = await db.prepare("SELECT body FROM docs WHERE path = ?").bind(path).first();
    return r ? { exists: true, data: JSON.parse(r.body) } : { exists: false, data: null };
  }
  if (op === "set") {
    var js = checkData(body.data);
    await db.prepare("INSERT INTO docs (path, col, body, upd) VALUES (?,?,?,?) ON CONFLICT(path) DO UPDATE SET body = excluded.body, upd = excluded.upd")
      .bind(path, path.split("/")[0], js, Date.now()).run();
    return { ok: true };
  }
  if (op === "update") {
    var patch = checkData(body.data);
    var u = await db.prepare("UPDATE docs SET body = json_patch(body, ?), upd = ? WHERE path = ?").bind(patch, Date.now(), path).run();
    if (!u.meta || u.meta.changes === 0) throw new HttpErr(404, "not_found");
    return { ok: true };
  }
  if (op === "delete") {
    await db.prepare("DELETE FROM docs WHERE path = ?").bind(path).run();
    return { ok: true };
  }
  if (op === "acquire") {
    var holder = String(body.holder || "").slice(0, 64);
    if (!holder) throw new HttpErr(400, "invalid_argument");
    var now = Date.now();
    var ttl = Math.min(Math.max(Number(body.ttlMs) || 4000, 1000), 60000);
    var a = await db.prepare("INSERT INTO leases (path, holder, exp) VALUES (?,?,?) ON CONFLICT(path) DO UPDATE SET holder = excluded.holder, exp = excluded.exp WHERE leases.exp < ? OR leases.holder = excluded.holder")
      .bind(path, holder, now + ttl, now).run();
    return { acquired: !!(a.meta && a.meta.changes > 0) };
  }
  throw new HttpErr(400, "invalid_argument");
}

export default {
  async fetch(request, env) {
    var cors = {
      "access-control-allow-origin": env.ALLOW_ORIGIN || "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-owner"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers: cors });
    var status = 200, out;
    try {
      var body;
      try { body = await request.json(); } catch (e) { throw new HttpErr(400, "invalid_argument"); }
      var owner = !!env.OWNER_KEY && request.headers.get("x-owner") === env.OWNER_KEY;
      await ensure(env.DB);
      out = await handle(env.DB, body, owner);
    } catch (e) {
      status = e.status || 503;
      out = { code: e.code || "unavailable" };
    }
    return new Response(JSON.stringify(out), {
      status: status,
      headers: Object.assign({ "content-type": "application/json" }, cors)
    });
  }
};
