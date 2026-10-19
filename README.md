# Classroom Compass — Tech Time with Mrs. Hana

An AI-powered, form-based teaching partner for K–5 technology education at Academy for Academic Excellence. Built from the **K–2** and **3–5 Technology Lesson Plans** (2025-26, updated for 2026-27: K–2 iPads, 3–5 Chromebooks, 20-minute classes).

*Think. Create. Stay Safe.*

## What's inside

| Tab | What it does |
|---|---|
| **00 Curriculum Library** | Opens to the whole year as month-by-month dropdowns for K–2 and 3–5, plus a dropdown for each teaching-history topic, with verified CA CS / ISTE / Common Sense alignments by grade. Any dropdown can be sent to a planner. |
| **01 Learning Recap** | Covers the start of the year through a chosen date (default 10/10/26). For each topic, mark *Not taught / Introduced / Started / Completed* and add anonymous evidence. Generates **A.** a ready-to-post Google Classroom recap · **B.** a 20-minute review lesson · **C.** a teacher documentation table · **D.** alignment and sources. |
| **02 Lesson + Portfolio** | Plans one 20-minute lesson and returns **A.** a teacher plan · **B.** a ready-to-post Classroom post · **C.** an assessment checklist and portfolio record · **D.** three after-class questions. Your answers then become a completed record, an 80–120-word recap, and the next lesson. |
| **03 Worksheet Maker** | Type a rough idea and **✨ Improve my request** turns it into a structured request, or pick any session from the year plan. Choose question types (10 kinds), supports (word bank, emoji cues, read-aloud, sentence starters, Spanish key words, large print) and Support / On-level / Challenge versions. You get: a **print-ready page** (Print → Save as PDF; a K–2 layout with big tap-to-circle choices and emoji self-checks), a **fill-in Google Doc (.docx)** with shaded answer boxes for Classroom's "Make a copy for each student", a separate **answer key**, a ready-to-post **Classroom assignment**, step-by-step posting instructions, and teacher notes with verified alignment. Ask for changes in plain words with **Revise**. You can view and copy the full prompt to reuse it anywhere. |
| **04 Portfolio Log** | Stores saved outputs in this browser only. Export to .md for your Drive evidence folder, or back up and restore as .json. |
| 05–10 Quick workflows | The original six Classroom Compass workflows, unchanged. |

## Accuracy and safety rules built in
- The AI can cite only the CA CS standards, ISTE indicators, and Common Sense lessons in `curriculum.js`. Each was checked against CDE and commonsense.org in October 2026. Anything else is labeled **needs verification**.
- Family-facing text never shows standard codes. Teacher and family sections stay separate and are labeled.
- The AI doesn't invent dates, quotes, results, or accomplishments, and fills gaps with `[placeholders]`.
- No student identifiers.
- No student AI accounts or direct AI instruction for K–5.
- A planned lesson is never described as taught.

## Files
- `index.html`, `styles.css`, `app.js`: the app
- `curriculum.js`: the year plan and verified alignment data (edit this to update your curriculum)
- `prompts.js`: system prompts for the recap and lesson/portfolio system
- `worksheet.js`: Worksheet Maker (prompt builder, print layout, built-in .docx writer with no external libraries)
- `workflows.js`: the original quick-workflow prompts
- `api/generate.js`: Vercel serverless proxy that keeps the API key server-side

## Deploy (Vercel)
Set `ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables. `ANTHROPIC_MODEL` is optional; the default is `claude-sonnet-4-6`.

## Sources
- CA Computer Science Standards (SBE adopted Sept 6, 2018): https://www.cde.ca.gov/BE/st/ss/computerscicontentstds.asp
- ISTE Standards for Students: https://iste.org/standards/for-students
- Common Sense Education Digital Literacy & Well-Being: https://www.commonsense.org/education/digital-literacy
