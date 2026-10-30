# Shared knowledge

Sample only. This is the floor's copy of the notes the bots are supposed to keep. It is bundled with the app and never fetched.

## New repos need Cursor app access
tag: access

A demo that lives in a brand-new GitHub repo cannot be built by a cloud agent until the Cursor app is installed on that repo. Access is a setup step, not a line in the prompt.

## Secrets do not ride with the agent
tag: secrets

Bot secrets cannot be forwarded to cloud agents. Live tests that need those secrets run somewhere else, on a machine that already holds the keys.

## Approvals come from the owner
tag: approval

Approvals must come from the owner directly. A bot does not approve its own pick, and a chief of staff does not stand in for that yes.

## Keys stay on the server
tag: keys

Keep keys server-side. They do not go in the browser, the prompt, or the pull request.

## One bot per job
tag: playbook

The livestream playbook hires a bot for a job, not a chat for a task. Show the task once, keep the correction, and put a routine on anything that should repeat.
