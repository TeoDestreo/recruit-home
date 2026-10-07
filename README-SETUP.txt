TEST SITE COPY: this repo (recruit-home) is the test copy described in section 10.
Its wrangler.toml points at Pages "recruit-home" and D1 "advancedcpe-lms-test".

ADVANCED CPE - HOW THIS SITE IS BUILT, AND HOW TO DO IT AGAIN
=============================================================
Updated: October 7, 2026

This is a rebuild guide: what each piece is, where it lives, and the steps used to set
it up. It is also shown in the admin console under "Build notes & Lumi guide".
Never put passwords, API tokens or PayPal secrets in this file or in GitHub.


1. WHAT LIVES WHERE
-------------------
Live site            https://advancedcpe.com  (also https://advancedcpe.pages.dev)
Learning library     https://advancedcpe.com/LMS/
Admin console        https://advancedcpe.com/LMS/admin
Code                 GitHub: TeoDestreo/advancedCPE-home, branch main
Website + backend    Cloudflare Pages project "advancedcpe-home"
Database             Cloudflare D1 "advancedcpe-lms"
                     ID 04c8ea27-cfe6-4704-9558-02d4143a4261
Video + file storage Cloudflare R2 bucket "advancedcpe-r2"
Email                Cloudflare Email Service (Email Sending), from noreply@advancedcpe.com
Bot check on signup  Cloudflare Turnstile widget "Advanced CPE Signup"
Payments             PayPal live REST app ($100 USD = 365 days of video library access)
Cloudflare account   ef7d930dd08e89e749df7b27c60f0684
Test copy            GitHub TeoDestreo/recruit-home -> Pages "recruit-home"
                     (https://recruit-7k8.pages.dev) with D1 "advancedcpe-lms-test".
                     It shares the live R2 bucket (same videos). See section 10.

How it fits together: GitHub holds the code. When main changes, Cloudflare Pages builds
the site (LMS/build.cjs) and publishes the pages plus one backend program (_worker.js).
The backend reads and writes D1, streams videos from R2, sends email, checks Turnstile
and talks to PayPal. LMS/wrangler.toml names the database and bucket ("bindings").


2. ACCOUNTS NEEDED
------------------
- Cloudflare (Pages, D1, R2, Email Service, Turnstile). Email to any address needs the
  Workers Paid plan ($5/month); it includes 3,000 emails/month, then $0.35 per 1,000.
- GitHub (code).
- PayPal business account (checkout).
- Optional: YouTube channel (a course video can be a YouTube link instead of an upload).
- Claude (claude.ai/code) to make changes - see section 11.


3. GITHUB
---------
Repository layout:
  index.html            the homepage
  LMS/                  everything else: pages, scripts, backend (LMS/src), database
                        files (schema.sql, migrations/), build script, tests
  README-SETUP.txt      this file
.gitignore keeps videos (*.mp4, LMS/Courses/), build output (LMS/dist/), local
Cloudflare state and secret files out of GitHub.

RULE: the live site changes only by pushing to main on GitHub. Cloudflare then builds
and publishes it automatically. Do not upload to Cloudflare directly ("wrangler pages
deploy"): on October 6 that left the live site ahead of GitHub and caused confusion.


4. CLOUDFLARE PAGES (website + backend)
--------------------------------------
Set up once:
  1. Workers & Pages > Create > Pages > Connect to Git > choose TeoDestreo/advancedCPE-home.
  2. Build settings:  Root directory  LMS
                      Build command   node build.cjs
                      Output folder   dist
                      Production branch main
  3. Pages reads LMS/wrangler.toml for the database/bucket bindings and plain settings.
  4. Custom domains: advancedcpe.com is attached to the project.
  5. Add the secrets in section 8 (Settings > Variables and Secrets).
Every push to main rebuilds the site. Deployments > (older deployment) > Rollback
restores old code; it does NOT undo database changes.


5. D1 DATABASE
--------------
Create: Storage & Databases > D1 > Create "advancedcpe-lms", then put its ID in
LMS/wrangler.toml under [[d1_databases]] (binding = "DB").

Building a fresh database (from the repo folder, after "npx wrangler login"):
  npx wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --remote --file=./LMS/schema.sql
  npx wrangler d1 migrations apply advancedcpe-lms --config=./LMS/wrangler.toml --remote
  (catalog data: LMS/seed-courses.sql and LMS/catalog-metadata.sql, applied with
  "d1 execute ... --file=" in the same way; the quiz bank is private, see prepare-tests.cjs)

Changing the database: add the next numbered file in LMS/migrations/ and apply it with
the "migrations apply" command above BEFORE pushing code that needs it. D1 records each
applied file in the d1_migrations table, so it never runs twice. Never edit an old one.

Backups: D1 Time Travel can restore the database to any point in the last 30 days
(7 days on the free plan).
Before a risky change, record a restore point (bookmark). The one taken before the
October 7 release: 0000003e-00000000-000050fd-de84afd1803ef144119b0ef7ae6d8a1b

Migrations so far:
  0001 logins, sessions, progress, certificates     0010 learner accounts, course trash
  0002 video playback tracking                      0011 password reset tokens
  0003 paid access (course_access)                  0012 access lasts one year
  0004 PayPal checkout orders                       0013 several activities per course
  0005 learner profiles                             0014 courses/guides/articles + modules
  0006 reading-topic library                        0015 email confirmation
  0007 course tests (10 questions, 3 tries, >70%)   0016 admin coupon codes
  0008 admin role, Lumi activities                  0017 captions and transcripts
  0009 YouTube or MP4 video sources                 0018 CPE credits per course

Making someone an administrator (they must have an account first):
  npx wrangler d1 execute advancedcpe-lms --config=./LMS/wrangler.toml --remote --command "INSERT INTO admins(user_id) SELECT id FROM users WHERE email='person@example.com'"


6. R2 STORAGE (videos and activity files)
-----------------------------------------
Create: R2 > Create bucket "advancedcpe-r2"; binding COURSE_STORAGE in wrangler.toml.
Videos are private: learners only reach them through the backend after access checks.
Uploading from the admin console (Course > Upload / replace MP4, up to 2 GB) is the
normal way. Lumi activity files are stored under activities/.
The original 13 videos were uploaded from the computer as courses/course-4.mp4 ...
courses/course-16.mp4, for example:
  npx wrangler r2 object put advancedcpe-r2/courses/course-4.mp4 --config=./LMS/wrangler.toml --remote --file="./LMS/Courses/course 4.mp4" --content-type=video/mp4
  node LMS/verify-course-uploads.cjs     (checks uploads against the local files)


7. EMAIL, TURNSTILE AND PAYPAL
------------------------------
Email (confirmation links, password resets, receipts):
  1. Compute > Email Service > Email Sending > onboard advancedcpe.com. Cloudflare adds
     the SPF, DKIM, DMARC and bounce DNS records.
  2. Manage Account > Account API Tokens > create a token for this account with
     "Email Sending: Edit". Save it as the secret CF_EMAIL_API_TOKEN.
  3. Sender address is PASSWORD_RESET_FROM in wrangler.toml (noreply@advancedcpe.com).
  Without the token, signup still works but no emails are sent; admins can confirm a
  learner by hand (Admin > Learners & results > Mark email confirmed).

Turnstile (stops bots creating accounts):
  1. Turnstile > Add widget "Advanced CPE Signup", managed mode, domains advancedcpe.com
     and advancedcpe.pages.dev (add recruit-7k8.pages.dev to allow signups on the test site).
  2. Site key goes in wrangler.toml (TURNSTILE_SITE_KEY); secret key is the secret
     TURNSTILE_SECRET.

PayPal:
  1. https://developer.paypal.com/dashboard/applications/live > create a LIVE REST app
     on the business account.
  2. Save its Client ID and Secret as PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.
  3. For testing with sandbox keys, also set PAYPAL_ENV = sandbox (test site only).
  Refunds are manual: refund in PayPal, then revoke the matching access in D1
  (course_access row whose payment_reference is paypal:<capture id>, set revoked_at).
  If a buyer closes the page before payment confirms, have them sign in and open
  https://advancedcpe.com/LMS/?checkout=return&token=<PayPal order id>


8. SECRETS AND SETTINGS
-----------------------
Secrets: Workers & Pages > advancedcpe-home > Settings > Variables and Secrets
(or: npx wrangler pages secret put NAME --cwd=LMS --project-name=advancedcpe-home).
Secrets cannot be read back once saved; keep the originals in a password manager.
  CF_EMAIL_API_TOKEN     email sending token (section 7)
  TURNSTILE_SECRET       Turnstile secret key
  PAYPAL_CLIENT_ID       PayPal live app
  PAYPAL_CLIENT_SECRET   PayPal live app
  FREE_ACCESS_CODE_HASH  SHA-256 hash of the original site-wide coupon code (optional;
                         coupons are normally made in Admin > Coupon codes)
Plain settings in LMS/wrangler.toml: TURNSTILE_SITE_KEY, PASSWORD_RESET_FROM,
CF_ACCOUNT_ID. Secret changes take effect on the next deployment.


9. MAKING CHANGES
-----------------
  1. Get the latest code from GitHub first (git pull). Check the live site matches.
  2. Make the change on the test site (section 10) and check it there.
  3. Run the tests from the repo folder:
       node LMS/build.cjs
       node LMS/test-features.mjs   node LMS/test-backend.mjs   node LMS/test-admin.mjs
       node LMS/test-exams.mjs      node LMS/test-youtube-player.mjs
       node LMS/test-site.mjs
  4. If the database changes, apply the new migration to advancedcpe-lms.
  5. Commit and push to main. Cloudflare rebuilds advancedcpe.com in about a minute.
Run it on your own computer:  npx wrangler pages dev --cwd=LMS  (uses separate local
data; see the wrangler d1/r2 "--local" commands for loading it).


10. THE TEST SITE
-----------------
GitHub TeoDestreo/recruit-home holds a copy of this code. Pushing its main branch
rebuilds https://recruit-7k8.pages.dev (Pages project "recruit-home", same build
settings). Its wrangler.toml differs only in: name = "recruit-home", the test database
advancedcpe-lms-test (fdbc1e0e-50c8-42dd-84aa-e9724ac7f802). It uses the LIVE R2 bucket,
so videos uploaded on the test site land in the real bucket. It has its own secrets;
add only what you need there (e.g. sandbox PayPal keys with PAYPAL_ENV = sandbox).


11. HOW CLAUDE IS CONNECTED
---------------------------
Claude Code runs in a cloud workspace at claude.ai/code (no local computer needed).
  1. GitHub: install the Claude GitHub app (https://github.com/apps/claude) on the
     account and give it access to advancedCPE-home and recruit-home. Claude can then
     read, commit and push.
  2. Cloudflare: My Profile > API Tokens > Create Token > Custom token, named
     "claudeconnector", limited to this account, with D1: Edit, Cloudflare Pages: Edit
     and Workers R2 Storage access. Copy the token value.
  3. In claude.ai/code: click the environment name above the message box > gear icon >
     API credentials > Add credential: allowed website api.cloudflare.com, header
     Authorization, prefix Bearer, value = the token. Claude uses it without ever
     seeing it. Also add CLOUDFLARE_ACCOUNT_ID=ef7d930dd08e89e749df7b27c60f0684 under
     Environment variables. Start a new session after changing these.
  4. Network access in the same dialog controls which websites Claude can reach.
     *.pages.dev and advancedcpe.com are not allowed, so Claude tests on its own local
     copy and you check the live pages.
Working with Claude: ask it to pull the latest code first, build and test on the test
site, then push to production when you say so. For database changes it records a D1
restore point, applies the migration, then pushes.


12. ADMIN CONSOLE QUICK GUIDE
-----------------------------
Courses: add or edit a learning item (video course, reading guide or article), its
modules (Video, Written article, Lumi, Test - each with its own Published box), access
(Free or Course Pack), CPE credits (default 1, printed on certificates), video (MP4
upload or YouTube link + exact duration), captions (.vtt/.srt) and transcript (.txt),
and the 10 test questions. Delete moves a course to Trash; nothing is erased.
Learners & results: accounts, email-confirmed status, test scores and certificates.
Coupon codes: create codes with an access length, optional use limit and last day.

Lumi interactive activities:
  1. Build the activity in Lumi Desktop and export a .h5p file WITH its libraries
     (not HTML or SCORM). Keep media inside the package; max 60 MB compressed.
  2. Open the course > Lumi interactive activity > upload the .h5p file.
  3. Click Preview & verify and finish the whole activity until it says
     "Completion tracking verified".
  4. Attach it as optional, or "Require before test".
YouTube videos: unlisted links can be shared outside the site, so use an MP4 upload
when the video itself must stay behind payment.
