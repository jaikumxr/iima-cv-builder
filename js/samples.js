/* samples.js — two demonstration CVs, one per heading style.

   The people, employers and numbers here are invented. They exist to exercise
   every structural feature the builder supports, so a rendering regression
   shows up in the dev harness before it reaches anyone's real CV:

     dark  — Ink theme, org/role bars, one year per group, no connector
     light — Slate theme, heading bar folded into the org bar, a vertical
             connector spanning two sub-headings, one year per bullet

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

/* ========================================================================
   DARK — Ink theme. Near-black heading bars, white text.
   ======================================================================== */

export const SAMPLE_DARK = {
  version: 1,
  theme: {
    id: 'ink', autoMetrics: true,
    density: 'normal', border: 'thin', cols: defaultColumns()
  },
  layout: 'product',
  header: { name: 'Arjun Mehta', program: 'PGP 26014', gender: 'Male', age: '25' },
  contact: {
    phone: '+91 98100 00000',
    address: 'Dorm 14 Room 08, IIM Ahmedabad, Vastrapur, Ahmedabad, 380 015',
    email: 'p26arjun@iima.ac.in'
  },
  sections: [
    sec('work', 'Professional Experience', 'experience', {
      showYear: false,
      entries: [
        mkEntry(
          'Zeptonic Systems Private Limited (30 Months) – Product Analyst II (PPO-UG)',
          '(June 2021 – December 2023)',
          [
            G('Business Impact', [
              'Grew monthly active users from 40,000 to 310,000 by **rebuilding onboarding** for the merchant app',
              'Drove INR 18 Cr+ in **annualised recurring revenue** through a usage-based pricing tier launched in 2022',
              '**Cut checkout drop-off by 34%** by removing 3 redundant steps found in session-replay analysis',
              'Expanded coverage to 240+ cities by **localising** the catalogue flow into 6 regional languages'
            ]),
            G('Initiatives', [
              '**Reduced page load time by 45%** by migrating the storefront to server-side rendering with caching',
              'Launched a **self-serve refunds console**, deflecting 60% of support tickets within 4 months of release',
              'Shipped an **A/B testing framework** adopted by 5 squads, cutting experiment setup from 2 weeks to 2 days',
              '**Prototyped a recommendations widget** that lifted average order value by 12% in a 90-day pilot',
              'Introduced **weekly funnel reviews**, surfacing 20+ defects previously reported only by customers'
            ]),
            G('Responsibilities', [
              '**Promoted** from Associate to Product Analyst II **within 14 months** for **sustained delivery**',
              'Owned the **merchant payouts roadmap** end to end, from discovery through launch and post-release review',
              'Wrote and groomed 200+ **user stories**, holding a **95% sprint completion rate** across 8 quarters',
              '**Ran discovery interviews** with 45+ merchants to shape the 2023 catalogue and inventory roadmap',
              'Defined **success metrics and guardrails** for every launch, reviewed monthly with the leadership team'
            ]),
            G('Collaboration', [
              '**Coordinated** across engineering, design, risk and operations to ship 12 releases without a rollback',
              '**Mentored 4 analysts** on SQL and experiment design; two were promoted within the following year',
              'Presented **quarterly business reviews** to the founding team and to two external investor groups',
              'Built **shared dashboards** that became the single source of truth for 3 partner teams across the org',
              'Partnered with **Legal and Compliance** to clear 15+ feature reviews ahead of regulatory deadlines'
            ])
          ]
        )
      ]
    }),

    sec('internship', 'Internship Experience', 'experience', {
      showYear: false,
      entries: [
        mkEntry(
          'Zeptonic Systems Private Limited (5 Months) – Product Intern',
          '(January 2021 – June 2021)',
          [
            G('Merchant Tools', [
              '1/6 selected out of 220+ applicants for the programme | Received **Pre-placement offer (UG)**',
              'Built an **internal pricing simulator** in Python, later used by 3 teams for quarterly rate reviews',
              '**Analysed 2 years** of transaction data to size a INR 40 Cr opportunity in tier-2 merchant lending'
            ])
          ]
        ),
        mkEntry(
          'Nimbus Analytics Labs (2 Months) – Data Engineering Intern',
          '(May 2020 – July 2020)',
          [
            G('Project details', [
              '**Designed and shipped** an **automated reporting pipeline** cutting a 6-hour manual task to 15 minutes'
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
          '1/18 selected out of 190 applicants as a member of the **Consult Club** of IIM Ahmedabad',
          '**Authored 3 casebooks** and ran 25+ mock interviews for the incoming batch ahead of placements'
        ], '2026'),
        G('Placement Committee', [
          '**Managed relationships** with 30+ recruiting firms across technology and consulting verticals',
          '**Coordinated 60+ interview slots** across 3 days, achieving zero scheduling conflicts on the day',
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
        G('Case Competitions', ['**Finalists** out of 340+ teams at a national product management case competition'], '2025'),
        G('CAT 2025', [
          '**CAT 99.72 %ile** | DILR 99.31 %ile, VARC 99.02 %ile and QA 98.8 %ile across 3 sections',
          '**Received admission offers** from 5 IIMs including Ahmedabad, Bangalore and Calcutta'
        ], '2025')
      ]
    }),

    sec('extracurricular', 'Extra-Curricular Achievements', 'list', {
      showYear: true,
      blocks: [
        G('Marathon', ['**Completed 3 half-marathons**, with a personal best of 1 hour 48 minutes in 2023'], '2023'),
        G('Chess', [
          '**Winners** of the inter-hostel chess championship, playing board 1 across all 6 rounds',
          '**Rated 1750** on the national circuit | Runners-up at the state university championship'
        ], '2022'),
        G('Volunteering', [
          '**Taught mathematics** to 40+ students at a community learning centre over 2 academic years',
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
   LIGHT — Slate theme. Mid-grey heading bars, black small caps.
   Exercises the inline heading bar, the vertical connector and per-bullet
   years, none of which the dark sample uses.
   ======================================================================== */

export const SAMPLE_LIGHT = {
  version: 1,
  theme: {
    id: 'slate', autoMetrics: true,
    density: 'tight', border: 'thin',
    // from "Fit to content": a long detail string and a wide score cell, so
    // the School column gives up ~17mm to pay for both
    cols: { ...defaultColumns(), label: 28.5, eduInst: 48, eduScore: 20.5, year: 8.6 }
  },
  layout: 'consulting',
  header: { name: 'Ananya Iyer', program: 'PGP 26127', gender: 'Female', age: '24' },
  contact: {
    phone: '+91 90000 00000',
    address: 'Dorm 31 Room 22, IIM Ahmedabad',
    email: 'p26ananya@iima.ac.in'
  },
  sections: [
    sec('work', 'Professional Experience', 'experience', {
      inlineBar: true,
      showYear: false,
      entries: [
        mkEntry(
          '(38 Months) – Senior Analyst, Meridian Industrial Group (PPO)',
          "(Jul'21-Sep'24)",
          [
            G('Leadership', [
              '**Spearheaded** a 9-member cross-plant team delivering a **cost transformation** programme in 2023',
              '**Led** the rollout of 4 quality standards adopted across 6 manufacturing sites within 18 months',
              '**Conducted 12+ design reviews** with suppliers and devised contingency plans for critical parts',
              '**Managed audit compliance** for 7+ failure-mode analyses in both AIAG and VDA reporting formats',
              '**Single Point of Contact** for intellectual property risk evaluation across 3 product families'
            ]),
            G('Business Impact', [
              '**Reduced Rs. 92 lakhs/yr** in spend through light-weighting and material substitution on 2 products',
              'Achieved **Rs. 51 lakhs/yr** in warranty savings by **improving durability rating from 5.4 to 7.1**',
              'Implemented **process improvements** saving **Rs. 24 lakhs/year** and cutting line rejection by 38%',
              '**Generated Rs. 47 lakhs/yr** in value by consolidating 3 supplier contracts into a single tender',
              '**Lowered cost by Rs. 14.60/unit** by resolving a recurring leak defect on an export product line'
            ]),
            G('Achievements', [
              'Recognised as **Runner-up** for the ‘**Best Collaborator Award**’ across the 2021 graduate cohort',
              '**Runner-up** in an internal design competition for a modular remote inspection platform prototype',
              '**Filed 5 patents**, including 2 international filings, covering cylinder head and block geometry',
              'Certified as a **Project Management Associate (Level D)** by the international certifying body'
            ]),
            mkCluster('Responsibilities', [
              G('Execution & Coordination', [
                '**Coordinated** 8+ new product programmes and 15+ engineering change requests across 3 plants',
                '**Handled bottom-up planning** for the team, aligning weekly priorities with programme milestones',
                '**Executed delivery tracking** across the lifecycle of 5+ cost, regulatory and quality projects',
                '**Responsible** for stage-wise progress tracking of 170+ parts within the functional sub-system',
                '**Coordinated with suppliers** on requirement release and stage-wise drawing approvals each cycle'
              ]),
              G('Validation & Risk', [
                '**Standardised 4+ validation processes** across 7+ programmes involving high-performance variants',
                '**Conducted 5+ freedom-to-operate evaluations** for infringement risk and proposed resolutions',
                '**Formulated a test-power matrix** for 7+ projects capturing critical failure modes for new tech',
                'Ran literature surveys and industry scans, and set up 3+ in-house validation rigs with suppliers'
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
          ['**Semi-Finalist** in a national strategy case competition | 1/25 teams among 190 participants', '2026'],
          ['**1/40 out of 150 teams** in an inter-IIM operations case competition judged by industry partners', '2025'],
          ['**Finalists** in a sustainability case competition run jointly by three business schools', '2025']
        ]),
        GY('IIMA Clubs', [
          ['**1/22 selected** among 74 applicants for the Operations Club | 1/4 in the Research Cell', '2026'],
          ['**Member** of the Public Speaking Club, involved in hosting events and running workshops', '2025'],
          ['**Member** of the Environment and Sustainability student-run interest club of IIM Ahmedabad', '2025']
        ]),
        GY('Sports', [
          ['**Winners** of the inter-batch swimming event | **1/10** selected to represent the batch', '2026'],
          ['**Runners-up** in the inter-batch futsal competition | **1/10** selected for the squad', '2025'],
          ['**Winners** of a regional junior football challenge with the school representative team', '2014']
        ]),
        GY('University Teams', [
          ['Secured an **overall rank of 9/72** across India in a national student design competition', '2019'],
          ['Placed **4th in sales**, **4th in design validation** and **10th in cost** across 72 teams', '2019']
        ]),
        G('Debate', ['**Runner-up** in the Hindi debate and a consolation prize in the English elocution contest'], '2014')
      ]
    }),

    sec('scholastic', 'Scholastic Achievements', 'list', {
      showYear: true,
      blocks: [
        G('CAT 2025', ['**CAT 99.72 %ile** | DILR 99.31 %ile, VARC 99.02 %ile and QA 98.8 %ile across 3 sections'], '2025'),
        GY('School', [
          ['Ranked in the **Top 10** of the science stream, with an overall **9th** rank out of 64 students', '2017'],
          ['**5-time academic excellence award** recipient for consistent performance across 4 academic years', '2017'],
          ['**Certificate of Merit** from the regional education society, awarded across 14 member schools', '2015']
        ])
      ]
    }),

    sec('projects', 'Projects and Internships', 'list', {
      showYear: true,
      blocks: [
        GY('Meridian Industrial', [
          ['**Developed a 30-parameter comparison** of 8+ coating materials and 14+ deposition methods', '2021'],
          ['**Received a PPO** following an integrated internship on surface coating and characterisation', '2021']
        ]),
        G('Helix Research', ['**Optimised engine calibration** on a virtual dyno to cut emissions with minimal torque loss'], '2020')
      ]
    }),

    sec('interests', 'Interests', 'interests', {
      label: 'Hobbies',
      items: ['Running', 'Ukelele', 'Watercolours']
    })
  ]
};

export const SAMPLES = {
  dark:  { label: 'Arjun Mehta — Ink (dark headings)', data: SAMPLE_DARK },
  light: { label: 'Ananya Iyer — Slate (light headings)', data: SAMPLE_LIGHT }
};
