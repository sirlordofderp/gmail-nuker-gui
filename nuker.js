const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

const SCOPES = ['https://mail.google.com/'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Load credentials then start
fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.error('❌ Error loading credentials.json:', err);
  authorize(JSON.parse(content), nukeInbox);
});

// Authorize and get token
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

// Get new token (one-time login)
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n🔑 Authorize this app by visiting this URL:\n', authUrl);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('\n📥 Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('❌ Error retrieving access token:', err);
      oAuth2Client.setCredentials(token);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), () => {});
      console.log('✅ Token saved to', TOKEN_PATH);
      callback(oAuth2Client);
    });
  });
}

// Gmail nuker logic
async function nukeInbox(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const categories = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'SPAM'];

  for (const category of categories) {
    console.log(`\n🧨 Nuking: ${category}`);
    let round = 0;

    while (true) {
      round++;
      const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 1000,
        q: `category:${category}`,
      });

      const messages = res.data.messages || [];

      if (messages.length === 0) {
        console.log(`✅ ${category} done. No more messages found.`);
        break;
      }

      const ids = messages.map(m => m.id);
      await gmail.users.messages.batchDelete({
        userId: 'me',
        requestBody: { ids },
      });

      console.log(`🧹 Round ${round}: Deleted ${ids.length} messages from ${category}`);
      await delay(1000); // Wait 1 second
    }
  }

  console.log('\n🎉 Inbox nuked successfully!');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
