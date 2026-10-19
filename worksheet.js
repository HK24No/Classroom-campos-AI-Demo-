// worksheet.js — Worksheet Maker: improved prompt → structured worksheet JSON →
// print-ready pages + fillable Google Doc (.docx) + answer key + Classroom post.
(function () {
  const { $, $$, esc, inline, mdToHtml, callAI, copyText, download, saveEntry, showView, caChip, fmtDate } = window.CC;
  let WS = null;          // current worksheet JSON
  let WS_INPUT = null;    // the form snapshot used to make it
  let WS_SYSTEM = "";

  // ---------- year-plan picker ----------
  (function fillPick() {
    let html = `<option value="">— Pick a session to pre-fill —</option>`;
    ["K-2", "3-5"].forEach(b => {
      html += `<optgroup label="${b} year plan">` + YEAR_PLAN[b].map((p, i) => `<option value="plan:${b}:${i}">${b} · ${p.month} — ${esc(p.focus)}</option>`).join("") + "</optgroup>";
    });
    html += `<optgroup label="Teaching-history topics">` + TOPICS.map(t => `<option value="topic:${t.id}">${t.icon} ${esc(t.title)}</option>`).join("") + "</optgroup>";
    $("#wFromPlan").innerHTML = html;
  })();
  let wsCtx = { topicIds: [], ca: [] };
  function applyPick(v) {
    if (!v) { wsCtx = { topicIds: [], ca: [] }; return; }
    const parts = v.split(":");
    if (parts[0] === "plan") {
      const p = YEAR_PLAN[parts[1]][+parts[2]];
      if (bandOf($("#wGrade").value) !== parts[1]) $("#wGrade").value = parts[1] === "K-2" ? "Grade 1" : "Grade 3";
      $("#wTopic").value = p.focus.replace(/\s*\(.*?\)\s*/g, " ").trim();
      $("#wNotes").value = p.activities.join("; ");
      wsCtx = { topicIds: p.topics, ca: p.ca };
    } else {
      const t = TOPICS.find(x => x.id === parts[1]);
      if (t.gradeOnly) $("#wGrade").value = t.gradeOnly;
      const band = bandOf($("#wGrade").value);
      $("#wTopic").value = t.title;
      $("#wNotes").value = (t.activities[band] || "") + (t.vocab ? ". Key words: " + t.vocab.join(", ") : "");
      wsCtx = { topicIds: [t.id], ca: [] };
    }
    updatePromptPeek();
  }
  $("#wFromPlan").addEventListener("change", e => applyPick(e.target.value));
  // "Make a worksheet" buttons in the Library
  ["#libraryList", "#topicLibrary"].forEach(sel => $(sel).addEventListener("click", e => {
    const v = e.target.dataset.ws; if (!v) return;
    $("#wFromPlan").value = v; applyPick(v); showView("worksheet");
  }));

  // ---------- form snapshot + improved prompt ----------
  const checked = id => $$(`#${id} input:checked`).map(i => i.value);
  function snapshot() {
    return {
      grade: $("#wGrade").value, length: $("#wLength").value, purpose: $("#wPurpose").value,
      topic: $("#wTopic").value.trim(), goal: $("#wGoal").value.trim(), notes: $("#wNotes").value.trim(),
      types: checked("wTypes"), supports: checked("wSupports"), versions: checked("wVersions"), needs: $("#wNeeds").value.trim()
    };
  }
  const LEN = {
    half: { "K-2": "4–5 items, about 5 minutes", "3-5": "5–6 items, about 5 minutes" },
    one: { "K-2": "6–8 items, about 10 minutes", "3-5": "8–10 items, about 10 minutes" },
    two: { "K-2": "9–10 items, about 15 minutes", "3-5": "12–14 items, about 15 minutes" }
  };
  function userPrompt(s) {
    const band = bandOf(s.grade);
    return `WORKSHEET REQUEST
Grade: ${s.grade} (${band === "K-2" ? "K–2, iPads, pre-/early readers" : "3–5, Chromebooks, independent readers"})
Session / topic: ${s.topic || "[not given]"}
"I can" goal: ${s.goal || "[write one measurable goal that fits the topic]"}
What was taught / key words: ${s.notes || "[not given — keep to core, grade-level ideas for this topic]"}
Purpose: ${s.purpose}
Length: ${LEN[s.length][band]} per version (part of a 20-minute class)
Question types to use: ${s.types.length ? s.types.join(", ") : "your best choice for the goal"}
Supports: ${s.supports.length ? s.supports.join(", ") : "none requested"}
Versions to create: ${s.versions.length ? s.versions.join(", ") : "On-level"}
Other needs: ${s.needs || "none"}
Delivery: printed on paper AND posted on Google Classroom as a copy students fill out.`;
  }
  function updatePromptPeek() {
    const s = snapshot();
    WS_SYSTEM = buildWorksheetSystem(buildAlignmentData(s.grade, wsCtx.topicIds, { ca: wsCtx.ca }));
    $("#wPromptText").textContent = "SYSTEM:\n" + WS_SYSTEM + "\n\nUSER:\n" + userPrompt(s);
  }
  $("#view-worksheet").addEventListener("change", e => { if (e.target.closest(".card") && e.target.id !== "wIdea") updatePromptPeek(); });
  $("#wCopyPrompt").addEventListener("click", e => copyText($("#wPromptText").textContent, e.target));

  // ---------- ✨ Improve my request ----------
  $("#wImprove").addEventListener("click", async () => {
    const idea = $("#wIdea").value.trim();
    if (!idea) { $("#wImproveNote").textContent = "Type a quick idea first."; return; }
    const btn = $("#wImprove"); btn.disabled = true; $("#wImproveNote").textContent = "Turning your idea into a clear request…";
    try {
      const txt = await callAI(IMPROVE_SYSTEM, [{ role: "user", content: idea }], 700);
      const f = parseJSON(txt);
      if (f.grade && CC.GRADES.includes(f.grade)) $("#wGrade").value = f.grade;
      if (f.topic) $("#wTopic").value = f.topic;
      if (f.goal) $("#wGoal").value = f.goal;
      if (f.notes) $("#wNotes").value = f.notes;
      if (f.length && ["half", "one", "two"].includes(f.length)) $("#wLength").value = f.length;
      if (f.purpose) { const o = $$("#wPurpose option").find(o => o.value === f.purpose); if (o) $("#wPurpose").value = f.purpose; }
      const setChecks = (id, vals) => { if (Array.isArray(vals) && vals.length) $$(`#${id} input`).forEach(i => i.checked = vals.includes(i.value)); };
      setChecks("wTypes", f.types); setChecks("wSupports", f.supports); setChecks("wVersions", f.versions);
      if (f.needs) $("#wNeeds").value = f.needs;
      // match a topic for verified alignment
      const hit = TOPICS.find(t => (f.topic || "").toLowerCase().includes(t.title.split(/[ —(&/]/)[0].toLowerCase()) || (f.topic_id && f.topic_id === t.id));
      wsCtx = hit ? { topicIds: [hit.id], ca: [] } : { topicIds: [], ca: [] };
      updatePromptPeek();
      $("#wImproveNote").innerHTML = "✓ Form filled. " + (f.assumptions ? "<em>Assumed: " + esc(f.assumptions) + "</em>" : "Check it, then Create worksheet.");
    } catch (err) { $("#wImproveNote").textContent = "Couldn't improve that: " + (err.message || err); }
    finally { btn.disabled = false; }
  });

  // ---------- generate / revise ----------
  function parseJSON(txt) {
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("The worksheet came back in the wrong format. Please try again.");
    return JSON.parse(txt.slice(a, b + 1));
  }
  async function generate(extraMessages) {
    const card = $("#wOutCard");
    card.classList.remove("hidden");
    $("#wStatus").innerHTML = `<div class="loading-line">${extraMessages ? "Revising your worksheet" : "Writing questions, building the print layout and the Classroom copy"}</div>`;
    $(".stamp", card).classList.remove("show");
    const messages = [{ role: "user", content: userPrompt(WS_INPUT) }].concat(extraMessages || []);
    const txt = await callAI(WS_SYSTEM, messages, 4096);
    const ws = parseJSON(txt);
    if (!ws.versions || !ws.versions.length) throw new Error("No worksheet versions came back");
    WS = ws; WS._raw = JSON.stringify(ws);
    $("#wStatus").innerHTML = "";
    renderAll();
    requestAnimationFrame(() => $(".stamp", card).classList.add("show"));
  }
  $("#wGenerate").addEventListener("click", async () => {
    const s = snapshot();
    if (!s.topic) { $("#wOutCard").classList.remove("hidden"); $("#wStatus").innerHTML = `<div class="empty-state">Add a session/topic, or type a quick idea and click ✨ Improve.</div>`; return; }
    WS_INPUT = s; updatePromptPeek();
    const btn = $("#wGenerate"); btn.disabled = true;
    try { await generate(); } catch (err) { $("#wStatus").innerHTML = `<div class="empty-state">Something went wrong: ${esc(err.message || err)}</div>`; }
    finally { btn.disabled = false; }
  });
  $("#wReviseBtn").addEventListener("click", async () => {
    const r = $("#wRevise").value.trim(); if (!r || !WS) return;
    const btn = $("#wReviseBtn"); btn.disabled = true;
    try {
      await generate([{ role: "assistant", content: WS._raw }, { role: "user", content: "Revise the worksheet: " + r + "\nReturn the COMPLETE updated JSON only, same schema, keeping everything else that works." }]);
      $("#wRevise").value = "";
    } catch (err) { $("#wStatus").innerHTML = `<div class="empty-state">Couldn't revise: ${esc(err.message || err)}</div>`; }
    finally { btn.disabled = false; }
  });

  // ---------- helpers ----------
  function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
  function shuffled(arr, key) {
    const r = seeded(key), a = arr.map((v, i) => ({ v, i }));
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.length > 1 && a.every((x, i) => x.i === i)) a.push(a.shift());
    return a;
  }
  const L = i => String.fromCharCode(65 + i);
  const isK2 = () => bandOf(WS_INPUT.grade) === "K-2";
  const STARS = { "Support": "★", "On-level": "★★", "Challenge": "★★★" };

  // ---------- print / screen render ----------
  function renderAll() {
    const sel = $("#wVersionPick");
    sel.innerHTML = WS.versions.map((v, i) => `<option value="${i}">${esc(v.level || "Version " + (i + 1))}</option>`).join("") + (WS.versions.length > 1 ? `<option value="all">All versions</option>` : "");
    renderPreview(); renderPost(); renderTeacher(); renderHowTo();
  }
  $("#wVersionPick").addEventListener("change", renderPreview);
  $("#wKeyToggle").addEventListener("change", renderPreview);

  function renderPreview() {
    const pick = $("#wVersionPick").value, key = $("#wKeyToggle").checked;
    const list = pick === "all" ? WS.versions.map((v, i) => i) : [+pick || 0];
    $("#wPreview").innerHTML = list.map(i => pageHTML(WS.versions[i], key, i)).join("");
  }
  function pageHTML(v, key, vi) {
    let n = 0;
    const k2 = isK2();
    const ans = t => key ? `<span class="ws-ans">${esc(t)}</span>` : "";
    const secs = (v.sections || []).map((s, si) => {
      const id = `${vi}-${si}`;
      const bank = (s.word_bank && s.word_bank.length) ? `<div class="ws-bank"><b>Word bank:</b> ${s.word_bank.map(w => `<span>${esc(w)}</span>`).join("")}</div>` : "";
      let body = "";
      const items = s.items || [];
      switch (s.type) {
        case "multiple_choice":
          body = items.map(it => `<div class="ws-q"><div class="ws-qt"><span class="ws-n">${++n}</span>${it.icon ? `<span class="ws-ico">${esc(it.icon)}</span>` : ""}${esc(it.q)}</div>
            <div class="ws-choices">${(it.choices || []).map((c, ci) => `<span class="ws-choice ${key && ci === it.answer ? "is-ans" : ""}"><i>${k2 ? "" : L(ci)}</i>${esc(c)}</span>`).join("")}</div></div>`).join("");
          break;
        case "true_false":
          body = items.map(it => `<div class="ws-q ws-row"><div class="ws-qt"><span class="ws-n">${++n}</span>${esc(it.statement)}</div>
            <div class="ws-tf"><span class="${key && it.answer === true ? "is-ans" : ""}">${k2 ? "👍 Yes" : "True"}</span><span class="${key && it.answer === false ? "is-ans" : ""}">${k2 ? "👎 No" : "False"}</span></div></div>`).join("");
          break;
        case "fill_blank":
          body = items.map(it => `<div class="ws-q"><div class="ws-qt"><span class="ws-n">${++n}</span>${esc(it.text).replace(/_{2,}/g, `<span class="ws-blank">${key ? esc(it.answer) : ""}</span>`)}</div></div>`).join("");
          break;
        case "matching": {
          const sh = shuffled(items.map(x => x.right), id);
          body = `<div class="ws-match"><div>${items.map((it, i) => `<div class="ws-mrow"><span class="ws-n">${++n}</span>${esc(it.left)} <span class="ws-line">${key ? L(sh.findIndex(x => x.i === i)) : ""}</span></div>`).join("")}</div>
            <div>${sh.map((x, j) => `<div class="ws-mrow"><b>${L(j)}.</b> ${esc(x.v)}</div>`).join("")}</div></div>`;
          break;
        }
        case "sort": {
          const cats = s.categories || [];
          const sh = shuffled(items, id);
          body = `<div class="ws-bank ws-sortbank">${sh.map(x => `<span>${x.v.icon ? esc(x.v.icon) + " " : ""}${esc(x.v.text)}</span>`).join("")}</div>
            <table class="ws-sort"><tr>${cats.map(c => `<th>${esc(c)}</th>`).join("")}</tr><tr>${cats.map(c => `<td>${key ? items.filter(x => x.answer === c).map(x => `<div class="ws-ans">${esc(x.text)}</div>`).join("") : ""}</td>`).join("")}</tr></table>`;
          break;
        }
        case "sequence": {
          const sh = shuffled(items, id);
          body = sh.map(x => `<div class="ws-q ws-row"><span class="ws-box">${key ? x.i + 1 : ""}</span><div class="ws-qt">${esc(x.v.text)}</div></div>`).join("");
          break;
        }
        case "scenario":
          body = items.map(it => `<div class="ws-q ws-scn"><div class="ws-qt"><span class="ws-n">${++n}</span>${it.icon ? `<span class="ws-ico">${esc(it.icon)}</span>` : ""}${esc(it.situation)}</div>
            <div class="ws-choices">${(it.choices || []).map((c, ci) => `<span class="ws-choice ${key && ci === it.answer ? "is-ans" : ""}"><i>${k2 ? "" : L(ci)}</i>${esc(c)}</span>`).join("")}</div>
            ${!k2 ? `<div class="ws-lines"><span class="ws-starter">Why? </span>${key && it.why ? ans(it.why) : ""}</div>` : ""}</div>`).join("");
          break;
        case "draw":
          body = items.map(it => `<div class="ws-q"><div class="ws-qt"><span class="ws-n">${++n}</span>${esc(it.prompt)}</div>
            <div class="ws-drawbox">${(it.labels || []).length ? `<div class="ws-labels">Label: ${it.labels.map(esc).join(" · ")}</div>` : ""}</div></div>`).join("");
          break;
        case "short_answer":
          body = items.map(it => `<div class="ws-q"><div class="ws-qt"><span class="ws-n">${++n}</span>${esc(it.q)}</div>
            <div class="ws-lines" style="--lines:${Math.min(Math.max(it.lines || 2, 1), 5)}">${it.starter ? `<span class="ws-starter">${esc(it.starter)}</span>` : ""}${key && it.look_for ? ans("Look for: " + it.look_for) : ""}</div></div>`).join("");
          break;
        case "self_check":
          body = `<table class="ws-self">${items.map(it => `<tr><td>${esc(it.statement)}</td>${k2 ? "<td>😀</td><td>😐</td><td>😟</td>" : "<td>☐ Got it</td><td>☐ Almost</td><td>☐ Not yet</td>"}</tr>`).join("")}</table>`;
          break;
        default:
          body = items.map(it => `<div class="ws-q">${esc(JSON.stringify(it))}</div>`).join("");
      }
      return `<section class="ws-sec"><h3>${esc(s.title || "")}</h3>${s.directions ? `<p class="ws-dir">${k2 ? "🔊 " : ""}${esc(s.directions)}</p>` : ""}${bank}${body}</section>`;
    }).join("");
    return `<article class="ws-page ${k2 ? "ws-k2" : ""} ${WS_INPUT.supports.includes("large print") ? "ws-large" : ""}">
      <header class="ws-head">
        <div class="ws-brand">Tech Time with Mrs. Hana <span>Think. Create. Stay Safe.</span></div>
        <div class="ws-name">Name: <span></span>${k2 ? "" : ` Date: <span class="short"></span>`}</div>
      </header>
      <h2 class="ws-title">${esc(WS.title || WS_INPUT.topic)} <small>${STARS[v.level] || ""}</small>${key ? ` <em class="ws-keytag">ANSWER KEY</em>` : ""}</h2>
      <div class="ws-goal">🎯 <b>I can</b> ${esc((WS.i_can || "").replace(/^I can\s*/i, ""))}</div>
      ${secs}
    </article>`;
  }

  // ---------- Classroom post / teacher / how-to ----------
  function postMd() {
    const p = WS.classroom_post || {};
    return `## ${p.title || WS.title}\n\n**Today's goal:** ${WS.i_can || ""}\n\n**What you need:** ${p.need || "Your device and the attached worksheet"}\n\n${(p.directions || []).map((d, i) => `${i + 1}. ${d}`).join("\n")}\n\n**Turn in:** ${p.submit || "Click Turn in when you finish."}\n\n**Think about it:** ${p.reflection || ""}\n\n**[ATTACH: worksheet — “Make a copy for each student”]**`;
  }
  function renderPost() { $("#wPost").innerHTML = mdToHtml(postMd()); }
  $("#wCopyPost").addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); copyText(postMd().replace(/\*\*\[ATTACH[^\]]*\]\*\*/, "").replace(/\*\*/g, "").replace(/^## /m, ""), e.target); });

  function teacherMd() {
    const t = WS.teacher || {};
    const al = (t.alignment || []).map(a => `| ${a.type || ""} | ${a.id || ""} | ${a.how || ""} | ${a.link || ""} |`).join("\n");
    return `**Grade:** ${WS_INPUT.grade} · **Topic:** ${WS_INPUT.topic} · **Time:** about ${WS.time_minutes || "10"} minutes\n\n**Objective:** ${t.objective || WS.i_can}\n\n**Prep:** ${t.prep || "Print or attach."}\n\n## Alignment\n| Type | Identifier / lesson | How this worksheet connects | Source |\n|---|---|---|---|\n${al || "| — | — | — | — |"}\n\n## Likely misconceptions\n${(t.misconceptions || []).map(m => `- **${m.misconception}** → ${m.fix}`).join("\n")}\n\n## Completed vs. understood\n${t.understanding_vs_completion || ""}\n\n## Versions\n${t.differentiation || WS.versions.map(v => v.level).join(", ")}`;
  }
  function renderTeacher() { $("#wTeacher").innerHTML = mdToHtml(teacherMd()); }
  $("#wCopyNotes").addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); copyText(teacherMd(), e.target); });

  function renderHowTo() {
    const k2 = isK2();
    const md = k2 ? `**K–2 on iPads: the easiest way is to let students draw and circle on the page.**
1. Click **🖨️ Print / Save as PDF** and choose *Save as PDF*.
2. In Google Classroom: **Create → Assignment** and paste the post.
3. Click **Add → Upload** (or Drive), attach the PDF, and set it to **Make a copy for each student**.
4. Students open their copy in the Classroom iPad app, tap the ✏️ pencil to circle, draw, and write, then tap **Turn in**.
5. Paper option: print and send home or use in class.

Tip: read the 🔊 directions aloud. Students can also answer by pointing or telling you.`
      : `**3–5 on Chromebooks: students type right into a Google Doc.**
1. Click **📄 Google Doc for Classroom (.docx)**.
2. Upload it to Google Drive, open it, and choose **File → Save as Google Docs** (or turn on *Convert uploads* in Drive settings).
3. In Google Classroom: **Create → Assignment**, paste the post, then **Add → Google Drive** and pick the Doc.
4. Set the attachment to **Make a copy for each student**. Each student gets their own copy with their name on the file automatically.
5. Students type in the shaded answer boxes (or change ☐ to ☒) and click **Turn in**. You can comment and grade right in the Doc.
6. Paper option: **🖨️ Print**. Keep the **🔑 Answer key** for yourself; never attach it to the assignment.`;
    $("#wHowTo").innerHTML = mdToHtml(md);
  }

  // ---------- print ----------
  $("#wPrint").addEventListener("click", () => {
    let root = $("#printRoot");
    if (!root) { root = document.createElement("div"); root.id = "printRoot"; document.body.appendChild(root); }
    root.innerHTML = $("#wPreview").innerHTML;
    document.body.classList.add("printing-ws");
    const done = () => { document.body.classList.remove("printing-ws"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); setTimeout(done, 1000); }, 50);
  });

  // ---------- save ----------
  function wsMarkdown() {
    const parts = [`# Worksheet: ${WS.title}`, `**I can** ${WS.i_can}`];
    WS.versions.forEach(v => { parts.push(`## ${v.level}`); (v.sections || []).forEach(s => { parts.push(`### ${s.title} (${s.type})`); if (s.directions) parts.push(s.directions); (s.items || []).forEach((it, i) => parts.push(`${i + 1}. ${it.q || it.statement || it.text || it.left || it.situation || it.prompt || ""}${answerText(s, it) ? " — **Answer:** " + answerText(s, it) : ""}`)); }); });
    return parts.join("\n\n") + "\n\n# Google Classroom assignment (ready to post)\n\n" + postMd() + "\n\n# Teacher notes\n\n" + teacherMd();
  }
  $("#wSave").addEventListener("click", e => {
    if (!WS) return;
    saveEntry({ type: "worksheet", grade: WS_INPUT.grade, title: `${WS.title} (${WS.versions.map(v => v.level).join(" / ")})`, md: wsMarkdown(), json: WS._raw, input: WS_INPUT });
    e.target.textContent = "Saved ✓"; setTimeout(() => e.target.textContent = "Save to Teaching Journal", 1500);
  });

  function answerText(s, it) {
    switch (s.type) {
      case "multiple_choice": case "scenario": return it.choices && it.choices[it.answer] != null ? `${L(it.answer)}. ${it.choices[it.answer]}` + (it.why ? ` (Why: ${it.why})` : "") : "";
      case "true_false": return it.answer ? "True" : "False";
      case "fill_blank": return it.answer || "";
      case "matching": return it.right || "";
      case "sort": return it.answer || "";
      case "short_answer": return it.look_for ? "Look for: " + it.look_for : "";
      case "draw": return (it.labels || []).length ? "Labels: " + it.labels.join(", ") : "";
      default: return "";
    }
  }

  // =============== DOCX (fillable in Google Docs) ===============
  const X = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function run(text, o = {}) {
    const sz = o.size || 24;
    return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${o.bold ? "<w:b/>" : ""}${o.italic ? "<w:i/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${X(text)}</w:t></w:r>`;
  }
  function para(runs, o = {}) {
    const r = typeof runs === "string" ? run(runs, o) : runs.join("");
    return `<w:p><w:pPr><w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 100 : o.after}"/>${o.indent ? `<w:ind w:left="${o.indent}"/>` : ""}${o.align ? `<w:jc w:val="${o.align}"/>` : ""}${o.keep ? "<w:keepNext/>" : ""}</w:pPr>${r}</w:p>`;
  }
  function cell(content, w, o = {}) {
    const ps = Array.isArray(content) ? content.join("") : content;
    return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ""}<w:vAlign w:val="${o.valign || "top"}"/></w:tcPr>${ps || para("")}</w:tc>`;
  }
  function table(rows, widths, o = {}) {
    const b = o.border || "BFB5A0";
    const brd = ["top", "left", "bottom", "right", "insideH", "insideV"].map(s => `<w:${s} w:val="single" w:sz="8" w:space="0" w:color="${b}"/>`).join("");
    return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, c) => a + c, 0)}" w:type="dxa"/><w:tblBorders>${brd}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.map(r => `<w:tr><w:trPr><w:cantSplit/>${o.minH ? `<w:trHeight w:val="${o.minH}" w:hRule="atLeast"/>` : ""}</w:trPr>${r.join("")}</w:tr>`).join("")}</w:tbl>` + para("", { after: 60 });
  }
  const FULL = 10080; // 7in usable width
  const FILL = "FFF7E0";
  const answerBox = (label, lines = 1, prefill = "") => table([[cell(para(label, { bold: true, size: 20, color: "2A4A3F" }), 2200, { fill: "F1ECDD", valign: "center" }), cell([para(prefill, { color: "8A8070", italic: !!prefill })].concat(Array(Math.max(0, lines - 1)).fill(para(""))), FULL - 2200, { fill: FILL })]], [2200, FULL - 2200]);

  function docxBody(versions, key) {
    const k2 = isK2(), out = [];
    const sz = k2 || WS_INPUT.supports.includes("large print") ? 30 : 24;
    versions.forEach((v, vi) => {
      if (vi > 0) out.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
      out.push(para([run("Tech Time with Mrs. Hana  ", { bold: true, size: 18, color: "C1462F" }), run("Think. Create. Stay Safe.", { italic: true, size: 18, color: "6E6656" })], { after: 60 }));
      out.push(para([run(WS.title + "  ", { bold: true, size: 36, color: "1F3B32" }), run(STARS[v.level] || "", { size: 24, color: "DEA954" }), key ? run("   ANSWER KEY (teacher only)", { bold: true, size: 22, color: "C1462F" }) : ""], { after: 80 }));
      if (!key) out.push(answerBox("Name:", 1));
      out.push(table([[cell(para([run("🎯 I can ", { bold: true, size: sz }), run((WS.i_can || "").replace(/^I can\s*/i, ""), { size: sz })]), FULL, { fill: "E4EFE6" })]], [FULL], { border: "A8B5A0" }));
      if (!key && !k2) out.push(para("How to answer: type in the yellow boxes, or change ☐ to ☒ to choose.", { italic: true, size: 18, color: "6E6656" }));
      let n = 0;
      (v.sections || []).forEach((s, si) => {
        const id = `${versions === WS.versions ? vi : WS.versions.indexOf(v)}-${si}`;
        const items = s.items || [];
        out.push(para(s.title || "", { bold: true, size: sz + 4, color: "1F3B32", before: 160, keep: true }));
        if (s.directions) out.push(para((k2 ? "🔊 " : "") + s.directions, { italic: true, size: sz - 2, keep: true }));
        if (s.word_bank && s.word_bank.length) out.push(table([[cell(para([run("Word bank:  ", { bold: true, size: sz - 2 }), run(s.word_bank.join("   •   "), { size: sz - 2 })]), FULL, { fill: "F1ECDD" })]], [FULL]));
        const choices = (it) => (it.choices || []).map((c, ci) => para((key && ci === it.answer ? "☒ " : "☐ ") + (k2 ? "" : L(ci) + ". ") + c, { size: sz, indent: 360, after: 40, bold: key && ci === it.answer }));
        switch (s.type) {
          case "multiple_choice":
            items.forEach(it => { out.push(para(`${++n}. ${it.icon ? it.icon + " " : ""}${it.q}`, { size: sz, keep: true })); out.push(...choices(it)); });
            break;
          case "scenario":
            items.forEach(it => { out.push(para(`${++n}. ${it.icon ? it.icon + " " : ""}${it.situation}`, { size: sz, keep: true })); out.push(...choices(it)); if (!k2) out.push(answerBox("Why?", 2, key ? it.why || "" : "")); });
            break;
          case "true_false":
            items.forEach(it => { out.push(para(`${++n}. ${it.statement}`, { size: sz, keep: true })); out.push(para(`${key && it.answer ? "☒" : "☐"} ${k2 ? "👍 Yes" : "True"}        ${key && !it.answer ? "☒" : "☐"} ${k2 ? "👎 No" : "False"}`, { size: sz, indent: 360 })); });
            break;
          case "fill_blank":
            items.forEach(it => { out.push(para(`${++n}. ${String(it.text).replace(/_{2,}/g, "________")}`, { size: sz, keep: true })); out.push(answerBox("Missing word:", 1, key ? it.answer : "")); });
            break;
          case "matching": {
            const sh = shuffled(items.map(x => x.right), id);
            out.push(table(items.map((it, i) => [cell(para(`${++n}. ${it.left}`, { size: sz }), 4200), cell(para(key ? L(sh.findIndex(x => x.i === i)) : "", { size: sz, bold: true, align: "center" }), 1200, { fill: FILL }), cell(para(`${L(i)}. ${sh[i] ? sh[i].v : ""}`, { size: sz }), FULL - 5400)]), [4200, 1200, FULL - 5400]));
            break;
          }
          case "sort": {
            const cats = s.categories || [];
            const sh = shuffled(items, id);
            out.push(para("Sort these: " + sh.map(x => (x.v.icon ? x.v.icon + " " : "") + x.v.text).join("   •   "), { size: sz, bold: true }));
            const w = Math.floor(FULL / Math.max(cats.length, 1));
            const rowsN = Math.max(...cats.map(c => items.filter(x => x.answer === c).length), 3);
            const rows = [cats.map(c => cell(para(c, { bold: true, size: sz, align: "center" }), w, { fill: "F1ECDD" }))];
            for (let r = 0; r < rowsN; r++) rows.push(cats.map(c => { const it = key ? items.filter(x => x.answer === c)[r] : null; return cell(para(it ? it.text : "", { size: sz }), w, { fill: FILL }); }));
            out.push(table(rows, cats.map(() => w)));
            break;
          }
          case "sequence": {
            const sh = shuffled(items, id);
            out.push(table(sh.map(x => [cell(para(key ? String(x.i + 1) : "", { size: sz, bold: true, align: "center" }), 1100, { fill: FILL }), cell(para(x.v.text, { size: sz }), FULL - 1100)]), [1100, FULL - 1100]));
            break;
          }
          case "draw":
            items.forEach(it => {
              out.push(para(`${++n}. ${it.prompt}`, { size: sz, keep: true }));
              out.push(table([[cell([para(key ? "Labels: " + (it.labels || []).join(", ") : "Draw here: on paper, or Insert → Drawing → New." + ((it.labels || []).length ? "  Label: " + it.labels.join(", ") : ""), { italic: true, size: 18, color: "8A8070" })], FULL)]], [FULL], { minH: 3000 }));
            });
            break;
          case "short_answer":
            items.forEach(it => { out.push(para(`${++n}. ${it.q}`, { size: sz, keep: true })); out.push(answerBox("My answer:", Math.min(Math.max(it.lines || 2, 1), 5), key ? (it.look_for ? "Look for: " + it.look_for : "") : (it.starter || ""))); });
            break;
          case "self_check":
            out.push(table(items.map(it => [cell(para(it.statement, { size: sz }), FULL - 4200), cell(para(k2 ? "☐ 😀" : "☐ Got it", { size: sz }), 1400), cell(para(k2 ? "☐ 😐" : "☐ Almost", { size: sz }), 1400), cell(para(k2 ? "☐ 😟" : "☐ Not yet", { size: sz }), 1400)]), [FULL - 4200, 1400, 1400, 1400]));
            break;
        }
      });
    });
    return out.join("");
  }
  function docxDocument(body) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }
  function makeDocx(body) {
    const files = [
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
      ["word/document.xml", docxDocument(body)]
    ];
    return new Blob([zipStore(files)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  // minimal ZIP writer (stored, no compression) — no external libraries needed
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zipStore(files) {
    const enc = new TextEncoder(), chunks = [], central = [];
    let offset = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    files.forEach(([name, text]) => {
      const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)];
      const local = new Uint8Array([...u32(0x04034b50), ...common]);
      chunks.push(local, nb, data);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), nb);
      offset += local.length + nb.length + data.length;
    });
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
    return new Blob([...chunks, ...central, end]);
  }
  window.__wsZip = zipStore; // for testing
  const fileBase = () => (WS.title || "worksheet").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) + "-" + WS_INPUT.grade.replace(/\s+/g, "");
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 800); }
  function pickedVersions() { const p = $("#wVersionPick").value; return p === "all" ? WS.versions : [WS.versions[+p || 0]]; }
  $("#wDocx").addEventListener("click", () => { if (WS) dl(makeDocx(docxBody(pickedVersions(), false)), fileBase() + ".docx"); });
  $("#wKeyDocx").addEventListener("click", () => { if (WS) dl(makeDocx(docxBody(WS.versions, true)), fileBase() + "-ANSWER-KEY.docx"); });

  updatePromptPeek();
})();
