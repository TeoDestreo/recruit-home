<!-- SHARED-RULES:START (identical in every repo Matt owns; edit once, then sync to all) -->
# Matt's rules (apply in every repo)

## How to talk to Matt
- Reply in two sentences or fewer. After a push, those same sentences say: the repo and branch pushed to, what was pushed, a link to the live site, which databases were affected (or none), and which folders or files changed.
- Ask at most 2-3 questions at a time. Where a reasonable, generally accepted assumption works, make it and keep going instead of asking.
- Give every step Matt must do as a path: `Matt > <site or software> > <menu> > <item>`.

## How to work
- When a change is done, commit and push without asking (a push to a production branch deploys). Test first.
- Keep it simple. Do not over-engineer or over-architect, and do not add extras that were not asked for.
- Never leave placeholders in a page. If something is unknown, write the page so it is not needed.
- Never print or commit secret values.
- Cloudflare Pages publishes everything in a repo's root folder. Never put private or internal files there (rules files, database schemas, notes). Keep them out of the published folder, or block them in `_redirects`.

## "new rule"
- When Matt starts a message with "new rule", add that rule to this block and sync the identical block into every repo he owns (`list_repos`, `add_repo`, edit, commit, push). Skip repos he has said not to modify (`advancedCPE-home`, per his CRM rules). Keep each repo's own project notes outside the block.
<!-- SHARED-RULES:END -->
