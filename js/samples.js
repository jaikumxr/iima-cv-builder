/* samples.js — two demonstration CVs, one per heading style.

   Everything here is invented: the people, the employers, the numbers, the
   achievements. Nothing is taken from a real CV and nothing should be. What
   the samples reproduce is the *format*, and they exist to exercise every
   structural feature the builder supports, so a rendering regression shows up
   in the dev harness before it reaches anyone's real CV:

     dark  — Ink theme, org/role bars, one year per group, no connector
     light — Slate theme, heading bar folded into the org bar, a vertical
             connector spanning two sub-headings, one year per bullet

   Two properties are deliberate, and worth preserving when editing:

   - **Bullets run close to the full column width.** A short bullet
     demonstrates nothing: the one-line-per-bullet rule and the tracking that
     enforces it only engage near the edge, so a sample full of half-length
     bullets would let that whole mechanism rot untested. The target is ~3mm of
     spare, and the width available depends on the section — a section showing
     years gives its bullets ~10mm less to work with.
   - **The page is close to full.** These are what a reader judges the format
     by, and a half-empty page misrepresents it.

   Neither is checked by eye. `dev/docx.html?sample=…&spares=1` lists every
   bullet's spare width in mm, sorted; after editing here, that spread should
   stay tight and `page used` should sit just under 297mm, with
   `bullets 0 of N wrap` and `flagged too long: 0`.

   `**...**` marks bold beyond what metric detection catches on its own —
   action verbs and noun phrases, matching how IIMA CVs are written. */

import { mkGroup, mkCluster, mkEntry, mkEduRow, mkSection, defaultColumns } from './schema.js';

const G = (label, lines, year = '') => {
  const g = mkGroup(label, lines);
  g.year = year;
  return g;
};

/* group carrying one year per bullet rather than one for the whole group */
const GY = (label, pairs) => {
  const g = mkGroup(label, pairs.map(p => p[0]));
  g.years = pairs.map(p => p[1]);
  return g;
};

const sec = (key, title, kind, patch) => Object.assign(mkSection(key, title, kind), patch);

/* An organisation, with its role beside its name rather than at the end of the
   argument list where mkEntry takes it. The role is a field of its own so the
   `split bar` toggle can centre it (schema.js barParts); with the toggle off —
   which is how both samples ship — it runs on after the organisation and reads
   exactly as though the two had been typed into one field. */
const E = (org, role, dates, blocks) => mkEntry(org, dates, blocks, role);

/* ========================================================================
   DARK — Ink theme. Near-black heading bars, white text.
   ======================================================================== */

export const SAMPLE_DARK = {
  version: 1,
  theme: {
    id: 'ink', autoMetrics: true,
    density: '1', border: 'thin', cols: defaultColumns()
  },
  layout: 'product',
  header: { name: 'John Doe', program: 'PGP 26014', gender: 'Male', age: '25' },
  contact: {
    phone: '+91 98100 00000',
    address: 'Dorm 14 Room 08, IIM Ahmedabad, Vastrapur, Ahmedabad, 380 015',
    email: 'p26john@iima.ac.in'
  },
  sections: [
    sec('work', 'Professional Experience', 'experience', {
      showYear: false,
      entries: [
        E(
          'Zeptonic Systems Private Limited (30 Months)',
          'Product Analyst II (PPO-UG)',
          '(June 2021 – December 2023)',
          [
            G('Business Impact', [
              'Grew monthly active users from 40,000 to 310,000 by **rebuilding onboarding** for the merchant app',
              'Drove INR 18 Cr+ of **annualised recurring revenue** through a usage-based pricing tier launched in 2022',
              '**Cut checkout drop-off by 34%** by removing 3 redundant steps found across 12,000 session replays',
              'Expanded coverage to 240+ cities by **localising** the catalogue and checkout flow into 6 regional languages',
              'Lifted 90-day retention from 41% to 58% by **rebuilding notifications** around declared user intent'
            ]),
            G('Initiatives', [
              '**Reduced median page load by 45%** by moving the storefront to server-side rendering with caching',
              'Launched a **self-serve refunds console** that deflected 60% of support tickets within 4 months of release',
              'Shipped an **A/B testing framework** adopted by 5 squads, cutting experiment setup from 2 weeks to 2 days',
              '**Prototyped a recommendations widget** that lifted average order value by 12% across a 90-day pilot',
              'Introduced **weekly funnel reviews**, surfacing 20+ defects that had previously been reported only by customers'
            ]),
            G('Responsibilities', [
              '**Promoted** from Associate to Product Analyst II **within 14 months** for a sustained record of delivery',
              'Owned the **merchant payouts roadmap** end to end, from discovery through launch and post-release review',
              'Wrote and groomed 200+ **user stories**, holding a **95% sprint completion rate** across 8 straight quarters',
              '**Ran discovery interviews** with 45+ merchants to shape the 2023 catalogue, pricing and inventory roadmap',
              'Defined **success metrics and guardrails** for every launch, reviewed each month with the senior leadership team'
            ]),
            G('Collaboration', [
              '**Coordinated** across engineering, design, risk and operations to ship 12 releases without a single rollback',
              '**Mentored 4 analysts** on SQL and experiment design; two of them were promoted the following year',
              'Presented **quarterly business reviews** to the founding team and to two external investor groups each cycle',
              'Built **shared dashboards** that became the single source of truth for 3 partner teams across the org',
              'Partnered with **Legal and Compliance** to clear 15+ feature reviews ahead of the regulatory deadlines'
            ])
          ]
        )
      ]
    }),

    sec('internship', 'Internship Experience', 'experience', {
      showYear: false,
      entries: [
        E(
          'Zeptonic Systems Private Limited (5 Months)',
          'Product Intern',
          '(January 2021 – June 2021)',
          [
            G('Merchant Tools', [
              '1/6 selected out of 220+ applicants for the summer programme | Received **Pre-placement offer (UG)**',
              'Built an **internal pricing simulator** in Python, later used by 3 teams for their quarterly rate reviews',
              '**Analysed 2 years** of transaction data to size a INR 40 Cr opportunity in tier-2 merchant lending markets'
            ])
          ]
        ),
        E(
          'Nimbus Analytics Labs (2 Months)',
          'Data Engineering Intern',
          '(May 2020 – July 2020)',
          [
            G('Project details', [
              '**Designed and shipped** an **automated reporting pipeline** cutting a 6-hour manual task down to 15 minutes',
              'Rewrote 12 **scheduled queries** to cut warehouse spend by 28% with no change to dashboard refresh times'
            ])
          ]
        )
      ]
    }),

    sec('education', 'Educational Background', 'education', {
      rows: [
        mkEduRow('B.Tech. (ECE)', 'Delhi Institute of Technology', '8.42/10', '9/10 or higher in 14 courses', '2021'),
        mkEduRow('Class XII', 'Sunrise Public School, Delhi', '94.2 %', '98/100 in Mathematics and Physics', '2017'),
        mkEduRow('Class X', 'Sunrise Public School, Delhi', '10/10', '10/10 GPA in 5/5 subjects', '2015')
      ]
    }),

    sec('por', 'Positions of Responsibility', 'list', {
      showYear: true,
      blocks: [
        G('Consult Club, IIMA', [
          '1/18 selected out of 190 applicants as a member of the **Consult Club** at IIM Ahmedabad',
          '**Authored 3 casebooks** and ran 25+ mock interviews for the incoming batch ahead of placements'
        ], '2026'),
        G('Placement Committee', [
          '**Managed relationships** with 30+ recruiting firms across the technology and consulting verticals',
          '**Coordinated 60+ interview slots** across 3 days, achieving zero scheduling conflicts on either day',
          'Negotiated **12 new roles** with first-time recruiters, expanding the shortlist pool for the batch'
        ], '2025'),
        G('Robotics Club Lead', [
          '**Led a 12-member team** to 2nd place out of 80 teams at a national inter-college robotics meet',
          'Raised INR 3.5 lakhs in **sponsorship** and managed the budget for the annual technical festival'
        ], '2020')
      ]
    }),

    sec('cocurricular', 'Co-Curricular Achievements', 'list', {
      showYear: true,
      blocks: [
        G('Case Competitions', [
          '**Finalists** out of 340+ teams at a national product management case competition, final round',
          '**Semi-finalists** of an inter-business-school growth strategy contest judged by 6 practitioners'
        ], '2025'),
        G('CAT 2025', [
          '**CAT 99.72 %ile** | DILR 99.31 %ile, VARC 99.02 %ile and QA 98.8 %ile across the 3 sections',
          '**Received admission offers** from 5 IIMs including Ahmedabad, Bangalore, Calcutta and Lucknow'
        ], '2025')
      ]
    }),

    sec('extracurricular', 'Extra-Curricular Achievements', 'list', {
      showYear: true,
      blocks: [
        G('Marathon', [
          '**Completed 3 half-marathons** across 2 seasons, with a personal best of 1 hour and 48 minutes'
        ], '2023'),
        G('Chess', [
          '**Winners** of the inter-hostel chess championship, playing board 1 across all 6 of the rounds',
          '**Rated 1750** on the national circuit | Runners-up at the state university championship final'
        ], '2022'),
        G('Volunteering', [
          '**Taught mathematics** to 40+ students at a community learning centre across 2 academic years',
          '**Raised INR 2 lakhs** for a school library drive by organising a campus-wide charity auction'
        ], '2019')
      ]
    }),

    sec('interests', 'Interests', 'interests', {
      label: 'Hobbies',
      items: ['Cycling', 'Photography', 'Chess', 'Jazz Piano']
    })
  ]
};

/* ========================================================================
   LIGHT — Slate theme. Mid-grey heading bars, black text.
   Exercises the inline heading bar, the vertical connector and per-bullet
   years, none of which the dark sample uses.
   ======================================================================== */

export const SAMPLE_LIGHT = {
  version: 1,
  theme: {
    id: 'slate', autoMetrics: true,
    density: '1', border: 'thin',
    // from "Fit to content": a long detail string and a wide score cell, so
    // the School column gives up ~17mm to pay for both
    cols: { ...defaultColumns(), label: 28.5, eduInst: 48, eduScore: 20.5, year: 8.6 }
  },
  layout: 'consulting',
  header: { name: 'Jane Doe', program: 'PGP 26127', gender: 'Female', age: '24' },
  contact: {
    phone: '+91 90000 00000',
    address: 'Dorm 31 Room 22, IIM Ahmedabad',
    email: 'p26jane@iima.ac.in'
  },
  sections: [
    sec('work', 'Professional Experience', 'experience', {
      inlineBar: true,
      showYear: false,
      entries: [
        E(
          '(38 Months)',
          'Senior Analyst, Meridian Industrial Group (PPO)',
          "(Jul'21-Sep'24)",
          [
            G('Leadership', [
              '**Spearheaded** a 9-member cross-plant team delivering a **cost transformation** programme through 2023',
              '**Led** the rollout of 4 quality standards adopted across all 6 manufacturing sites within 18 months',
              '**Conducted 12+ design reviews** with suppliers and devised contingency plans for all the critical parts',
              '**Managed audit compliance** for 7+ failure-mode analyses in both the AIAG and VDA reporting formats',
              '**Single point of contact** for intellectual property risk evaluation across 3 whole product families'
            ]),
            G('Business Impact', [
              '**Reduced Rs. 92 lakhs/yr** in spend through light-weighting and material substitution on 2 product lines',
              'Achieved **Rs. 51 lakhs/yr** in warranty savings by **improving the durability rating from 5.4 up to 7.1**',
              'Implemented **process improvements** saving **Rs. 24 lakhs/year** and cutting the line rejection rate by 38%',
              '**Generated Rs. 47 lakhs/yr** in value by consolidating 3 supplier contracts into one single tender',
              '**Lowered cost by Rs. 14.60/unit** by resolving a recurring leak defect on a high-volume export line'
            ]),
            G('Achievements', [
              'Recognised as **Runner-up** for the ‘**Best Collaborator Award**’ across the whole 2021 graduate cohort',
              '**Runner-up** in an internal design competition for a modular remote plant inspection platform prototype',
              '**Filed 5 patents**, including 2 international filings, covering cylinder head and engine block geometry',
              'Certified as a **Project Management Associate (Level D)** by the international certifying body'
            ]),
            mkCluster('Responsibilities', [
              G('Execution & Coordination', [
                '**Coordinated** 8+ new product programmes and 15+ engineering change requests across all of the 3 plants',
                '**Handled bottom-up planning** for the team, aligning weekly priorities against programme milestones',
                '**Executed delivery tracking** across the whole lifecycle of 5+ cost, regulatory and quality projects',
                '**Responsible** for stage-wise progress tracking of 170+ parts within the functional sub-system group',
                '**Coordinated with suppliers** on requirement release and stage-wise drawing approvals within each cycle'
              ]),
              G('Validation & Risk', [
                '**Standardised 4+ validation processes** across 7+ programmes involving the high-performance variants',
                '**Conducted 5+ freedom-to-operate evaluations** for infringement risk and proposed workable resolutions',
                '**Formulated a test-power matrix** across 7+ projects, capturing the critical failure modes for new tech',
                'Ran literature surveys and industry scans, and set up 3+ in-house validation rigs alongside suppliers'
              ])
            ])
          ]
        )
      ]
    }),

    sec('education', 'Educational Background', 'education', {
      rows: [
        mkEduRow('B. Tech', 'Coastal Institute of Technology', '8.71/10', '32/56 courses: Highest grade (10/10) or A grade (9/10)', '2021'),
        mkEduRow('Class XII', 'Harbour Public School, CBSE', '95%', '>90% in 5/5 subjects and >=95% in 3/5 subjects', '2017'),
        mkEduRow('Class X', 'Harbour Public School, CBSE', '10/10 CGPA', '10 GPA in 5/5 subjects', '2015')
      ]
    }),

    sec('cocurricular', 'Co-Curricular and Extra-Curricular Activities', 'list', {
      showYear: true,
      blocks: [
        GY('Case Competitions', [
          ['**Semi-finalist** in a national strategy case competition | 1/25 teams among 190 total participants', '2026'],
          ['**1/40 out of 150 teams** in an inter-IIM operations case competition judged by 6 industry partners', '2025'],
          ['**Finalists** in a sustainability case competition run jointly by three of the leading business schools', '2025']
        ]),
        GY('IIMA Clubs', [
          ['**1/22 selected** among 74 applicants for the Operations Club | 1/4 in the Research Cell annual intake', '2026'],
          ['**Member** of the Public Speaking Club, involved in hosting events and running weekly workshops', '2025'],
          ['**Member** of the Environment and Sustainability student-run interest club of IIM Ahmedabad campus', '2025']
        ]),
        GY('Sports', [
          ['**Winners** of the inter-batch swimming event | **1/10** selected to represent the batch as a squad', '2026'],
          ['**Runners-up** in the inter-batch futsal competition | **1/10** selected for the batch squad of 10', '2025'],
          ['**Winners** of a regional junior football challenge, representing the school team across 5 rounds', '2014']
        ]),
        GY('University Teams', [
          ['Secured an **overall rank of 9/72** across India in a national student design competition, 72 teams', '2019'],
          ['Placed **4th in sales**, **4th in design validation** and **10th in cost** across all 72 of the competing teams', '2019'],
          ['**Led the chassis sub-team** of 8, delivering the frame 3 weeks ahead of the build schedule', '2018']
        ]),
        G('Debate', [
          '**Runner-up** in the Hindi debate and a consolation prize in the English elocution contest, 2 finals'
        ], '2014')
      ]
    }),

    sec('scholastic', 'Scholastic Achievements', 'list', {
      showYear: true,
      blocks: [
        G('CAT 2025', [
          '**CAT 99.72 %ile** | DILR 99.31 %ile, VARC 99.02 %ile and QA 98.8 %ile across the 3 sections'
        ], '2025'),
        GY('School', [
          ['Ranked in the **Top 10** of the science stream, with an overall **9th** rank out of the 64 students', '2017'],
          ['**5-time academic excellence award** recipient for consistently strong results across 4 academic years', '2017'],
          ['**Certificate of Merit** from the regional education society, awarded across its 14 member schools', '2015']
        ])
      ]
    }),

    sec('projects', 'Projects and Internships', 'list', {
      showYear: true,
      blocks: [
        GY('Meridian Industrial', [
          ['**Developed a 30-parameter comparison** of 8+ coating materials and 14+ vapour deposition methods', '2021'],
          ['**Received a PPO** following an integrated internship on surface coating and characterisation work', '2021'],
          ['**Benchmarked 6 competitor assemblies** on cost and mass, feeding the 2022 design brief', '2021']
        ]),
        GY('Helix Research', [
          ['**Optimised engine calibration** on a virtual dyno to cut emissions with minimal loss of peak torque', '2020'],
          ['Built a **1D thermal model** of the cooling circuit, validated to within 4% of the measured rig data', '2020']
        ])
      ]
    }),

    sec('interests', 'Interests', 'interests', {
      label: 'Hobbies',
      items: ['Running', 'Ukelele', 'Watercolours']
    })
  ]
};

export const SAMPLES = {
  dark:  { label: 'John Doe — Ink (dark headings)', data: SAMPLE_DARK },
  light: { label: 'Jane Doe — Slate (light headings)', data: SAMPLE_LIGHT }
};
