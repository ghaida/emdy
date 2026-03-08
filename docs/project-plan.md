# Emdy — Project Plan

## To Do

### User Research

The design brief captures initial desk research (Reddit, Apple Community, forums) that surfaces real pain points around Markdown readability for non-technical users. That research is a starting point, not a conclusion. Before investing further in features, distribution, and marketing, we need to pressure-test the core assumptions this product is built on. The following research tracks are structured around five strategic questions.

Existing evidence baseline: `docs/design-brief.md` § User Research, § Key Assumptions & Open Questions.

#### 1. Problem Validation — Is this truly a problem people have?

We have forum posts and anecdotal evidence that non-technical users struggle with `.md` files. What we don't have is a sense of *scale* or *severity*. Is this a recurring frustration or a once-a-year annoyance? Does it block real work, or do people shrug and ask for a PDF?

- [ ] **Intercept interviews (5–8 people)** — Find non-technical professionals who have received `.md` files in the last 3 months. Ask: How often does this happen? What did you do? How much time did you lose? Did it block anything? Rate the frustration 1–10. Recruit from Slack communities, LinkedIn, or personal network.
- [ ] **Survey: problem frequency and severity (target n=50+)** — Short screener survey distributed to non-technical knowledge workers. Key questions: Have you received a `.md` file in the past 6 months? How did you open it? How would you rate the experience? Would you install a dedicated app to solve this? Distribute via social media, relevant Slack/Discord communities, and direct outreach.
- [ ] **Deliverable: Problem Validation Brief** — Synthesize findings into a one-page summary: problem severity rating (hair-on-fire / real-but-manageable / mild-inconvenience), estimated frequency per user, growth trajectory, and go/no-go recommendation.
- **Decision gate:** If the problem is real but mild, reconsider positioning (utility vs. must-have). If it's not a real problem, stop here.

#### 2. Audience Definition — Who exactly has this problem?

The design brief proposes two audiences: non-technical professionals who receive `.md` files, and developers who want a quick previewer. These are hypotheses. Research should confirm, refine, or replace them.

- [ ] **Segment mapping from interview data** — Using the intercept interviews above, map respondents into distinct segments by: role, technical comfort, frequency of Markdown encounters, source of `.md` files (AI tools vs. developers vs. documentation), and context (work vs. personal).
- [ ] **Behavioral clustering** — From survey responses, identify natural groupings. Are there distinct "archetypes" beyond the two in the brief? Possible segments to test: PM/manager receiving developer docs, marketer getting AI-generated content, executive reviewing briefings, developer wanting a lightweight previewer, student encountering `.md` in coursework.
- [ ] **Context and motivation interviews (3–5 per top segment)** — For each confirmed segment, understand: Where are they when they encounter `.md` files? What device? What's the surrounding workflow? What triggers the need? What would "good enough" look like for them?
- [ ] **Deliverable: Audience Profiles** — 2–4 evidence-based audience profiles with: context, frequency, pain severity, current workarounds, willingness to adopt a new tool, and what "success" looks like for them. Replace the current Primary/Secondary audience framing in the design brief if findings diverge.
- **Decision gate:** If the primary audience turns out to be developers (not non-technical users), the product positioning, marketing, and feature set all shift.

#### 3. Solution Fit — Is a native macOS app the right form factor?

We assumed "native macOS desktop app" early. That assumption needs testing. The right solution might be a Quick Look plugin (zero-install), a browser extension (cross-platform), a web app (no download friction), a mobile app (if people receive `.md` on phones), or some combination.

- [ ] **Platform and context audit** — From interview and survey data, map where users encounter `.md` files: desktop (macOS vs. Windows vs. Linux), mobile, web (email attachments, Slack, Google Drive), IDE. If 60% of encounters happen in a browser context, a browser extension might matter more than a native app.
- [ ] **Competitive form factor analysis** — Catalog the form factors competitors use (native app, web app, browser extension, CLI tool, Quick Look plugin, VS Code extension). Note adoption patterns — which form factors gained traction and which didn't? Why?
- [ ] **Quick Look plugin evaluation** — macOS Quick Look is the zero-friction path: no app to open, just press Space in Finder. Evaluate: Would a high-quality Quick Look plugin solve 80% of the problem for 80% of users? What rendering limitations exist? Could Emdy ship *both* a standalone app and a QL plugin?
- [ ] **"Where do you read?" card sort (during interviews)** — Ask users to rank where they'd want Markdown rendering: Finder preview, standalone app, browser, phone, inside Slack/Teams, inside email. Identify the highest-value touchpoints.
- [ ] **Deliverable: Solution Fit Analysis** — One-page comparison of form factors against user needs, with a recommendation. Include: reach (how many users each form factor serves), friction (install/adoption cost), capability (what each form factor can and can't do), and strategic fit (what positions Emdy best long-term).
- **Decision gate:** If a Quick Look plugin or browser extension solves the core problem with less friction, the standalone app becomes a secondary play — or the product ships both.

#### 4. Feature Validation — Is the feature set right?

The current feature set was designed from assumptions about what a "Markdown reader" needs. Research should validate whether users actually want these features, and surface anything missing that could drive adoption.

- [ ] **Feature desirability testing (during interviews)** — Show the current feature list to interview participants. For each feature, ask: Would you use this? How often? Is this essential, nice-to-have, or unnecessary? Then ask the open question: What's missing? What would make you recommend this to a colleague?
- [ ] **Kano analysis (in survey)** — Include Kano-style questions for key features: How would you feel if Emdy had [feature]? How would you feel if it didn't? Categorize features as must-have, performance (more is better), delighter, or indifferent. Priority features to test: directory browsing, font switching, zoom, dark mode, export to PDF, copy as RTF, find in page, minimap.
- [ ] **Killer feature discovery** — Specifically probe for unmet needs: Do you ever need to *do* anything with the rendered content beyond reading? (Copy into a presentation? Share a specific section? Annotate? Search across multiple files?) Look for a feature that would shift Emdy from "nice to have" to "can't live without."
- [ ] **Feature usage analytics plan** — Define what instrumentation to add post-launch to track actual feature usage. Which features get used daily vs. never? This feeds Phase 2 prioritization.
- [ ] **Deliverable: Feature Validation Matrix** — Table mapping each current and proposed feature against: user demand (from interviews/survey), competitive differentiation, implementation cost, and recommendation (keep / cut / add / defer).
- **Decision gate:** If a killer feature emerges (e.g., "I need to share a rendered link with my team"), it could reshape the product. If users don't care about features like minimap or font switching, simplify.

#### Research operations

- [ ] **Recruit interview participants** — Build a screener and recruit 10–15 participants across target segments. Mix of non-technical professionals and developers. Prioritize people who have received `.md` files recently.
- [ ] **Synthesis workshop** — After data collection, consolidate all findings into a single research debrief. Update the design brief with validated (or invalidated) assumptions. Flag any strategic pivots.
- [ ] **Update design brief** — Revise `docs/design-brief.md` with research findings. Replace assumptions with evidence. Adjust audience definitions, scope, and positioning as needed.

### Emdy Share (paid)
- [ ] Web sharing — upload a rendered Markdown file and get a shareable URL
- [ ] Share backend service (hosting, storage, URL generation)
- [ ] Share UI in the Mac app (share button, link copy, manage shared files)
- [ ] Free/paid gating — share feature requires paid upgrade
- [ ] Pricing and purchase flow

### App Features (free)
- [ ] Register as default macOS handler for `.md` / `.markdown` (UTType in Info.plist + first-launch prompt)
- [ ] Drag-and-drop file opening (drop a `.md` file onto the app icon or window)
- [ ] Heading navigator sidebar — list all headings in the document, click to jump to any heading
- [ ] Anchor link handling — click a heading link to scroll within the document
- [ ] Remote image loading (fetch and display images referenced by URL)
- [ ] Image load failure — show alt text or placeholder
- [ ] Error state when a file can't be read (permissions, missing)
- [ ] Empty state when a directory has no Markdown files
- [ ] File-deleted notice when an open file is removed from disk
- [ ] License key system — validation, activation, and gating in-app
- [ ] User-facing help documentation (accessible from Help menu)

### Legal
- [ ] Draft EULA (End User License Agreement)
- [ ] Draft Terms of Use
- [ ] Draft Privacy Policy

### Licensing & Payments
- [ ] License key generation service
- [ ] Payment processing integration
- [ ] Email confirmation on purchase

### Distribution & Packaging
- [ ] Sparkle auto-update integration
- [ ] Appcast XML hosting setup
- [ ] DMG packaging and code signing
- [ ] Direct download website

### Polish & QA
- [ ] Test on macOS light and dark mode across all views
- [ ] Keyboard shortcuts audit and implementation (ensure all standard shortcuts work, add any missing)
- [ ] Accessibility pass (VoiceOver, keyboard navigation)
- [ ] Performance testing with large Markdown files
- [ ] Expand test coverage beyond `MarkdownRendererTests`

### Marketing & Launch
- [ ] Marketing site design and build (visual directions started in `visual-design.pen`)
- [ ] App icon design
- [ ] Screenshots and promotional assets

---

## Completed

### User Research
- [x] Desk research: quantify the pain — 25 sources documented in `docs/desk-research.md`
- [x] Competitive audit: direct competitors — full audit in `docs/competitive-landscape.md`
- [x] Competitive audit: indirect competitors — VS Code preview, GitHub rendering, pandoc, browser viewers
- [x] Competitive positioning map — Emdy's quadrant (simple + reading) has no strong incumbent
- [x] Pricing and business model survey — documented per competitor
- [x] Switching cost analysis — risks and opportunities documented
- [x] Competitive Landscape Report deliverable (`docs/competitive-landscape.md`)
- [x] Survey instrument designed (`docs/user-research-survey.md`) — 9 questions, ~2 min
- [x] Survey distributed and initial responses collected (n=6, March 2026) — findings in `docs/user-research-survey.md` § Findings

### Research & Planning
- [x] Design brief — product vision, audience, constraints, user research (`docs/design-brief.md`)
- [x] System architecture document and diagram (`docs/system-architecture.md`, `docs/architecture.pen`)
- [x] User journeys for all core scenarios (`docs/user-journeys.md`)
- [x] Service blueprint mapping frontstage, backstage, and support processes (`docs/service-blueprint.md`, `docs/service-blueprint.pen`)
- [x] App wireframes for all 7 screens (`docs/app-wireframes.pen`)
- [x] Visual design exploration — moodboards and 4 layout directions (`docs/visual-design.pen`)
- [x] CLAUDE.md with full project conventions and architecture reference

### Core App (Swift / SwiftUI)
- [x] macOS app scaffold — `@main` App struct with `DocumentGroup` for file handling
- [x] Markdown parsing and rendering (GFM via `NSAttributedString`)
- [x] GFM table rendering
- [x] Open and render single Markdown files
- [x] Directory browsing via sidebar (recursive, with expandable folders)
- [x] Sidebar width constrained to 200-320px (ideal 240)
- [x] Optimal content width — text capped at ~680px, centered, background fills window
- [x] Find in page (`Cmd+F`) with `NSTextFinder` integration
- [x] Minimap for document navigation (toggle via toolbar, click to jump, drag to scroll)
- [x] Syntax highlighting for fenced code blocks (Swift, Python, JS/TS, Go, Rust, Java/Kotlin, C/C++, Ruby, Bash, SQL, generic fallback)
- [x] Zoom in/out (`Cmd+` / `Cmd-`)
- [x] Font switcher — serif, sans-serif, monospace (IBM Plex Sans, Serif, Mono bundled as static TTFs)
- [x] Theme switcher — Light, Dark, System (dark palette is warm, Braun-inspired)
- [x] Copy selected text as RTF
- [x] Export as PDF (dedicated save dialog) and Print (standard macOS print dialog)
- [x] Open Recent / reopen last file
- [x] Relative `.md` link handling — navigate within Emdy
- [x] External link handling — open in default browser
- [x] Local image resolution (relative to document directory)
- [x] Display settings persisted to UserDefaults (font family, zoom, theme)
- [x] Color palette with semantic colors for light and dark modes
- [x] Status bar view
- [x] Toast notifications
- [x] Empty state view
- [x] Toolbar with consistent spacing (4px rhythm, `ControlGroup` wrapping, `toolbar(id:)`)

### Tests
- [x] Markdown renderer tests (`EmdyTests/MarkdownRendererTests.swift`)
- [x] Directory search model tests (`EmdyTests/DirectorySearchModelTests.swift`)
