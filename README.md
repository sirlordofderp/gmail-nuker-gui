Gmail Nuker GUI 🔥

A deliberately over-the-top Gmail cleanup tool with a giant red FIRE!! button and a safety ARM switch.

Built for people who occasionally look at their Promotions folder, see 47,000 unread emails, and decide diplomacy has failed.

Features

🔵 ARM Mode

ARM performs a scan only.

Counts messages in selected categories

Shows exactly how many emails will be affected

Does not delete anything

Locks in the selected target list

Must be run before FIRE


Think of it as a targeting computer.

🔴 FIRE!! Mode

Once armed, FIRE permanently deletes all messages found during the ARM scan.

Current supported targets:

Promotions

Social

Updates

Forums

Primary

Spam


If category selections change after ARM, the system automatically requires a new ARM cycle before allowing FIRE.

🛡 Safety Features

Despite the name, there are a few safeguards:

ARM must be pressed first

Category changes invalidate the ARM state

User must type FIRE before the button unlocks

ARM shows exact message counts before deletion

Uses Gmail API pagination correctly

Handles large mailboxes automatically


⚡ Large Mailbox Support

The tool:

Retrieves messages in 500-message pages

Automatically follows Gmail pagination

Deletes in API-safe batches

Works with very large inboxes


Screenshots

Expected layout:

[ ARM ]

################################
#                              #
#           FIRE!!            #
#                              #
################################

[x] Promotions
[x] Social
[ ] Updates
[ ] Forums
[ ] Primary
[x] Spam

Type FIRE to unlock:
[FIRE____________]

Status:
ARMED
Target Count: 12,847 emails

Installation

Clone the repository:

git clone https://github.com/sirlordofderp/gmail-nuker-gui.git
cd gmail-nuker-gui

Install dependencies:

npm install

Gmail API Setup

Create a Google Cloud project.

Enable:

Gmail API

Create OAuth credentials.

Download:

credentials.json

Place it beside:

gui.js

Running

Start the GUI:

npm start

Open:

http://localhost:3434

First launch will ask you to authorize your Gmail account.

After authorization a token will be saved locally:

token.json

CLI Mode

The original command-line version is still available:

npm run cli

Workflow

1. Select Targets

Choose categories to clean.

2. ARM

The system scans Gmail and reports:

Promotions: 8,322
Social: 4,112
Spam: 413

Total Target Count: 12,847

3. FIRE

Type:

FIRE

Then press:

FIRE!!

The tool will delete all emails found during the ARM scan.

Warning

FIRE uses Gmail's permanent deletion endpoint.

This is not the same thing as clicking "Archive."

This is not the same thing as clicking "Mark Read."

This is not the same thing as clicking "I'll deal with it later."

Deleted emails may be unrecoverable.

Use ARM first.

Why?

Because sometimes your inbox looks like:

Promotions (31,842)
Social (11,204)
Spam (8,993)

and the correct technical solution is:

FIRE!!

License

MIT License

Use responsibly.

Or irresponsibly.

Just don't blame me if you vaporize 15 years of coupon emails. 🔥📧
