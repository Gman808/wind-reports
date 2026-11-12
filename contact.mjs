// Contact form page. The message is posted to this same URL and worker.mjs emails it to an address kept only in a Worker
// secret (CONTACT_TO), so the address is not in this code, the repository or any page.
import { layout } from "./pages.mjs";
import { setLang } from "./i18n.mjs";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const TEXT = {
  en: {
    title: "Contact", intro: "Send a message about the wind report. Your email address is used only to reply.",
    name: "Your name", email: "Your email", message: "Message", send: "Send", sending: "Sending…",
    sent: "Thank you. Your message was sent.", failed: "Sorry, the message could not be sent. Please try again later.",
    wait: "Please wait a minute before sending another message.", invalid: "Please fill in every field with a valid email address.",
  },
  fr: {
    title: "Nous joindre", intro: "Envoyez un message au sujet du rapport des vents. Votre adresse courriel sert uniquement à vous répondre.",
    name: "Votre nom", email: "Votre courriel", message: "Message", send: "Envoyer", sending: "Envoi…",
    sent: "Merci. Votre message a été envoyé.", failed: "Désolé, le message n'a pas pu être envoyé. Veuillez réessayer plus tard.",
    wait: "Veuillez attendre une minute avant d'envoyer un autre message.", invalid: "Veuillez remplir chaque champ avec une adresse courriel valide.",
  },
};

// status: undefined, or "sent" / "failed" / "wait" / "invalid" (shown when the form was posted without JavaScript).
export function contactPage(ctx, status) {
  const { lang, href } = ctx;
  setLang(lang);
  const T = TEXT[lang];
  const body = `
<div class="page">
<style>
.contact{display:grid;gap:.9rem;max-width:36rem}
.contact label{display:grid;gap:.25rem;font-weight:600}
.contact input,.contact textarea{font:inherit;padding:.5rem .6rem;border:1px solid var(--line-strong);border-radius:8px;background:var(--bg);color:var(--text)}
.contact textarea{min-height:9rem;resize:vertical}
.contact .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.contact button{justify-self:start}
#c-status{min-height:1.5rem;font-weight:600;margin:0}
</style>
<h2>${esc(T.title)}</h2>
<p>${esc(T.intro)}</p>
<form class="contact" id="contact" method="post" action="${esc(href("contact", lang))}">
<label>${esc(T.name)}<input name="name" required maxlength="100" autocomplete="name"></label>
<label>${esc(T.email)}<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
<label>${esc(T.message)}<textarea name="message" required minlength="5" maxlength="4000"></textarea></label>
<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
<button class="btn" type="submit">${esc(T.send)}</button>
<p id="c-status" role="status">${status ? esc(T[status] ?? "") : ""}</p>
</form>
</div>`;
  const script = `
(function(){var f=document.getElementById("contact"),s=document.getElementById("c-status"),T=${JSON.stringify(T)};
f.addEventListener("submit",function(e){e.preventDefault();var b=f.querySelector("button");b.disabled=true;s.textContent=T.sending;
fetch(f.action,{method:"POST",body:new FormData(f),headers:{Accept:"application/json"}}).then(function(r){return r.json()}).then(function(j){
s.textContent=T[j.status]||T.failed;if(j.status==="sent")f.reset()}).catch(function(){s.textContent=T.failed}).then(function(){b.disabled=false})})})();`;
  return layout({ ctx, title: T.title, body, extraScript: script });
}

// Handles POST /contact. Returns { status }: "sent", "failed", "wait" or "invalid".
// Needs the secrets RESEND_API_KEY, EMAIL_FROM and CONTACT_TO (the address that receives the messages).
export async function handleContact(request, env, origin) {
  if (request.headers.get("origin") !== origin) return { status: "failed" };
  let form;
  try { form = await request.formData(); } catch { return { status: "invalid" }; }
  const field = (k, max) => String(form.get(k) ?? "").trim().slice(0, max);
  if (field("website", 200)) return { status: "sent" }; // honeypot: a bot filled the hidden field; pretend it worked
  const name = field("name", 100).replace(/[\r\n]+/g, " "), email = field("email", 200), message = field("message", 4000);
  if (!name || message.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "invalid" };
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !env.CONTACT_TO) return { status: "failed" };

  // One message per visitor per minute. Only a hash of the address is kept, and it expires by itself.
  if (env.WEATHER) {
    const ip = request.headers.get("cf-connecting-ip") ?? "";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`contact:${ip}`));
    const key = "rl:" + [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (await env.WEATHER.get(key)) return { status: "wait" };
    await env.WEATHER.put(key, "1", { expirationTtl: 60 });
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM, to: [env.CONTACT_TO], reply_to: email,
      subject: `Wind Report message from ${name}`, text: `From: ${name} <${email}>\n\n${message}`,
    }),
  });
  if (!res.ok) console.log(`Contact email failed: HTTP ${res.status} ${await res.text()}`);
  return { status: res.ok ? "sent" : "failed" };
}
