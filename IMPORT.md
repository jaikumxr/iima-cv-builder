# Bringing an existing CV in

There is no PDF or Word import button, and this file is the reason there does
not need to be one. Give ChatGPT, Claude or Gemini the prompt below and your
existing CV, and it will write the file that **Import** reads.

A worked example inside the prompt is what does the work — the assistant can
see every field it needs rather than being described one. That is why the
instructions are eight lines and a sample file rather than ten pages of schema.

## What to do

Press **Import** in the builder and it walks you through this, with a button
for the first step.

1. Press **Copy the prompt**.
2. Open ChatGPT, Claude or Gemini. Paste it, and attach your CV.
3. It replies with one JSON block. Save it as `my-cv.json`. (Notepad will do.
   Make sure the name ends in `.json` and not `.json.txt`.)
4. Back in the builder, press **Choose file**. (Leave this dialog open while
   you are away and it is waiting for you.)

If the file has a problem, the builder tells you exactly what and where, and
nothing is imported — your current CV is untouched. Press **Copy report**,
paste it back into the same chat, and ask for a corrected file.

Your CV comes across word for word: the assistant is told to change nothing, so
an imported CV often runs past one page. That is the honest starting point.
Cutting is yours to do — you know which point matters and an assistant does
not — and the builder shows you what to cut, exactly as it does for a CV typed
in by hand.

> **One thing to know before you start.** Attaching your CV to ChatGPT, Claude
> or Gemini sends it to that company. The builder itself never uploads
> anything, but this step is outside it. Your CV holds your phone number, your
> address and your email. If that matters to you, delete those three lines from
> the file you attach and type them into the builder yourself.

---

<!-- The heading on the next line is a parse target. index.html's Import dialog
     fetches this file and copies everything from it downwards, so that the
     prompt has exactly one copy. Renaming it breaks that button silently. -->

# Instructions for the assistant

Convert my CV, attached, into JSON in exactly the format of the example below.
Reply with the JSON only, which should be a downloadable JSON file, and nothing else.

- **Copy every bullet word for word.** Do not rewrite, shorten, summarise,
  merge, split or drop anything.
- Keep my sections in my order, with whatever my CV calls each one as `title`.
- Where my CV bolds something, wrap it in `**double asterisks**`. Leave numbers
  alone; they are bolded automatically.
- **Every piece of text needs quotes around it, including text that starts with
  `**`** — `"text": "**Led a team** of 9"`, never `"text": **Led a team** of 9"`.
- Give every `"id"` a value no other `"id"` in the file has.
- Include only the sections my CV has. `key` and `kind` must be a pair from
  this list, and nothing else:
  `work`, `internship` → `"experience"` · `education` → `"education"` ·
  `por`, `cocurricular`, `extracurricular`, `scholastic`, `projects`,
  `certifications` → `"list"` · `interests` → `"interests"`
- An `experience` section holds `entries`; a `list` section holds `blocks`; an
  `education` section holds `rows`; `interests` holds `items`. Content in any
  other place is dropped.
- A block's year is either `year`, one for the whole block, or `years`, one per
  bullet in the same order. Never both.

```json
{
  "version": 1,
  "layout": "custom",
  "header":  { "name": "John Doe", "program": "PGP 26014", "gender": "Male", "age": "25" },
  "contact": { "phone": "+91 98100 00000", "address": "Dorm 14 Room 08, IIM Ahmedabad", "email": "p26john@iima.ac.in" },
  "sections": [
    {
      "id": "s1", "key": "work", "title": "Professional Experience",
      "kind": "experience", "enabled": true, "showYear": false,
      "entries": [
        {
          "id": "e1",
          "org": "Zeptonic Systems Private Limited (30 Months)",
          "role": "Product Analyst II",
          "dates": "(June 2021 – December 2023)",
          "blocks": [
            {
              "id": "g1", "type": "group", "label": "Business Impact",
              "year": "", "years": [],
              "bullets": [
                { "id": "b1", "text": "Grew monthly active users from 40,000 to 310,000 by **rebuilding onboarding**", "mute": [] },
                { "id": "b2", "text": "**Cut checkout drop-off by 34%** by removing 3 redundant steps", "mute": [] }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "s2", "key": "education", "title": "Educational Background",
      "kind": "education", "enabled": true, "showYear": false,
      "rows": [
        { "id": "r1", "degree": "B.Tech. (ECE)", "institute": "Delhi Institute of Technology", "score": "8.42/10", "detail": "9/10 or higher in 14 courses", "year": "2021" },
        { "id": "r2", "degree": "Class XII", "institute": "Sunrise Public School, Delhi", "score": "94.2 %", "detail": "98/100 in Mathematics and Physics", "year": "2017" }
      ]
    },
    {
      "id": "s3", "key": "por", "title": "Positions of Responsibility",
      "kind": "list", "enabled": true, "showYear": true,
      "blocks": [
        {
          "id": "g2", "type": "group", "label": "Placement Committee",
          "year": "2025", "years": [],
          "bullets": [
            { "id": "b3", "text": "**Managed relationships** with 30+ recruiting firms", "mute": [] }
          ]
        },
        {
          "id": "g3", "type": "group", "label": "Case Competitions",
          "year": "", "years": ["2025", "2024"],
          "bullets": [
            { "id": "b4", "text": "**Finalists** out of 340+ teams at a national case competition", "mute": [] },
            { "id": "b5", "text": "**Semi-finalists** of an inter-business-school strategy contest", "mute": [] }
          ]
        }
      ]
    },
    {
      "id": "s4", "key": "interests", "title": "Interests",
      "kind": "interests", "enabled": true, "showYear": false,
      "label": "Hobbies",
      "items": ["Cycling", "Photography", "Chess"]
    }
  ]
}
```
