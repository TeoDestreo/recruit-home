TEST ENVIRONMENT (recruit-home)
-------------------------------
This repo is a test copy of TeoDestreo/advancedCPE-home. LMS/wrangler.toml points at the
Pages project "recruit-home" and the D1 database advancedcpe-lms-test
(fdbc1e0e-50c8-42dd-84aa-e9724ac7f802), a copy of production. The R2 bucket binding still
names the production bucket advancedcpe-r2. The record below describes production.

Added in the test environment (October 6, 2026), not yet in production:
- Installable app: manifest, icons, offline page and an "Install app" button (LMS/pwa/).
- Email confirmation: new accounts confirm their email (24-hour link) before courses,
  coupons or checkout. Accounts that existed before migration 0015 count as confirmed.
  Admins can mark a learner confirmed under Learners & results. Needs CF_EMAIL_API_TOKEN;
  without it, signup still works but no confirmation email can be sent.
- Coupon codes: created and managed in the admin console (Coupon codes tab), each with
  its own access length, optional use limit and last redemption day. The original
  FREE_ACCESS_CODE_HASH code still works alongside them.
- Captions and transcripts: upload .vtt/.srt captions and/or a .txt transcript per video
  course in the course editor. Stored in D1 (course_captions), not R2.
- CPE credits: each learning item has a CPE credits value (default 1) set in the course
  editor. Certificates record the value when issued and print it.
- Receipts: My account lists PayPal purchases with a printable receipt page, and a
  receipt email is sent once when a payment is confirmed (if email is configured).
Migrations 0015-0018 must be applied to the production database before deploying these.
Production also has 0014_unified_learning_items.sql (a learning_modules table), applied on
October 6 from code that is not on GitHub yet; this copy of the code does not include it.
Tests: node LMS/test-features.mjs (plus the existing test-*.mjs files).

ADVANCED CPE LMS - SETUP AND DEPLOYMENT RECORD
=============================================
Updated: October 5, 2026

CURRENT STATUS
--------------
The catalog is public; an account is not required to browse. Seven subject categories
group 28 coded listings: 13 video courses and 15 free reading topics. The nonprofit
track is NFP-101 through NFP-116; the law-firm track is LAW-101 through LAW-112.
Missing-video listings are now useful reading guides, not advertised video lessons.
The 13 uploaded videos retain their original internal IDs (course-4 through -16).
No legal/CLE/CPE credit approval is claimed for reading topics or certificates.
Accounts alone do not grant course access. Paid access is enforced by the server.
Pricing: $100 USD for one year of video library access, paid once with no automatic
renewal. An instructor coupon also grants one year of access.
PayPal checkout is enabled. The owner saved encrypted production credentials,
the site was redeployed, and live PayPal OAuth authentication passed. No real
purchase/capture has been tested yet. The full-discount coupon unlocks the library
without payment. Only its SHA-256 hash is stored as a Cloudflare secret, not in Git
or public assets. Signed-in users redeem it on the enrollment screen.
Existing users were not automatically grandfathered into paid access. Existing
issued certificates remain accessible to their owner.
Signup now requires Cloudflare Turnstile and server-side token verification.

Project: D:\GitHub Sync\advancedCPE-home
Public homepage: https://advancedcpe.com/
Login / learning library: https://advancedcpe.com/LMS/
Cloudflare Pages project: advancedcpe-home
Cloudflare Pages domain: https://advancedcpe.pages.dev
D1 database: advancedcpe-lms
D1 database ID: 04c8ea27-cfe6-4704-9558-02d4143a4261
R2 bucket: advancedcpe-r2
Database binding: DB
Storage binding: COURSE_STORAGE
Static asset binding: ASSETS (provided by Pages)
Git remote: https://github.com/TeoDestreo/advancedCPE-home.git
Production branch: main

INITIAL SETUP - COMPLETED
-------------------------
1. Install Node.js LTS from https://nodejs.org/en/download
   Node supplies npm/npx, which runs Cloudflare Wrangler. Reopen PowerShell.
   Use npx.cmd on Windows to avoid PowerShell's npx.ps1 script-policy restriction.

2. Open PowerShell in the project and authorize Wrangler:
   cd "D:\GitHub Sync\advancedCPE-home"
   npx.cmd wrangler login
   npx.cmd wrangler whoami
   Authorization completes in the browser. Never put account tokens in Git.

3. Create the D1 database and R2 bucket in Cloudflare (names/ID above).
   LMS/wrangler.toml now configures the existing Pages project and both bindings.
   Pages runs the backend Worker on the same domain as the website.

4. Create the initial D1 tables using the local SQL file:
   npx.cmd wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --remote --file=./LMS/schema.sql
   The original tables were users, courses, enrollments, and certificates.

5. Verify remote tables:
   npx.cmd wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

LMS BUILD STEPS - COMPLETED
---------------------------
1. Project organization
   The root homepage has Browse courses linking to /LMS/ and Login to /LMS/?login=1.
   All LMS source, schema, migrations, config, tests, and local videos are under LMS.
   Generated state, build output, secrets, and MP4 files are excluded from Git.

2. Database structure
   Applied LMS/migrations/0001_auth_progress.sql to remote D1.
   Added password hashes, case-insensitive unique emails, expiring sessions,
   progress, unique learner/course certificates, certificate snapshot fields,
   and a trigger requiring completed enrollment before certificate issuance.
   Apply pending migrations with:
   npx.cmd wrangler d1 migrations apply advancedcpe-lms --config=./LMS/wrangler.toml --remote
   Wrangler records applied files in d1_migrations. Do not execute numbered
   migrations manually. Fresh databases need schema.sql followed by migrations.

3. Course videos in R2
   Uploaded 13 videos totaling 3,695,969,276 bytes in Standard storage.
   All remote files matched their local sizes and SHA-256 checksums.
   Sources: LMS/Courses/course 4.mp4 through course 16.mp4 (original case retained).
   R2 object keys:
   courses/course-4.mp4
   courses/course-5.mp4
   courses/course-6.mp4
   courses/course-7.mp4
   courses/course-8.mp4
   courses/course-9.mp4
   courses/course-10.mp4
   courses/course-11.mp4
   courses/course-12.mp4
   courses/course-13.mp4
   courses/course-14.mp4
   courses/course-15.mp4
   courses/course-16.mp4
   Example upload:
   npx.cmd wrangler r2 object put advancedcpe-r2/courses/course-4.mp4 --config=./LMS/wrangler.toml --remote --file="./LMS/Courses/course 4.mp4" --content-type=video/mp4
   Verify every upload (streams remote data into a hash without saving copies):
   node LMS/verify-course-uploads.cjs

4. Course catalog
   Applied 0002_playback.sql and seeded all 13 course records into remote D1.
   Titles now come from the supplied PPTX/DOCX filenames. Subject categories were
   assigned from those titles; level remains Not specified. CPE credits await input.
   LMS/catalog-metadata.sql contains the 16 titles, categories, and descriptions.
   Courses 1-3 have no asset key or duration until MP4s are supplied.
   Hours are 0 (unassigned), not displayed as credit. Duration comes from MP4 headers.
   Generate seed from the local videos and apply it:
   node LMS/prepare-catalog.cjs
   npx.cmd wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --remote --file=./LMS/seed-courses.sql
   npx.cmd wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --remote --file=./LMS/catalog-metadata.sql
   Reruns preserve edited titles/descriptions; only paths and durations update.

5. Real login
   Registration, login, logout, and seven-day server sessions are implemented.
   Passwords: PBKDF2-SHA256, 100,000 iterations, random salt per account.
   Sessions: random cookie tokens, SHA-256 hashes in D1, HTTPS Secure/HttpOnly/
   SameSite=Lax cookies with the __Host- prefix. All mutations require same-origin
   JSON. Attempts are throttled by hashed IP and email.
   Email verification and password recovery are not implemented in this version.
   Turnstile widget: Advanced CPE Signup, managed mode.
   Allowed domains: advancedcpe.com and advancedcpe.pages.dev.
   Public site key: 0x4AAAAAAFJdJbhQ4uUyGTnd (LMS/wrangler.toml).
   Private key: TURNSTILE_SECRET, stored as a Cloudflare Pages production secret.
   Provision/replace the secret securely (never commit it):
   npx.cmd wrangler pages secret put TURNSTILE_SECRET --cwd=LMS --project-name=advancedcpe-home
   Signup validates success, hostname, and the signup action through Cloudflare
   Siteverify. Missing/failed/expired tokens block signup; outages fail closed.
   No production bypass or test key is enabled. Turnstile is rendered only on signup.

6. D1/R2 integration
   Public /api/courses returns published catalog metadata, grouped/sorted by
   category and course number. Progress appears only for the current session user.
   Video/start/progress routes require both authentication and active paid access.
   Applied migration 0003_paid_access.sql to remote D1. course_access stores a
   learner, optional course (NULL means library access), unique payment reference,
   expiration, and revocation. No browser route can create these access records.
   PayPal capture verification and the instructor coupon now grant these records.
   Access can be revoked using revoked_at; certificate ownership is preserved.
   The backend streams private R2 MP4s with Range and HEAD support only after access
   checks. New certificate issuance requires access plus completion; existing
   certificate reads remain available to their owner even if access expires.
   Cloudflare credentials and arbitrary storage access are never sent to browsers.

7. Progress and completion
   Resume position and watched coverage save every 10 seconds, on pause and exit.
   Unique watched intervals are merged, so replay does not inflate completion.
   Server checks elapsed time, rejects large seek jumps, and supports up to 2x
   playback. One active playback token per learner/course avoids conflicting tabs.
   Hidden pages pause video. At least 95% unique watched coverage unlocks the test.
   New completion requires a passing test; watching alone no longer completes it.
   Completion dates persist. Tracking is playback telemetry, not proof of attention
   or a determination of professional CPE accreditation requirements.

8. Certificates
   Passing the course test automatically creates one certificate per learner/course
   in D1. A score OVER 70% is required: 8/10 passes; 7/10 fails. Three submitted
   attempts are allowed per learner/course. Existing certificates are preserved.
   Repeat requests return the original ID and original learner/title/date snapshot.
   Completed cards and the player offer View certificate. The learner can print
   or use the browser's Save as PDF. The certificate endpoint checks ownership.
   No CPE credit hours are claimed until course credit information is supplied.
   Certificate HTML/CSS/JS are in LMS/certificate.*.

9. Production deployment and testing
   Deployed to the existing advancedcpe-home Pages project on September 26, 2026.
   First full LMS deployment: https://4ee898b9.advancedcpe.pages.dev
   Production aliases: https://advancedcpe.com and https://advancedcpe.pages.dev
   The homepage Login link opens the working LMS on the same domain.
   Cloudflare Git build settings:
     Root directory: LMS
     Build command: node build.cjs
     Output directory: dist
   LMS/wrangler.toml uses pages_build_output_dir="./dist".
   The build copies only the homepage, six LMS assets, and backend _worker.js.
   Pages executes _worker.js as backend code; it is not served as a static asset.
   MP4 sources, SQL, tests, and credentials are excluded from the deployed website.

   Repeatable deployment commands, run from the repository root:
   node LMS/test-backend.mjs
   node LMS/build.cjs
   npx.cmd wrangler pages deploy --cwd=LMS --project-name=advancedcpe-home --branch=main

   Tests passed:
   - In-memory database/API: passwords, CSRF, session expiry/logout, account
     isolation, throttling, byte ranges, seek rejection, watch coverage, completion.
   - Certificates: incomplete-course rejection, automatic issue, duplicate
     prevention, name/title snapshots, and ownership checks.
   - Local browser: login, catalog/search, actual MP4 playback, saved progress
     after reload, and certificate layout with synthetic local completion data.
   - Live site: homepage/Login, D1 health, register/login/logout, 13-course catalog,
     authenticated ranges from ALL 13 R2 videos, progress writes, certificate gate.
   The original September 26 live test covered paid-video functionality before
   the access model changed. Current September 29 checks cover public catalog,
   category order, 16 listings/13 available videos, coming-soon status, protected
   video/start routes, and rejection of signup without Turnstile.
   Current live smoke-test command:
   node LMS/test-live.mjs https://advancedcpe.com
   This does not create accounts or grant paid access. A rejected synthetic signup
   checks the security gate. No production completion, certificate, or payment is
   fabricated. Unit tests mock Siteverify and payment records in memory only.
   Browser checks confirmed public category groups, enrollment paywall, and the
   real Turnstile widget loading successfully. No CAPTCHA was manually solved.

10. README and Git
   This document is the running setup record. Update it alongside future changes.
   Source belongs on main in the configured origin; videos remain in R2/local disk.
   Review git status before staging so credentials or videos are never included.
   git add .gitignore index.html LMS README-SETUP.txt
   git commit -m "Describe the LMS change"
   git push origin main

11. PayPal checkout and instructor coupon (September 30)
   Migration: LMS/migrations/0004_checkout.sql adds checkout_orders, binding every
   PayPal order and capture to its learner. Run:
   npx.cmd wrangler d1 migrations apply advancedcpe-lms --config=./LMS/wrangler.toml --remote
   POST /api/checkout/create sets the price on the server to USD 100.00 and sends
   the learner to PayPal. On return, /api/checkout/capture checks order ownership,
   completed capture, exact amount/currency, and the server's custom reference.
   A browser return URL alone never grants access. Stable capture request IDs
   and unique access references make confirmation retries idempotent.
   POST /api/checkout/coupon requires a session and same-origin request, validates
   the exact case-sensitive code server-side, and rate-limits guessing. One code
   can be shared with multiple learners; redemption is repeat-safe per learner.
   Coupon and PayPal grants cover the entire library, including later additions.
   Videos for courses 1-3 are still missing and remain Coming soon.

   Cloudflare production secret already configured: FREE_ACCESS_CODE_HASH.
   Never place the plaintext coupon or merchant secrets in source/public files.
   To rotate the coupon, securely compute SHA-256 of the new case-sensitive code
   (with surrounding whitespace trimmed), then save the hex hash with:
   npx.cmd wrangler pages secret put FREE_ACCESS_CODE_HASH --cwd=LMS --project-name=advancedcpe-home
   Rotation does not remove access already granted to learners.

   PAYPAL CREDENTIAL SETUP (COMPLETED; retained for future rotation):
   Create/select a LIVE REST app belonging to the owner's PayPal merchant account
   at https://developer.paypal.com/dashboard/applications/live . Store its values
   as Cloudflare Pages production secrets (enter through the prompts, not Git):
   npx.cmd wrangler pages secret put PAYPAL_CLIENT_ID --cwd=LMS --project-name=advancedcpe-home
   npx.cmd wrangler pages secret put PAYPAL_CLIENT_SECRET --cwd=LMS --project-name=advancedcpe-home
   Never paste the Secret into chat. PAYPAL_ENV defaults to live; sandbox is only
   for isolated testing using sandbox credentials and PAYPAL_ENV=sandbox.
   Rebuild/redeploy after setting secrets:
   node LMS/build.cjs
   npx.cmd wrangler pages deploy --cwd=LMS --project-name=advancedcpe-home --branch=main
   /api/config exposes readiness booleans and price, never credentials/code.
   Live credential authentication has passed. An actual buyer approval/capture
   has NOT been tested; unit tests mock order/capture flows without charging money.
   Verification completed: in-memory API tests cover invalid/valid/repeated and
   revoked coupons, coupon throttling, PayPal ownership, server-set price, wrong
   amount/reference rejection, and recovery after a lost capture response. Live
   smoke checks confirmed coupon readiness, $100 USD configuration, and anonymous
   checkout rejection. Browser verified the public enrollment price/login gate.

   Current operations limitation: no PayPal refund/dispute webhook is configured.
   Refunds/reversals require owner review and manual revocation of the matching
   course_access record (payment_reference is paypal:<capture_id>), setting
   revoked_at to unixepoch(). Do not revoke unrelated grants, such as a coupon.
   Completed PayPal payments are recovered by retrying confirmation on the return
   page. If the learner closes it before confirmation, support can locate their
   order in checkout_orders and have them sign in and revisit:
   https://advancedcpe.com/LMS/?checkout=return&token=<paypal_order_id>
   The backend rechecks PayPal; support must never grant based on a screenshot.

12. Public website and open registration (September 30)
   Rebuilt the homepage to describe actual available topics, with no invented
   testimonials, instructor credentials, approval status, or company history.
   Added /about/, /contact/, /pricing/, /how-it-works/, /faq/, /privacy/, and
   /law-firm-accounting/. Contact phone: 916-500-0508 (click-to-call).
   Contact uses the supplied phone, not an unconnected form or invented email.
   Public page sources live in LMS/site-pages.cjs and LMS/site.css; the homepage
   source remains index.html. LMS/build.cjs emits the explicitly allowed assets.
   Privacy is an operational description of implemented data handling, not a
   legal-compliance certification. The owner should review it for their business.

   Dedicated signup URL: https://advancedcpe.com/LMS/register.html
   Required: first/last name, email, password, country, and Turnstile verification.
   Optional: organization, role, city, state/province, phone, designation, license
   number/jurisdiction. No professional license is required to register.
   Updates checkbox defaults off. Consent preference/time are saved; no mailing
   service is connected. Account creation remains separate from paid access.
   Profile fields are stored in user_profiles, not returned in the public catalog.
   Existing accounts remain valid without requiring retroactive profile entries.

   Migration 0005_profiles_iolta.sql adds user_profiles and course outlines 17-20:
   - IOLTA & Client Trust Accounting Foundations
   - Client Ledgers, Deposits & Disbursements
   - Three-Way Trust Account Reconciliation
   - Trust Accounting Controls & Recordkeeping
   All four have NULL video keys and zero duration/credit hours. No lessons are
   invented. When the owner supplies videos, add assets, duration, and approved
   metadata through a separate migration/import. Jurisdiction-specific rules need
   qualified review before course publication. Reference source:
   https://www.calbar.ca.gov/legal-professionals/maintaining-compliance/client-trust-accounting-iolta/client-trust-account-guidelines-attorneys
   Apply and publish using the same migration/build/deploy commands above.
   Tests cover profile validation/storage, optional license data, opt-in consent,
   private fields, and IOLTA coming-soon playback rejection.
   Live smoke checks verified all new pages and the 20-course catalog. Browser
   checks verified homepage layout and the registration fields, unchecked updates
   preference, and Turnstile loading. Cloudflare normalizes /LMS/register.html to
   /LMS/register; the app handles both. Built LMS CSS/JS links carry content hashes
   to prevent stale browser assets after a deployment.

   PayPal security handoff completed: the owner saved PAYPAL_CLIENT_ID and
   PAYPAL_CLIENT_SECRET directly as encrypted production secrets. Previously
   pasted credentials were not copied from chat into source or Cloudflare by the
   agent; rotation was recommended. Secret values and rotation were not inspected.
   Redeployment activated checkout. Live OAuth authentication passed through the
   deployed backend. No purchase, order, or capture was created during this check.
   GET /api/checkout/status is authenticated and rate-limited; it checks OAuth and
   returns only readiness, never an access token or merchant credential.
   Re-run the connection check from the project root with:
   node LMS/test-paypal-live.mjs
   It uses existing Wrangler authorization to create an isolated synthetic account
   and short-lived session, calls the status endpoint, then deletes those exact
   temporary records. The initial run passed and removed its temporary records.

13. Site polish, topic library, and articles
   Added an original navy/lime A+ SVG favicon across all built pages. Added an
   original AI-generated editorial workspace image (not actual company premises).
   Asset files and the exact built-in generation prompt are in LMS/assets/.
   Refreshed the homepage, responsive navigation, topic cards, and public page
   layout. New pages: /articles/ (four full articles), /learning-paths/,
   /certificates/, /support/, and fifteen /topics/<slug>/ reading guides.
   All public unfinished-course notices were removed. The law-firm page now
   provides twelve free topic guides rather than implying paid videos exist.
   Reading topics have no progress, certificate, or payment requirement.
   Existing videos retain all original enrollment/progress/certificate links.

   Migration 0006_topic_library.sql adds stable course_code and topic_path fields
   and eight more law-firm topics. NFP = nonprofit, LAW = law-firm accounting.
   LMS search accepts the codes; format filters distinguish videos and readings.
   /sitemap.xml and /robots.txt are generated. CSS and LMS script URLs are content-
   versioned to avoid stale browser assets. Assets remain explicitly allowlisted.

   Research references (structure only; original writing and imagery):
   https://www.accountingtools.com/cpe/ — categorized course catalog, articles, FAQ.
   https://www.lawpay.com/support/resources/ — guides and practice resources.
   The California State Bar trust-account resource is linked in relevant law-firm
   reading material as jurisdiction-specific guidance, not a nationwide standard.
   No copied articles, fictitious testimonials, accreditation claims, instructor
   biographies, or new binding refund/terms commitments were introduced.
   Content source: LMS/editorial.cjs; page templates/content: LMS/site-pages.cjs.
   Validation: node LMS/test-backend.mjs; node LMS/build.cjs;
   node LMS/test-site.mjs; node LMS/test-live.mjs https://advancedcpe.com
   The build test checks every local link/asset and all 34 HTML pages for favicon
   presence and absence of unfinished-course notices.
   Live smoke checks passed for all public pages, reading routes, and assets.
   Browser review verified homepage image/layout and filtering the LMS to the
   twelve LAW-coded reading topics. No account data or payments were changed.

14. Course tests and certificate requirements (October 1, 2026)
   Every published video course (NFP-104 through NFP-116; course-4 through
   course-16) has a ten-question, course-specific multiple-choice test. Questions
   are based on that course's audio companion script, particularly slides 6, 7,
   12 and 15. The reading topics remain free reference material, without tests
   or certificates. No professional credit approval is claimed.

   Learner rules:
   - Watch at least 95% of unique video coverage before starting a test.
   - A score OVER 70% passes: 8/10 (80%) or better; 7/10 does not pass.
   - Up to three complete, submitted attempts per learner per course.
   - Opening/resuming a test does not count as a submission. Unsubmitted browser
     selections are not saved when leaving the test; the question order resumes.
   - After submission, display score/pass-fail and remaining attempts only.
     No submitted selections, answer review, or correct-answer key is returned.
   - Question and option order are shuffled for each new attempt. The server
     keeps a frozen question snapshot so later edits do not alter its grading.
   - Three unsuccessful attempts lock further tests for that learner/course;
     no automatic reset, fourth attempt, or certificate is provided.
   - Passing records completion and issues one printable certificate. Existing
     certificates issued before this change are preserved; old completions
     without an issued certificate must meet the new test requirement.

   D1 migration: LMS/migrations/0007_course_tests.sql
   Tables: course_quizzes (private bank), quiz_attempts (private snapshots,
   version, attempt number, submission time, score and pass/fail).
   Submitted answer selections are not stored. Submitted results are immutable.
   Database triggers enforce the passing-test gate for new certificates.
   Server-side grading ignores client-supplied scores. An atomic submission
   update and unique learner/course/attempt number make retries safe.

   Private authoring file: LMS/private/quiz-bank.cjs
   Generated import: LMS/private/quiz-seed.sql
   The entire LMS/private directory is ignored by Git and excluded from the
   deployment asset allowlist. Keep a secure backup; do not publish answer keys.
   D1 holds the production question bank. Never add keys to LMS/app.js.
   To revise questions, edit the private bank and increment the course version.
   Existing attempt snapshots and the learner's three-attempt count remain intact.

   Commands from D:\GitHub Sync\advancedCPE-home:
   node LMS/prepare-tests.cjs
   node LMS/test-backend.mjs
   node LMS/test-exams.mjs
   node LMS/build.cjs
   node LMS/test-site.mjs
   npx.cmd wrangler d1 migrations apply advancedcpe-lms --config=./LMS/wrangler.toml --remote
   npx.cmd wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --remote --file=./LMS/private/quiz-seed.sql
   npx.cmd wrangler pages deploy --cwd=LMS --project-name=advancedcpe-home --branch=main --commit-dirty=true
   node LMS/test-live.mjs https://advancedcpe.com
   Check each command succeeds before proceeding to the next deployment step.

   Validation: backend regression tests and focused assessment tests cover all
   thirteen courses, access/watch/CSRF gates, hidden answer keys, exact 70/80
   boundaries, incomplete submissions, ownership, three-attempt lockout, login
   persistence, frozen grading, concurrent requests, retry safety, certificate
   creation and preservation of existing certificates. Local browser verification
   used an in-memory synthetic learner: a 70% failure left two attempts, an 80%
   pass issued a certificate, and the printable certificate rendered correctly.
   No real learner attempt or payment was used for those tests.
   Production: migration 0007 applied and all 13 tests / 130 questions imported
   into advancedcpe-lms. Verified no published video lacks a test. Deployment
   https://c8795e18.advancedcpe.pages.dev is live at https://advancedcpe.com.
   Public smoke checks passed, including protected assessment endpoints and
   absence of private question-bank/source files from public responses.

   Optional repeatable UI preview (isolated in-memory data; never production):
   node LMS/build.cjs
   node LMS/test-ui-server.mjs
   Open http://127.0.0.1:8791/LMS/ . Synthetic questions have clearly labeled
   correct/incorrect options for UI QA only. Stop the preview with Ctrl+C.
   This test server is excluded from the deployed site.

15. Admin dashboard and Lumi activities (October 2, 2026)
   Admin page: https://advancedcpe.com/LMS/admin
   Administrator: matt@fogler.pro, using the existing account and password.
   The Admin dashboard link appears after sign-in for authorized administrators.
   Administrator roles are assigned by user ID in D1, never by signup input.
   Both the page and all admin APIs require an authenticated administrator.

   Courses tab:
   - Create a draft, set its stable course code/category/title/description, and
     save it before uploading media. Upload an MP4, enter ten test questions
     and their correct options, then publish. Drafts stay out of the catalog.
   - MP4 uploads go directly through the site to R2 in retried 8 MiB parts,
     up to 2 GiB per video. Keep the tab open until the upload finishes.
   - Initial release prevented replacing existing videos. Section 17 supersedes
     that restriction with explicit source replacement and progress handling.
   - Editing questions creates a new question-bank version. Started attempts
     retain their original snapshots; editing does not reset attempt counts.
   - Learners & results shows recent accounts and submitted scores/certificates,
     not submitted answer selections. Lists are limited to 200 recent learners
     and 300 results per learner. Account/role management and attempt-reset UI
     are not included in this release.

   Lumi workflow (author on your computer; upload through the admin page):
   1. Build an activity in Lumi and save/export a .h5p package with its libraries.
      HTML exports and SCORM ZIP files are not accepted by this uploader.
   2. Open the course in the admin dashboard and upload the .h5p package.
   3. Preview and finish the ENTIRE activity. The dashboard must confirm that
      completion tracking was verified before it can be made mandatory.
   4. Attach it as optional practice, or choose Require before test.
   5. Learners must finish a required activity AND watch 95% of the video before
      starting/submitting the final test. Existing certificates are preserved.
      The final test still allows three submitted attempts, requires OVER 70%,
      and returns only score/pass-fail, without an answer review.

   Compatibility and limits:
   - Uses bundled h5p-standalone 3.8.2; this is not an embedded Lumi editor.
     No separate editor server is required. Packages need to be self-contained;
     external embeds/scripts are blocked. Not every H5P content type reports
     whole-activity completion, which is why preview verification is mandatory.
   - Completion must be a top-level completed/answered/passed xAPI event with
     completion=true. Opening an activity or completing one sub-question is
     insufficient. A representative H5P True/False package was browser-tested.
   - Activity practice may show feedback configured in Lumi. Do not place final
     exam answer keys in an H5P package; the final exam stays server-graded.
   - Upload limits: 60 MiB compressed, 128 MiB expanded, 16 MiB per file,
     2,000 files. Large videos belong in the MP4 uploader, not inside H5P.
   - Full completion persists in D1; partially finished activity state is not
     restored after closing it. Launch links expire after two hours: reopen
     the activity if the session expires.
   - Replacing an attached package creates a new completion requirement for
     future tests. Earlier certificates remain valid records of completion.
   - Incomplete uploads are not attached to courses. If one fails, upload again;
     a stale-upload cleanup/resume interface is a future improvement.

   Security and storage:
   Uploaded videos and immutable activity packages live in advancedcpe-r2, not
   Git. File manifests/checksums and package dependencies are validated before
   activation. H5P runs in an opaque-origin sandbox without LMS cookie/storage
   access. Short-lived hashed launch tokens bind user, course and package.
   Admin mutations check role and origin; changes are recorded in admin_audit.
   Activity completion is client-reported, not a proctored or cheat-proof exam.

   Build notes & Lumi guide tab contains this entire README, delivered only by
   the authenticated admin API. It is embedded in the server build, not a public
   static file. Never add passwords, API secrets or private answer keys here.

   D1 migration: LMS/migrations/0008_admin_activities.sql
   Tables: admins, admin_audit, media_uploads, media_parts, activity_packages,
   activity_files, course_activities, activity_launches, activity_completions.
   Courses also gain an admin_revision field and unique non-null course codes.
   Production migration 0008 has been applied. The existing matt@fogler.pro
   account was explicitly granted the administrator role; no signup/password
   change was needed and no other account was granted administrator access.
   Initial production release: https://5b379ded.advancedcpe.pages.dev, served at
   https://advancedcpe.com. Public smoke checks passed, including denial of
   unauthenticated admin notes/courses/results and invalid activity launch links.
   Local browser QA verified a real H5P upload, preview verification, required
   activity locking the test, saved learner completion, and test unlocking.
   Synthetic QA data and the sample activity were not uploaded to production.

   Install/build/check commands from D:\GitHub Sync\advancedCPE-home:
   npm.cmd ci --prefix LMS --ignore-scripts
   node LMS/test-backend.mjs
   node LMS/test-exams.mjs
   node LMS/test-admin.mjs
   node LMS/build.cjs
   node LMS/test-site.mjs
   npx.cmd wrangler d1 migrations apply advancedcpe-lms --config=./LMS/wrangler.toml --remote
   npx.cmd wrangler pages deploy --cwd=LMS --project-name=advancedcpe-home --branch=main --commit-dirty=true
   node LMS/test-live.mjs https://advancedcpe.com
   Cloudflare Pages builds from LMS using package-lock.json and node build.cjs.
   Dependencies are pinned: fflate 0.8.3, h5p-standalone 3.8.2, esbuild 0.28.2.
   Player/decompression license notices ship with the vendor assets.

   IMPORTANT: The section 14 quiz-seed import is a legacy initial-setup step.
   Do not rerun it on production after editing tests in the dashboard: it can
   overwrite your edited question banks. Use the dashboard for ongoing edits.
   Back up D1 and R2 separately; a Git backup does not contain uploaded courses.

   Future work, not included: in-browser Lumi authoring, email verification,
   coupon-management UI, attempt-reset UI, pagination and stale-upload cleanup.
   Public professional-credit approval is not claimed.

16. Password policy and administrator recovery (October 4, 2026)
   Passwords now allow 8–128 characters in both the server and the sign-in /
   registration form. Salted PBKDF2 hashing and login throttling are unchanged.
   Boundary regression tests reject 7 and 129 characters and exercise account
   registration/sign-in with an 8-character password.
   An administrator-assisted reset replaces only the designated account's hash
   and revokes its existing sessions. Never record passwords in these notes.
   Self-service reset is documented in step 17 below.

17. YouTube hosting and video replacement (October 4, 2026)
   Admin dashboard > Courses > Edit course > Video now supports either a
   YouTube link or an uploaded MP4. Existing courses remain on their existing
   sources until an administrator explicitly saves a change.

   YouTube: upload the video to your own YouTube channel, enable embedding,
   choose public or unlisted visibility, paste the single-video URL, enter its
   full duration in seconds, choose progress handling, and Save YouTube link.
   Supported HTTPS URL forms: youtube.com/watch?v=ID, youtu.be/ID, /embed/ID,
   and /shorts/ID. Channel/playlist-only links and other hosts are rejected.
   Live/private/age- or region-restricted videos may not embed. Test your own
   video from the learning library before directing learners to it.

   YouTube does NOT provide private paid-course hosting: an unlisted URL can
   be shared and watched elsewhere. LMS enrollment still gates the course page,
   tracking, activities, exams and certificates. Use R2 if the video itself
   must remain behind LMS access checks. No YouTube API key is required.
   The embedded IFrame API supplies position/state to existing progress tracking;
   watch in the LMS, not on youtube.com. The 95% watch requirement still applies.
   The API is loaded only when opening an authorized YouTube lesson. The page
   discloses YouTube hosting and links to Google's privacy policy.

   MP4 replacement: choose the progress option, select a new file, and click
   Upload / replace MP4. The old source remains active until all upload parts
   finish and the new source is attached. This also switches a YouTube course
   back to an uploaded video. File limits are unchanged (2 GiB, 8 MiB parts).

   Progress choices (required for changing an existing source):
   - Same lesson and duration: preserve watch progress. Only use for the same
     content; old/new durations must match within one second.
   - Different lesson: archive then reset watch progress. Existing certificates,
     enrollment completion records, test questions and three-attempt counts stay
     intact. New/unfinished tests require watching the replacement video.
   Both choices invalidate active playback tokens so learners reopen the course.
   Previously attached Lumi activities remain attached; review their relevance.

   Migration 0009_video_sources.sql adds courses.youtube_id, upload revision/
   progress-mode fields, video_history and video_progress_archive. Old R2 objects
   are retained (and still use storage); recovery is possible through database
   history, not a restore/delete dashboard yet. Atomic revision checks prevent a
   stale upload or concurrent admin edit from overwriting a newer source.
   Backend URL/role/paid-access checks and replacement regression tests are in
   LMS/test-admin.mjs. Run all test suites/build, apply migration 0009 remotely,
   deploy, and run the public smoke checks using the commands in section 15.
   Reference: https://developers.google.com/youtube/iframe_api_reference
   Visibility: https://support.google.com/youtube/answer/157177
   Validation: backend suites cover link/source changes and preserved/reset
   progress. LMS/test-youtube-player.mjs checks adapter callbacks and teardown.
   Local browser verified source editing and the learner error state; external
   YouTube playback did not finish loading in that browser. Verify playback
   with the first real instructor video before switching production courses.

18. Course management and learner accounts (October 4, 2026)
   Reference reviewed: LearnDash Core and User Profiles (official documentation).
   https://learndash.com/support/kb/styling/getting-started-with-learndash/core/
   https://learndash.com/support/kb/core/uncategorized/user-profiles/
   This remains the existing Cloudflare LMS, not a WordPress installation or a
   claim of full LearnDash feature parity.

   Admin > Courses now has search, Published/Drafts/Trash filters and course
   counts. Each video course has a prominent Upload / replace video shortcut.
   To add: Add video course > save draft details > upload MP4 or set YouTube
   source > enter ten questions > publish. Existing tests, activities and video
   source editing remain in the same editor. Reading guides are reference pages,
   not video slots; create a video course for a new video lesson.

   Delete moves the selected course to Trash after its course code is typed.
   It unpublishes the course without deleting videos, tests, certificates, access
   records or progress. Restore as draft makes it editable again; publish it
   explicitly when ready. Free static topic-guide articles are independent of
   catalog listings and remain public. Permanently erasing historical records
   or storage is deliberately not an ordinary course-delete action.
   Migration: 0010_accounts_course_trash.sql (courses.deleted_at and an index).

   My account: https://advancedcpe.com/LMS/account
   Click your name in the learning library, admin header or public-page header.
   Any registered user can edit their own name, organization, role, city, region,
   country, phone, professional designation/license fields and updates preference.
   First/last name and country are required. Sign-in email is read-only; email
   changes still require support. Admin role and paid access cannot be changed
   through profile input. Changes affect future certificates, not issued copies.

   Membership & access shows live D1 entitlements: active, expired or revoked,
   full-library versus course-only access, and expiration when applicable.
   There is no recurring subscription: $100 is a one-time payment for one year
   of video library access, or one year is granted by coupon. Access expires
   one year after payment or coupon redemption; no automatic renewal is used.
   My learning shows progress and course links; My certificates retains links
   even if the originating course has been unpublished or moved to Trash.
   All personal data comes from authenticated no-store APIs. Public HTML never
   contains learner profile data. POST updates require a same-origin request.
   Login responses now include the admin flag immediately, fixing the previously
   missing admin link until page refresh.

   LMS feature coverage:
   Implemented: course catalog/categories/search, draft/publish/edit/trash/restore,
   uploaded or linked videos, learner progress, Lumi prerequisites, course exams,
   certificates, paid/coupon access, learner result views, account/profile/access
   dashboard, and private administrator documentation.
   Not included in this release: multi-lesson drag-and-drop curricula, drip
   schedules, assignment uploads/manual grading, discussion forums, group seats,
   recurring billing, automated email campaigns, a mobile app, or every plugin
   add-on. These require separate product decisions and additional builds.

   Validation: tests cover profile ownership, CSRF, required fields, consent,
   role/email protection, entitlement status, trash/restore revisions and record
   preservation. Local browser QA verified editing a synthetic learner profile,
   clickable names, search, upload shortcut, moving a course to Trash and restoring
   it as a draft. No real learner profile or production course was changed by QA.
   README and this private admin copy are rebuilt together on deployment.

18. Self-service password reset with Cloudflare Email Service (October 4, 2026)
   The LMS now has a "Forgot your password?" flow. It stores only a SHA-256 hash
   of a one-use reset token; tokens expire after 30 minutes. Reset links are
   placed in the URL fragment, so browsers do not send them in HTTP requests or
   referrers. A successful reset changes the password and revokes all sessions.
   Request responses do not reveal whether an email belongs to an account.

   Cloudflare setup needed before production email can be sent:
   1. Cloudflare Dashboard → Compute → Email Service → Email Sending.
   2. Onboard advancedcpe.com. Cloudflare will add or request SPF, DKIM, DMARC,
      and bounce-routing DNS records. The configured From address is
      noreply@advancedcpe.com.
   3. In Cloudflare Dashboard → Manage Account → Account API Tokens, create a
      token restricted to this account with Email Sending: Edit permission.
      Store it as the encrypted Pages production secret CF_EMAIL_API_TOKEN;
      do not put the token in wrangler.toml or Git. The project sends through
      Cloudflare Email Service's REST endpoint using this secret.
   4. Arbitrary learner destinations require Workers Paid. The current published
      allowance is 3,000 outgoing emails per account per month, then $0.35 per
      1,000. See Cloudflare Email Service pricing before enabling a paid plan.
   5. Apply migration 0011_password_reset.sql with the normal Wrangler D1
      migrations command, then deploy the Pages project.
   6. Verify the domain is active in Email Sending and send a reset email to an
      account you control. The Forgot password link appears after the API token
      is configured. Cloudflare API failures are logged without recipient or
      token details; the public request response does not reveal account status.

   Database migration command:
   npx.cmd wrangler d1 migrations apply advancedcpe-lms --config=./LMS/wrangler.toml --remote

   Password reset routes:
   POST /api/auth/password-reset/request (email)
   POST /api/auth/password-reset/complete (token and new password)

19. One-year library access and administrator course preview (October 5, 2026)
   The $100 USD PayPal checkout now grants 365 days of video library access.
   Instructor coupon access also lasts 365 days from redemption; neither renews
   automatically. Migration 0012 sets the existing library grant's expiry to
   one year after its original grant date. Account access shows the expiry date.

   In the administrator course editor, published video courses have a “Take
   course as admin” link. Admins bypass learner purchase gating while previewing,
   and can open each attached Lumi activity and manually check/uncheck its
   completion. Video progress, test attempts, certificates and activity checkoffs
   are recorded only under the admin's own account, never a learner's. Migration
   0013 permits multiple interactive activities to be attached to one course.

   Apply pending production migrations before deploying:
   npx.cmd wrangler d1 migrations apply advancedcpe-lms --config=./LMS/wrangler.toml --remote
   node LMS/build.cjs
   npx.cmd wrangler pages deploy --project-name=advancedcpe-home --branch=main --commit-dirty=true

LOCAL DEVELOPMENT
------------------
Run these from D:\GitHub Sync\advancedCPE-home. --local uses separate local data.
node LMS/build.cjs
npx.cmd wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --local --file=./LMS/schema.sql
npx.cmd wrangler d1 migrations apply advancedcpe-lms --config=./LMS/wrangler.toml --local
npx.cmd wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --local --file=./LMS/seed-courses.sql
npx.cmd wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --local --file=./LMS/catalog-metadata.sql
node LMS/prepare-tests.cjs
npx.cmd wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --local --file=./LMS/private/quiz-seed.sql
npx.cmd wrangler r2 object put advancedcpe-r2/courses/course-4.mp4 --config=./LMS/wrangler.toml --local --file="./LMS/Courses/course 4.mp4" --content-type=video/mp4
npx.cmd wrangler pages dev --cwd=LMS --port=8787
Open http://127.0.0.1:8787/LMS/ . Rebuild/reload after source edits.
Signup requires a locally configured Turnstile test key pair in ignored .dev.vars;
never deploy test keys. Backend tests mock Siteverify and do not need real secrets.

20. Unified courses, guides, articles, and modules (October 6, 2026)
   The administrator dashboard now uses one learning-item editor for video courses,
   reading guides, and articles. Existing guide and article text is loaded into the
   editor from the editorial library; edits are stored in D1. Published editorial
   pages render from D1, and the public Articles index lists published article rows.
   Add/select modules per item: Video, Written article, Lumi, and Test. Each selected
   module has a separate Published checkbox. Each item has a Free or Course Pack
   access dropdown. Course Pack means the existing $100 USD / 365-day library access;
   free items bypass purchase gating. Lumi packages can be added to guides as well as
   video lessons. Password reset uses “Forgot your password?” and sends a one-use
   link to the account inbox (30-minute expiry).

   Migration 0014 adds module/access/content metadata and seeds four editable article
   entries while preserving the existing 28 catalog items and their learner records.
   Apply the D1 migration, then build/deploy the Pages Worker:
   npx.cmd wrangler d1 migrations apply advancedcpe-lms --config=./LMS/wrangler.toml --remote
   node LMS/build.cjs
   npx.cmd wrangler pages deploy --project-name=advancedcpe-home --branch=main --commit-dirty=true

Rollback: use the prior successful production deployment in Cloudflare Pages.
This restores site code, not D1 schema/data. Schema changes use numbered migrations.
