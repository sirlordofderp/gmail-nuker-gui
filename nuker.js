const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

/*
 * Interactive CLI implementation using the built‑in readline module.
 * We avoid external dependencies so that the script can run in environments
 * without internet access for `npm install`.  The helper function `ask`
 * creates and closes a readline interface for each question, returning a
 * promise for cleaner async/await usage.
 */

/**
 * Prompt the user with a question and return the trimmed answer.
 * Each call creates and disposes its own readline interface.
 * @param {string} question The prompt to display.
 * @returns {Promise<string>} The user's input.
 */
function ask(question) {
  return new Promise((resolve) => {
    const rlPrompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    rlPrompt.question(question, (answer) => {
      rlPrompt.close();
      resolve((answer || '').trim());
    });
  });
}

/*
 * This script provides an interactive command‑line interface for cleaning up
 * your Gmail account.  It allows you to select inbox categories (such as
 * Promotions, Social, Updates or Forums) or enter a custom Gmail search
 * query, preview how many messages will be affected, and then choose
 * whether to move those messages to Trash (recoverable for 30 days) or
 * permanently delete them.
 *
 * For safety, the script requires explicit confirmation before deleting
 * any emails.  It also paginates list results at 500 messages per call
 * because the Gmail API caps the `maxResults` parameter at 500【451862516838898†L330-L338】.
 * Batch deletion and batch trash operations are chunked into blocks of
 * 1,000 message IDs, which is the documented limit for
 * `users.messages.batchDelete` and `users.messages.batchModify` calls【306075927488494†L57-L91】.  Exceeding this
 * limit would cause the entire request to fail.
 */

// OAuth scope: the full mail scope is required for permanent deletion.
// See: https://developers.google.com/gmail/api/auth/scopes
const SCOPES = ['https://mail.google.com/'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

/**
 * Load user credentials from disk, or prompt for authorization if no token exists.
 */
async function authorize() {
  // Load client secrets from a local file.
  let content;
  try {
    content = fs.readFileSync(CREDENTIALS_PATH, { encoding: 'utf8' });
  } catch (err) {
    console.error('❌ Error loading credentials.json:', err.message);
    process.exit(1);
  }
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } =
    credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  try {
    const token = fs.readFileSync(TOKEN_PATH, { encoding: 'utf8' });
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (err) {
    // No token found, request a new one.
    return await getAccessToken(oAuth2Client);
  }
}

/**
 * Get a new token after prompting for user authorization, then store the token to disk.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
function getAccessToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('\n🔑 Authorize this app by visiting this URL:\n', authUrl);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n📥 Enter the code from that page here: ', async (code) => {
      rl.close();
      try {
        const { tokens } = await oAuth2Client.getToken(code.trim());
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('✅ Token saved to', TOKEN_PATH);
        resolve(oAuth2Client);
      } catch (err) {
        console.error('❌ Error retrieving access token:', err.message);
        reject(err);
      }
    });
  });
}

/**
 * Display the main menu and handle user selections recursively until they exit.
 * @param {google.auth.OAuth2} auth Authorized OAuth2 client.
 */
async function showMenu(auth) {
  // Loop until the user chooses to exit.  Using a loop avoids deep recursion.
  while (true) {
    console.log('\nWhat would you like to do?');
    console.log(' 1) Clean by inbox categories');
    console.log(' 2) Clean by custom search query');
    console.log(' 3) Exit');
    const choice = await ask('Enter choice (1-3): ');
    if (!choice) {
      console.log('❌ Invalid input. Please enter a number between 1 and 3.');
      continue;
    }
    const trimmed = choice.trim().toLowerCase();
    if (trimmed === '3' || trimmed === 'exit') {
      console.log('👋 Goodbye!');
      break;
    } else if (trimmed === '1' || trimmed === 'categories') {
      await handleCategories(auth);
    } else if (trimmed === '2' || trimmed === 'query') {
      await handleCustomQuery(auth);
    } else {
      console.log('❌ Invalid choice. Please enter 1, 2 or 3.');
    }
  }
}

/**
 * Let the user select Gmail categories and perform deletion or trashing.
 * @param {google.auth.OAuth2} auth Authorized OAuth2 client.
 */
async function handleCategories(auth) {
  // Define category options. Each entry has a display name and the corresponding query/label value.
  const categories = [
    { name: 'Promotions', value: 'CATEGORY_PROMOTIONS' },
    { name: 'Social', value: 'CATEGORY_SOCIAL' },
    { name: 'Updates', value: 'CATEGORY_UPDATES' },
    { name: 'Forums', value: 'CATEGORY_FORUMS' },
    { name: 'Primary (all other)', value: 'CATEGORY_PRIMARY' },
    { name: 'Spam', value: 'SPAM' },
  ];
  console.log('\nAvailable categories to clean:');
  categories.forEach((cat, idx) => {
    console.log(` ${idx + 1}) ${cat.name}`);
  });
  const input = await ask('Enter category numbers separated by comma (e.g., 1,3) or leave empty to cancel: ');
  if (!input) {
    console.log('⚠️  No categories selected. Returning to menu.');
    return;
  }
  // Parse numbers into selected category values.
  const selectedCategories = [];
  input.split(',').forEach((part) => {
    const num = parseInt(part.trim(), 10);
    if (Number.isInteger(num) && num >= 1 && num <= categories.length) {
      selectedCategories.push(categories[num - 1].value);
    }
  });
  if (selectedCategories.length === 0) {
    console.log('⚠️  No valid category numbers entered.');
    return;
  }
  // Ask user for action (trash or delete).
  let action;
  while (true) {
    const actAns = await ask('Choose the cleanup action: type "trash" to move to Trash (recoverable) or "delete" to permanently delete: ');
    const act = (actAns || '').trim().toLowerCase();
    if (act === 'trash' || act === 'delete') {
      action = act;
      break;
    }
    console.log('❌ Invalid action. Please enter "trash" or "delete".');
  }
  // Ask for dry run.
  let dryRunAns = await ask('Perform dry run (preview only)? (yes/no): ');
  dryRunAns = (dryRunAns || '').trim().toLowerCase();
  const dryRun = dryRunAns.startsWith('y');
  // Process each selected category.
  for (const cat of selectedCategories) {
    let query;
    let labelIds;
    if (cat === 'SPAM') {
      labelIds = ['SPAM'];
    } else if (cat.startsWith('CATEGORY_')) {
      const categoryName = cat.replace('CATEGORY_', '').toLowerCase();
      query = `category:${categoryName}`;
    }
    console.log(`\n🔍 Collecting messages for ${cat}...`);
    const ids = await collectMessageIds(auth, { query, labelIds });
    console.log(`Found ${ids.length} messages in ${cat}.`);
    if (dryRun) {
      continue;
    }
    if (ids.length === 0) {
      continue;
    }
    // Ask for confirmation before deletion or trashing.
    const confAns = await ask(`Proceed to ${action === 'delete' ? 'delete' : 'move to trash'} ${ids.length} messages from ${cat}? (yes/no): `);
    const confirm = (confAns || '').trim().toLowerCase().startsWith('y');
    if (!confirm) {
      console.log(`❌ Skipped ${cat}.`);
      continue;
    }
    if (action === 'delete') {
      await batchDeleteMessages(auth, ids);
    } else {
      await batchTrashMessages(auth, ids);
    }
    console.log(`✅ Completed ${cat}.`);
  }
}

/**
 * Handle cleanup by a custom Gmail search query.
 * @param {google.auth.OAuth2} auth Authorized OAuth2 client.
 */
async function handleCustomQuery(auth) {
  const queryInput = await ask('Enter a Gmail search query (e.g., "from:newsletter@example.com older_than:1y"): ');
  const query = (queryInput || '').trim();
  if (!query) {
    console.log('⚠️  No query entered. Returning to menu.');
    return;
  }
  let action;
  while (true) {
    const actAns = await ask('Choose the cleanup action (trash/delete): ');
    const act = (actAns || '').trim().toLowerCase();
    if (act === 'trash' || act === 'delete') {
      action = act;
      break;
    }
    console.log('❌ Invalid action. Please enter "trash" or "delete".');
  }
  const dryAns = await ask('Perform dry run (preview only)? (yes/no): ');
  const dryRun = ((dryAns || '').trim().toLowerCase().startsWith('y'));
  console.log(`\n🔍 Collecting messages matching query: ${query} ...`);
  const ids = await collectMessageIds(auth, { query, labelIds: undefined });
  console.log(`Found ${ids.length} messages.`);
  if (dryRun) {
    return;
  }
  if (ids.length === 0) {
    console.log('No messages matched the query.');
    return;
  }
  const confAns = await ask(`Proceed to ${action === 'delete' ? 'delete' : 'move to trash'} ${ids.length} messages? (yes/no): `);
  const confirm = ((confAns || '').trim().toLowerCase().startsWith('y'));
  if (!confirm) {
    console.log('❌ Operation cancelled.');
    return;
  }
  if (action === 'delete') {
    await batchDeleteMessages(auth, ids);
  } else {
    await batchTrashMessages(auth, ids);
  }
  console.log('✅ Operation completed.');
}

/**
 * Collect message IDs matching a query or label filter. Handles pagination with a
 * maximum of 500 results per request【451862516838898†L330-L338】 and returns all IDs.
 * @param {google.auth.OAuth2} auth Authorized OAuth2 client.
 * @param {{query?: string, labelIds?: string[]}} options Search options.
 * @returns {Promise<string[]>} List of message IDs.
 */
async function collectMessageIds(auth, options) {
  const gmail = google.gmail({ version: 'v1', auth });
  let ids = [];
  let pageToken = null;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 500,
      q: options.query || undefined,
      labelIds: options.labelIds || undefined,
      pageToken: pageToken || undefined,
    });
    const messages = res.data.messages || [];
    ids.push(...messages.map((m) => m.id));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return ids;
}

/**
 * Permanently delete messages in batches of up to 1,000 IDs【306075927488494†L57-L91】.
 * @param {google.auth.OAuth2} auth Authorized OAuth2 client.
 * @param {string[]} ids List of message IDs to delete.
 */
async function batchDeleteMessages(auth, ids) {
  const gmail = google.gmail({ version: 'v1', auth });
  const chunkSize = 1000;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    await gmail.users.messages.batchDelete({ userId: 'me', requestBody: { ids: chunk } });
    console.log(`🗑️  Deleted ${chunk.length} messages permanently.`);
  }
}

/**
 * Move messages to trash in batches of up to 1,000 IDs using batchModify【306075927488494†L133-L144】.
 * @param {google.auth.OAuth2} auth Authorized OAuth2 client.
 * @param {string[]} ids List of message IDs to move to trash.
 */
async function batchTrashMessages(auth, ids) {
  const gmail = google.gmail({ version: 'v1', auth });
  const chunkSize = 1000;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: { ids: chunk, addLabelIds: ['TRASH'], removeLabelIds: [] },
    });
    console.log(`🗑️  Moved ${chunk.length} messages to trash.`);
  }
}

// Entrypoint: authorize and launch the menu.
authorize()
  .then((auth) => showMenu(auth))
  .catch((err) => {
    console.error('❌ An error occurred:', err.message);
  });