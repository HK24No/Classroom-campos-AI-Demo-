// app.js — Classroom Compass · Tech Time with Mrs. Hana
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const GRADES = ["Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];
  const STATUSES = ["Not taught", "Introduced", "Started", "Completed"];
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ---------- grade selects ----------
  $$(".grade-select").forEach(sel => {
    sel.innerHTML = GRADES.map(g => `<option>${g}</option>`).join("");
    sel.value = "Grade 3";
  });
  $("#lDate").value = new Date().toISOString().slice(0, 10);

  // ---------- navigation ----------
  function showView(view, workflow) {
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view && (view !== "generic" || t.dataset.workflow === workflow)));
    if (view === "generic") applyWorkflow(workflow);
    if (view === "log") renderLog();
    $("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$(".tab").forEach(t => t.addEventListener("click", () => showView(t.dataset.view, t.dataset.workflow)));
  $("#menuBtn").addEventListener("click", e => { e.stopPropagation(); $("#sidebar").classList.toggle("open"); });
  document.addEventListener("click", e => { if (!e.target.closest("#sidebar")) $("#sidebar").classList.remove("open"); });

  // ---------- chips ----------
  const caChip = (c, ic) => `<a class="chip ca${ic ? " ic" : ""}" href="${SOURCES.caCsPdf}" target="_blank" rel="noopener" title="${esc((ic ? "Instructional connection. " : "") + CA_CS[c])}">${c}</a>`;
  const isteChip = c => `<a class="chip" href="${SOURCES.iste}" target="_blank" rel="noopener" title="${esc(ISTE[c])}">ISTE ${c}</a>`;
  const cseChip = n => CSE_LESSONS[n] ? `<a class="chip cse" href="${CSE_LESSONS[n].url}" target="_blank" rel="noopener" title="Common Sense · Grade ${CSE_LESSONS[n].grade}">${esc(n)} <small>(Gr ${CSE_LESSONS[n].grade})</small></a>` : "";

  // ---------- markdown ----------
  function inline(s) {
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|\W)\*(?!\s)(.+?)\*(?=\W|$)/g, "$1<em>$2</em>").replace(/`(.+?)`/g, "<code>$1</code>");
    return s;
  }
  function mdToHtml(md) {
    const lines = md.replace(/\r/g, "").split("\n");
    let html = "", list = null, i = 0;
    const close = () => { if (list) { html += `</${list}>`; list = null; } };
    while (i < lines.length) {
      const line = lines[i].trim();
      if (/^\|.*\|$/.test(line)) {
        close();
        const rows = [];
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(lines[i].trim()); i++; }
        const cells = r => r.slice(1, -1).split("|").map(c => c.trim());
        const body = rows.filter(r => !/^\|[\s:|-]+\|$/.test(r));
        if (!body.length) continue;
        html += '<div class="tbl-wrap"><table><thead><tr>' + cells(body[0]).map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
        body.slice(1).forEach(r => html += "<tr>" + cells(r).map(c => `<td>${inline(c).replace(/&lt;br\s*\/?&gt;/g, "<br>")}</td>`).join("") + "</tr>");
        html += "</tbody></table></div>";
        continue;
      }
      let m;
      if ((m = line.match(/^#{3,6}\s+(.*)/))) { close(); html += `<h3>${inline(m[1])}</h3>`; }
      else if ((m = line.match(/^##\s+(.*)/))) { close(); html += `<h2>${inline(m[1])}</h2>`; }
      else if ((m = line.match(/^#\s+(.*)/))) { close(); html += `<h2>${inline(m[1])}</h2>`; }
      else if ((m = line.match(/^[-*•]\s+(.*)/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = line.match(/^\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; }
      else if (/^(-{3,}|\*{3,})$/.test(line)) { close(); html += "<hr>"; }
      else if (line === "") { close(); }
      else { close(); html += `<p>${inline(line)}</p>`; }
      i++;
    }
    close();
    return html;
  }
  function splitSections(md) {
    const parts = [];
    let cur = null;
    md.replace(/\r/g, "").split("\n").forEach(l => {
      const m = l.match(/^#\s+(.*)/);
      if (m) { cur = { title: m[1].trim(), body: [] }; parts.push(cur); }
      else { if (!cur) { cur = { title: "", body: [] }; parts.push(cur); } cur.body.push(l); }
    });
    return parts.map(p => ({ title: p.title, body: p.body.join("\n").trim() })).filter(p => p.title || p.body);
  }
  const isFamily = t => /classroom (recap|post|learning recap)|ready to post/i.test(t);

  function renderSections(md, target, fallbackTitle) {
    const secs = splitSections(md);
    target.innerHTML = "";
    secs.forEach(s => {
      const title = s.title || fallbackTitle || "Output";
      const d = document.createElement("details");
      d.className = "out"; d.open = true;
      const fam = isFamily(title);
      d.innerHTML = `<summary><span class="grow">${inline(title)}</span><span class="tag ${fam ? "family" : "teacher"}">${fam ? "Students & families" : "Teacher only"}</span><button class="btn-sm" type="button">Copy</button></summary><div class="sec-body">${mdToHtml(s.body)}</div>`;
      const raw = (s.title ? "# " + s.title + "\n\n" : "") + s.body;
      $("button", d).addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); copyText(fam ? s.body : raw, e.target); });
      target.appendChild(d);
    });
  }
  function copyText(text, btn) {
    const done = () => { if (btn) { const o = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => btn.textContent = o, 1200); } };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done)); else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) {} t.remove(); done(); }
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "text/markdown" }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  // ---------- output cards ----------
  function setLoading(card, msg) {
    $(".toolbar", card).classList.add("hidden");
    $(".stamp", card).classList.remove("show");
    $(".output", card).innerHTML = `<div class="loading-line">${esc(msg)}</div>`;
    card.classList.remove("hidden");
  }
  function showResult(card, md, meta) {
    card._md = md; card._meta = meta;
    renderSections(md, $(".output", card), meta.title);
    $(".toolbar", card).classList.remove("hidden");
    requestAnimationFrame(() => $(".stamp", card).classList.add("show"));
  }
  function showError(card, err) {
    $(".output", card).innerHTML = `<div class="empty-state">Something went wrong: ${esc(err)}. Please try again.</div>`;
  }
  $$(".output-wrap").forEach(card => {
    const tb = $(".toolbar", card);
    if (!tb) return;
    tb.addEventListener("click", e => {
      const act = e.target.dataset.act;
      if (!act || !card._md) return;
      const m = card._meta || {};
      if (act === "copyall") copyText(card._md, e.target);
      if (act === "download") download(`${m.type || "output"}-${(m.grade || "").replace(/\s+/g, "")}-${new Date().toISOString().slice(0, 10)}.md`, card._md);
      if (act === "save") { saveEntry({ type: m.type, grade: m.grade, title: m.title, md: card._md, date: m.date }); e.target.textContent = "Saved ✓"; setTimeout(() => e.target.textContent = "Save to Teaching Journal", 1500); }
    });
  });

  async function callAI(system, messages, maxTokens) {
    const res = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages, max_tokens: maxTokens || 1400 })
    });
    let data;
    try { data = await res.json(); } catch (e) { throw new Error("The server returned an unreadable response (status " + res.status + ")"); }
    if (!res.ok) throw new Error((data && data.error) ? String(data.error).slice(0, 300) : "HTTP " + res.status);
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if (!text) throw new Error("No content came back");
    if (data.stop_reason === "max_tokens") return text + "\n\n> ⚠️ This response hit the length limit. Generate again or shorten your inputs.";
    return text;
  }
  const fmtDate = v => { if (!v) return "[date]"; const [y, m, d] = v.split("-"); return `${+m}/${+d}/${y.slice(2)}`; };

  // ================= 00 LIBRARY =================
  let libBand = "K-2";
  function renderLibrary() {
    $$("#bandSwitch button").forEach(b => b.classList.toggle("on", b.dataset.band === libBand));
    const plan = YEAR_PLAN[libBand];
    $("#libraryList").innerHTML = plan.map((p, i) => `
      <details class="dd month">
        <summary><span class="m">${p.month}</span><span class="grow">${esc(p.focus)}</span><span class="meta">${p.activities.length} activities</span></summary>
        <div class="dd-body">
          <div class="lbl">Activities from your plan</div>
          <ul>${p.activities.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
          <div class="lbl">CA CS Standards</div><div class="chips">${p.ca.map(c => caChip(c)).join("") || "<span class='chip'>No direct CA CS standard</span>"}</div>
          <div class="lbl">ISTE (supplemental)</div><div class="chips">${p.iste.map(isteChip).join("")}</div>
          ${p.cse.length ? `<div class="lbl">Common Sense lessons (curriculum resource)</div><div class="chips">${p.cse.map(cseChip).join("")}</div>` : ""}
          <div class="row-btns">
            <button class="btn-sm primary" data-plan="${libBand}:${i}">Plan a 20-min lesson from this →</button>
            <button class="btn-sm" data-ws="plan:${libBand}:${i}">Make a worksheet</button>
            ${p.topics.length ? `<button class="btn-sm" data-recap="${libBand}:${i}">Mark these topics in my recap</button>` : ""}
          </div>
        </div>
      </details>`).join("");
  }
  $("#bandSwitch").addEventListener("click", e => { if (e.target.dataset.band) { libBand = e.target.dataset.band; renderLibrary(); } });
  $("#libraryList").addEventListener("click", e => {
    const p = e.target.dataset.plan, r = e.target.dataset.recap;
    if (p) { $("#lFromPlan").value = "plan:" + p; applyPlanPick(); showView("lesson"); }
    if (r) {
      const [band, i] = r.split(":");
      if (bandOf($("#rGrade").value) !== band) { $("#rGrade").value = band === "K-2" ? "Kindergarten" : "Grade 3"; onRecapGrade(); }
      YEAR_PLAN[band][+i].topics.forEach(id => { if (recapState[id] && recapState[id].status === "Not taught") recapState[id].status = "Started"; });
      renderRecapTopics(); showView("recap");
    }
  });

  function renderTopicLibrary() {
    $("#topicLibrary").innerHTML = TOPICS.map(t => {
      const rows = GRADES.filter(g => !t.gradeOnly || t.gradeOnly === g).map(g => {
        const band = bandOf(g), gk = gradeKey(g);
        const ca = t.ca[band] || [];
        const cse = t.cse[gk] || [];
        return `<tr><td><strong>${g === "Kindergarten" ? "K" : g.replace("Grade ", "Gr ")}</strong></td><td>${ca.map(c => caChip(c, !t.direct)).join(" ") || "<em>No direct CA CS standard</em>"}</td><td>${cse.map(cseChip).join(" ") || "—"}</td></tr>`;
      }).join("");
      return `<details class="dd">
        <summary><span>${t.icon}</span><span class="grow">${esc(t.title)}</span><span class="meta">${t.direct ? "direct standard" : "instructional connection"}</span></summary>
        <div class="dd-body">
          ${t.activities["K-2"] ? `<div class="lbl">K–2 (iPads)</div><p>${esc(t.activities["K-2"])}</p>` : ""}
          ${t.activities["3-5"] ? `<div class="lbl">3–5 (Chromebooks)</div><p>${esc(t.activities["3-5"])}</p>` : ""}
          ${t.note ? `<p><em>${esc(t.note)}</em></p>` : ""}
          <div class="lbl">ISTE</div><div class="chips">${t.iste.map(isteChip).join("")}</div>
          <div class="sec-body" style="padding:0"><div class="tbl-wrap"><table><thead><tr><th>Grade</th><th>CA CS Standard</th><th>Common Sense lesson</th></tr></thead><tbody>${rows}</tbody></table></div></div>
          <div class="row-btns"><button class="btn-sm primary" data-topic="${t.id}">Plan a lesson on this →</button><button class="btn-sm" data-ws="topic:${t.id}">Make a worksheet</button></div>
        </div></details>`;
    }).join("");
  }
  $("#topicLibrary").addEventListener("click", e => {
    if (e.target.dataset.topic) { $("#lFromPlan").value = "topic:" + e.target.dataset.topic; applyPlanPick(); showView("lesson"); }
  });

  // ================= 01 RECAP =================
  // Each grade keeps its own checklist — never assume one grade studied what another did.
  let recapState = {}, customCount = 0;
  const recapByGrade = {};
  function initRecapState() {
    const g = $("#rGrade").value, band = bandOf(g);
    if (!recapByGrade[g]) {
      recapByGrade[g] = {};
      TOPICS.forEach(t => recapByGrade[g][t.id] = { status: "Not taught", did: t.activities[band] || "", evidence: "" });
    }
    recapState = recapByGrade[g];
  }
  function onRecapGrade() {
    const g = $("#rGrade").value;
    $("#rDevice").value = bandOf(g) === "K-2" ? "iPads" : "Chromebooks";
    initRecapState(); renderRecapTopics();
  }
  function statusColor(s) { return { "Not taught": "#E9E4D6;color:#6E6656", Introduced: "#E5EEF7;color:#2E5A86", Started: "#FBF0D9;color:#8A5A12", Completed: "#E4EFE6;color:#3F7A57" }[s]; }
  function renderRecapTopics() {
    const g = $("#rGrade").value, band = bandOf(g), gk = gradeKey(g);
    const openIds = new Set($$("#recapTopics details[open]").map(d => d.dataset.id));
    const items = TOPICS.filter(t => !t.gradeOnly || t.gradeOnly === g).map(t => ({ id: t.id, title: t.id === "device-basics" ? (band === "K-2" ? "iPad basics" : "Chromebook basics") : t.title, icon: t.icon, t }))
      .concat(Object.entries(recapState).filter(([, v]) => v.custom).map(([id, v]) => ({ id, title: v.title, icon: "📝" })));
    $("#recapTopics").innerHTML = items.map(it => {
      const st = recapState[it.id];
      const t = it.t;
      const chips = t ? ((t.ca[band] || []).map(c => caChip(c, !t.direct)).join("") + t.iste.map(isteChip).join("") + (t.cse[gk] || []).map(cseChip).join("")) : "<span class='chip'>Custom topic — alignment will be suggested from the verified list</span>";
      return `<details class="dd topic-row ${st.status !== "Not taught" ? "on" : ""}" data-id="${it.id}" ${openIds.has(it.id) ? "open" : ""}>
        <summary><span>${it.icon}</span><span class="grow">${esc(it.title)}</span>
          <select data-k="status" aria-label="Status">${STATUSES.map(s => `<option ${s === st.status ? "selected" : ""}>${s}</option>`).join("")}</select>
          <span class="status-pill" style="background:${statusColor(st.status)}">${st.status === "Not taught" ? "skip" : st.status}</span></summary>
        <div class="dd-body">
          <div class="lbl">What we did (edit to match what really happened)</div>
          <textarea data-k="did">${esc(st.did)}</textarea>
          <div class="lbl">Evidence / observations (optional, no names)</div>
          <textarea data-k="evidence" placeholder="e.g., Exit ticket: most sorted 4 of 5 items correctly. Date taught: 9/18.">${esc(st.evidence)}</textarea>
          <div class="lbl">Verified alignment for ${g}</div><div class="chips">${chips}</div>
          ${it.id.startsWith("custom") ? `<div class="row-btns"><button class="btn-sm" data-remove="${it.id}">Remove</button></div>` : ""}
        </div></details>`;
    }).join("");
  }
  $("#recapTopics").addEventListener("click", e => { if (e.target.tagName === "SELECT") e.stopPropagation(); if (e.target.dataset.remove) { delete recapState[e.target.dataset.remove]; renderRecapTopics(); } });
  $("#recapTopics").addEventListener("change", e => {
    const row = e.target.closest("details"); if (!row) return;
    const k = e.target.dataset.k; if (!k) return;
    recapState[row.dataset.id][k] = e.target.value;
    if (k === "did") recapState[row.dataset.id].didEdited = true;
    if (k === "status") renderRecapTopics();
  });
  $("#recapTopics").addEventListener("input", e => {
    const row = e.target.closest("details"); const k = e.target.dataset.k;
    if (row && k && k !== "status") { recapState[row.dataset.id][k] = e.target.value; if (k === "did") recapState[row.dataset.id].didEdited = true; }
  });
  $("#rGrade").addEventListener("change", onRecapGrade);
  $(".quick-set [data-set]").addEventListener("click", () => { Object.values(recapState).forEach(v => v.status = "Not taught"); renderRecapTopics(); });
  $("#rPresetPlan").addEventListener("click", () => {
    const g = $("#rGrade").value, band = bandOf(g);
    YEAR_PLAN[band].filter(p => /Aug/.test(p.month)).forEach(p => p.topics.forEach(id => {
      const t = TOPICS.find(x => x.id === id);
      if (t && (!t.gradeOnly || t.gradeOnly === g) && recapState[id] && recapState[id].status === "Not taught") recapState[id].status = "Started";
    }));
    renderRecapTopics();
  });
  $("#rAddCustom").addEventListener("click", () => {
    const v = $("#rCustom").value.trim(); if (!v) return;
    recapState["custom" + (++customCount)] = { custom: true, title: v, status: "Started", did: "", evidence: "" };
    $("#rCustom").value = ""; renderRecapTopics();
  });

  $("#rGenerate").addEventListener("click", async () => {
    const card = $("#rOutCard");
    const g = $("#rGrade").value;
    const confirmed = Object.entries(recapState).filter(([, v]) => v.status !== "Not taught");
    if (!confirmed.length) { card.classList.remove("hidden"); $(".output", card).innerHTML = `<div class="empty-state">Set at least one topic to Introduced, Started, or Completed. Only confirmed topics are used.</div>`; return; }
    const topicIds = confirmed.map(([id]) => id).filter(id => !id.startsWith("custom"));
    const lines = confirmed.map(([id, v]) => {
      const t = TOPICS.find(x => x.id === id);
      return `- ${t ? (t.id === "device-basics" ? (bandOf(g) === "K-2" ? "iPad basics" : "Chromebook basics") : t.title) : v.title} — STATUS: ${v.status}${v.did ? `\n  What we did: ${v.did}` : ""}${v.evidence ? `\n  Teacher evidence/observations: ${v.evidence}` : "\n  Evidence: none provided"}`;
    }).join("\n");
    const user = `MY CLASSROOM
School: Academy for Academic Excellence
Grade: ${g}
Class length: 20 minutes, including setup and cleanup
Devices: ${$("#rDevice").value}
Audience: students and families through Google Classroom
Document learning from the beginning of the 2026–27 school year through ${fmtDate($("#rThrough").value)}.

CONFIRMED TEACHING HISTORY (use only these):
${lines}

${$("#rObs").value.trim() ? "GENERAL OBSERVATIONS: " + $("#rObs").value.trim() : "GENERAL OBSERVATIONS: none provided"}
${g === "Grade 5" ? "" : "This is not 5th grade: do not mention digital book covers."}`;
    const btn = $("#rGenerate"); btn.disabled = true;
    setLoading(card, "Drafting recap, review lesson and documentation from verified sources");
    try {
      const md = await callAI(buildRecapSystem(buildAlignmentData(g, topicIds)), [{ role: "user", content: user }], 3800);
      showResult(card, md, { type: "recap", grade: g, title: `Learning recap through ${fmtDate($("#rThrough").value)}`, date: $("#rThrough").value });
    } catch (err) { showError(card, err.message || err); }
    finally { btn.disabled = false; }
  });

  // ================= 02 LESSON + JOURNAL =================
  let lessonCtx = { topicIds: [], ca: [] }, lessonConv = null;
  function fillPlanSelect() {
    let html = `<option value="">— Pick a month / topic to pre-fill —</option>`;
    ["K-2", "3-5"].forEach(b => {
      html += `<optgroup label="${b} year plan">` + YEAR_PLAN[b].map((p, i) => `<option value="plan:${b}:${i}">${b} · ${p.month} — ${esc(p.focus)}</option>`).join("") + "</optgroup>";
    });
    html += `<optgroup label="Teaching-history topics">` + TOPICS.map(t => `<option value="topic:${t.id}">${t.icon} ${esc(t.title)}</option>`).join("") + "</optgroup>";
    $("#lFromPlan").innerHTML = html;
  }
  function applyPlanPick() {
    const v = $("#lFromPlan").value;
    if (!v) { lessonCtx = { topicIds: [], ca: [] }; renderAlignPreview(); return; }
    const parts = v.split(":");
    if (parts[0] === "plan") {
      const p = YEAR_PLAN[parts[1]][+parts[2]];
      if (bandOf($("#lGrade").value) !== parts[1]) $("#lGrade").value = parts[1] === "K-2" ? "Grade 1" : "Grade 3";
      $("#lTopic").value = p.focus.replace(/\s*\(.*?\)\s*/g, " ").trim();
      $("#lProject").value = `From my ${p.month} plan: ${p.activities.join("; ")}. [Edit: which activity / what stage are students at?]`;
      lessonCtx = { topicIds: p.topics, ca: p.ca };
    } else {
      const t = TOPICS.find(x => x.id === parts[1]);
      if (t.gradeOnly) $("#lGrade").value = t.gradeOnly;
      $("#lTopic").value = t.title;
      lessonCtx = { topicIds: [t.id], ca: [] };
    }
    syncTools(); renderAlignPreview();
  }
  function syncTools() {
    const band = bandOf($("#lGrade").value);
    const cur = $("#lTools").value.trim();
    if (!cur || cur === DEFAULT_TOOLS["K-2"] || cur === DEFAULT_TOOLS["3-5"]) $("#lTools").value = DEFAULT_TOOLS[band];
  }
  function renderAlignPreview() {
    const g = $("#lGrade").value, band = bandOf(g), gk = gradeKey(g);
    const ca = new Set(lessonCtx.ca.filter(c => c.startsWith(band)));
    const iste = new Set(), cse = new Set();
    lessonCtx.topicIds.forEach(id => { const t = TOPICS.find(x => x.id === id); if (!t) return; (t.ca[band] || []).forEach(c => ca.add(c)); t.iste.forEach(c => iste.add(c)); (t.cse[gk] || []).forEach(n => cse.add(n)); });
    $("#lAlignPreview").innerHTML = (ca.size || cse.size)
      ? `Suggested verified matches for ${g}: <div class="chips">${[...ca].map(c => caChip(c)).join("")}${[...iste].map(isteChip).join("")}${[...cse].map(cseChip).join("")}</div>`
      : `No topic picked. Claude will choose 1–2 standards from the verified ${band} list.`;
  }
  $("#lFromPlan").addEventListener("change", applyPlanPick);
  $("#lGrade").addEventListener("change", () => { syncTools(); renderAlignPreview(); });

  $("#lGenerate").addEventListener("click", async () => {
    const card = $("#lOutCard"), g = $("#lGrade").value;
    const topic = $("#lTopic").value.trim();
    if (!topic) { card.classList.remove("hidden"); $(".output", card).innerHTML = `<div class="empty-state">Add a subject/topic (or pick one from your year plan).</div>`; return; }
    const user = `LESSON DETAILS
Grade: ${g}
Date: ${fmtDate($("#lDate").value)} (planned, not yet taught)
Subject/topic: ${topic}
Current project and stage: ${$("#lProject").value.trim() || "[not provided]"}
Previous learning: ${$("#lPrev").value.trim() || "[not provided]"}
Devices and approved tools: ${$("#lTools").value.trim()}
Student needs: ${$("#lNeeds").value.trim() || "[not provided — assume a typical mixed class incl. emerging readers and English learners]"}
Duration: 20 minutes, including setup and cleanup
Evidence or observations from the last class: ${$("#lEvidence").value.trim() || "NOT YET COLLECTED"}`;
    const system = buildLessonSystem(buildAlignmentData(g, lessonCtx.topicIds, { ca: lessonCtx.ca }));
    const btn = $("#lGenerate"); btn.disabled = true;
    setLoading(card, "Designing the lesson, post and journal entry");
    $("#followCard").classList.add("hidden"); $("#fOutCard").classList.add("hidden");
    try {
      const md = await callAI(system, [{ role: "user", content: user }], 4000);
      lessonConv = { system, messages: [{ role: "user", content: user }, { role: "assistant", content: md }], grade: g, topic, date: $("#lDate").value };
      showResult(card, md, { type: "lesson-plan", grade: g, title: `${topic} (planned ${fmtDate($("#lDate").value)})`, date: $("#lDate").value });
      $("#fAnswers").value = "";
      $("#followCard").classList.remove("hidden");
    } catch (err) { showError(card, err.message || err); }
    finally { btn.disabled = false; }
  });

  $("#fGenerate").addEventListener("click", async () => {
    if (!lessonConv) return;
    const ans = $("#fAnswers").value.trim();
    const card = $("#fOutCard");
    if (!ans) { card.classList.remove("hidden"); $(".output", card).innerHTML = `<div class="empty-state">Add your answers first. Even a few words each is enough.</div>`; return; }
    const btn = $("#fGenerate"); btn.disabled = true;
    setLoading(card, "Completing the record from your observations");
    try {
      const msgs = lessonConv.messages.concat([{ role: "user", content: FOLLOWUP_INSTRUCTION + "\n\nTEACHER'S ANSWERS:\n" + ans }]);
      const md = await callAI(lessonConv.system, msgs, 2500);
      showResult(card, md, { type: "lesson-record", grade: lessonConv.grade, title: `${lessonConv.topic} (taught ${fmtDate(lessonConv.date)})`, date: lessonConv.date });
    } catch (err) { showError(card, err.message || err); }
    finally { btn.disabled = false; }
  });

  // ================= 03 TEACHING JOURNAL =================
  const LOG_KEY = "classroom-compass-portfolio-v1";
  let memLog = [];
  function loadLog() { try { const r = localStorage.getItem(LOG_KEY); return r ? JSON.parse(r) : memLog; } catch (e) { return memLog; } }
  function storeLog(list) { memLog = list; try { localStorage.setItem(LOG_KEY, JSON.stringify(list)); } catch (e) {} $("#logCount").textContent = list.length; }
  function saveEntry(e) { const list = loadLog(); list.unshift({ id: Date.now().toString(36), saved: new Date().toISOString(), ...e }); storeLog(list); }
  const KIND = { recap: "Recap", "lesson-plan": "Plan", "lesson-record": "Taught", generic: "Workflow", worksheet: "Worksheet" };
  function renderLog() {
    const f = $("#logFilter").value;
    const list = loadLog().filter(e => !f || e.grade === f);
    $("#logList").innerHTML = list.length ? "" : `<p class="log-empty">Nothing saved yet. Use “Save to Teaching Journal” on any output.</p>`;
    list.forEach(e => {
      const d = document.createElement("details");
      d.className = "dd log";
      d.innerHTML = `<summary><span class="kind">${KIND[e.type] || "Note"}</span><span class="grow">${esc(e.title || "Untitled")}</span><span class="meta">${esc(e.grade || "")} · saved ${new Date(e.saved).toLocaleDateString()}</span></summary>
        <div class="dd-body"><div class="row-btns" style="margin:0 0 10px"><button class="btn-sm" data-a="copy">Copy</button><button class="btn-sm" data-a="dl">Download .md</button><button class="btn-sm" data-a="del">Delete</button></div><div class="out-holder"></div></div>`;
      d.addEventListener("toggle", () => { if (d.open && !d._r) { renderSections(e.md, $(".out-holder", d), e.title); d._r = 1; } });
      $(".row-btns", d).addEventListener("click", ev => {
        const a = ev.target.dataset.a;
        if (a === "copy") copyText(e.md, ev.target);
        if (a === "dl") download(`${e.type}-${(e.grade || "").replace(/\s+/g, "")}-${e.id}.md`, e.md);
        if (a === "del" && confirm("Delete this entry from the log?")) { storeLog(loadLog().filter(x => x.id !== e.id)); renderLog(); }
      });
      $("#logList").appendChild(d);
    });
  }
  $("#logFilter").innerHTML += GRADES.map(g => `<option>${g}</option>`).join("");
  $("#logFilter").addEventListener("change", renderLog);
  $("#logExportMd").addEventListener("click", () => {
    const list = loadLog(); if (!list.length) return;
    download(`tech-time-teaching-journal-${new Date().toISOString().slice(0, 10)}.md`, "# Tech Time with Mrs. Hana — Teaching Journal\n\n" + list.map(e => `---\n\n**${KIND[e.type] || "Note"} · ${e.grade || ""} · ${e.title || ""}** (saved ${new Date(e.saved).toLocaleDateString()})\n\n${e.md}`).join("\n\n"));
  });
  $("#logExportJson").addEventListener("click", () => download(`tech-time-teaching-journal-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(loadLog(), null, 2), "application/json"));
  $("#logImport").addEventListener("change", ev => {
    const file = ev.target.files[0]; if (!file) return;
    file.text().then(t => {
      try { const inc = JSON.parse(t); if (!Array.isArray(inc)) throw 0; const ids = new Set(loadLog().map(e => e.id)); storeLog(loadLog().concat(inc.filter(e => e && e.md && !ids.has(e.id)))); renderLog(); }
      catch (e) { alert("That file isn't a Classroom Compass backup."); }
    });
  });

  // ================= QUICK WORKFLOWS (original) =================
  let currentWorkflow = "lesson";
  function applyWorkflow(key) {
    currentWorkflow = key;
    const w = workflows[key];
    $("#eyebrow").textContent = w.eyebrow; $("#title").textContent = w.title; $("#desc").textContent = w.desc;
    $("#topicLabel").textContent = w.topicLabel; $("#topic").placeholder = w.topicPlaceholder;
    $("#durationField").style.display = w.showDuration ? "flex" : "none";
  }
  $("#generateBtn").addEventListener("click", async () => {
    const card = $("#gOutCard"), grade = $("#grade").value, topic = $("#topic").value.trim(), notes = $("#notes").value.trim();
    if (!topic) { $(".output", card).innerHTML = `<div class="empty-state">Please add a topic or focus before generating.</div>`; return; }
    const w = workflows[currentWorkflow];
    const system = GENERIC_PREAMBLE + "\n\nAdditional context: this teacher's classes are 20 minutes; K-2 use iPads only, 3-5 use Chromebooks. Do not introduce student AI accounts for K-5.\n\n" + w.systemTask;
    const user = `Grade: ${grade}\n${w.showDuration ? "Session length: " + $("#duration").value : ""}\nTopic/focus: ${topic}\n${notes ? "Additional context: " + notes : ""}`;
    const btn = $("#generateBtn"); btn.disabled = true;
    setLoading(card, "Drafting standards-aligned material");
    try {
      const md = await callAI(system, [{ role: "user", content: user }], 1600);
      showResult(card, md, { type: "generic", grade, title: `${w.title}: ${topic}` });
    } catch (err) { showError(card, err.message || err); }
    finally { btn.disabled = false; }
  });

  // ---------- init ----------
  renderLibrary(); renderTopicLibrary();
  $("#rGrade").value = "Kindergarten"; onRecapGrade();
  fillPlanSelect(); syncTools(); renderAlignPreview();
  storeLog(loadLog());
  applyWorkflow("lesson");

  // shared helpers for worksheet.js
  window.CC = { $, $$, esc, inline, mdToHtml, callAI, copyText, download, saveEntry, showView, caChip, isteChip, cseChip, fmtDate, GRADES };
})();
