// Durable Object that logs one Tempest station's rapid wind (about every 3 s) into SQLite while a session is on.
// A session is started for a number of hours (default 4); the Object keeps an outbound WebSocket to WeatherFlow open
// and an alarm every 30 s reconnects it if it dropped and ends the session when the time is up.
import { DurableObject } from "cloudflare:workers";
import { csv, parseRapid, tempestDevice } from "./logger-core.mjs";

const KEEP_MS = 7 * 24 * 3600_000; // readings older than this are deleted
const CHECK_MS = 30_000;

export class WindLogger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ws = null;
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS obs (t INTEGER PRIMARY KEY, speed REAL, dir REAL)");
  }

  async status() {
    const s = (await this.ctx.storage.get("session")) ?? null;
    const n = this.ctx.storage.sql.exec("SELECT COUNT(*) AS n, MIN(t) AS first, MAX(t) AS last FROM obs").one();
    return { session: s, running: !!s && s.until > Date.now(), connected: !!this.ws, readings: n.n, first: n.first, last: n.last };
  }

  async start(hours = 4) {
    const device = await this.device();
    const until = Date.now() + Math.min(Math.max(hours, 0.1), 24) * 3600_000;
    await this.ctx.storage.put("session", { device, from: Date.now(), until });
    await this.ctx.storage.setAlarm(Date.now() + 1000);
    return this.status();
  }

  async stop() {
    await this.ctx.storage.delete("session");
    await this.ctx.storage.deleteAlarm();
    this.close();
    return this.status();
  }

  // Readings from the last `hours` hours, oldest first.
  obs(hours = 4) {
    return this.ctx.storage.sql.exec("SELECT t, speed, dir FROM obs WHERE t >= ? ORDER BY t", Date.now() - hours * 3600_000).toArray();
  }

  async csv(hours = 4) {
    return csv(this.obs(hours));
  }

  async device() {
    if (this.env.LOGGER_DEVICE_ID) return Number(this.env.LOGGER_DEVICE_ID);
    const res = await fetch(`https://swd.weatherflow.com/swd/rest/stations/${this.env.LOGGER_STATION_ID}?token=${this.env.TEMPEST_TOKEN}`);
    if (!res.ok) throw new Error(`Tempest station lookup failed: HTTP ${res.status}`);
    const id = tempestDevice(await res.json());
    if (!id) throw new Error("No Tempest (ST) device found on that station");
    return id;
  }

  close() {
    try { this.ws?.close(1000, "done"); } catch {}
    this.ws = null;
  }

  async connect(device) {
    const res = await fetch(`https://ws.weatherflow.com/swd/data?token=${this.env.TEMPEST_TOKEN}`, { headers: { Upgrade: "websocket" } });
    const ws = res.webSocket;
    if (!ws) throw new Error(`WebSocket upgrade failed: HTTP ${res.status}`);
    ws.accept();
    ws.addEventListener("message", (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      const o = parseRapid(m);
      if (o) this.ctx.storage.sql.exec("INSERT OR REPLACE INTO obs (t, speed, dir) VALUES (?, ?, ?)", o.t, o.speed, o.dir);
    });
    const dropped = () => { if (this.ws === ws) this.ws = null; };
    ws.addEventListener("close", dropped);
    ws.addEventListener("error", dropped);
    ws.send(JSON.stringify({ type: "listen_rapid_start", device_id: device, id: "rapid-" + Date.now() }));
    this.ws = ws;
  }

  // Runs every 30 s while a session is on.
  async alarm() {
    const s = await this.ctx.storage.get("session");
    this.ctx.storage.sql.exec("DELETE FROM obs WHERE t < ?", Date.now() - KEEP_MS);
    if (!s || s.until <= Date.now()) {
      await this.stop();
      return;
    }
    if (!this.ws) {
      try { await this.connect(s.device); } catch (e) { console.log("logger connect failed:", e.message); }
    }
    await this.ctx.storage.setAlarm(Date.now() + CHECK_MS);
  }
}
