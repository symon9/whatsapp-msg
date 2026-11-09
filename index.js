const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// --- Command Line Argument Helpers ---
function getCliArg(flag) {
    const index = process.argv.indexOf(flag);
    if (index !== -1 && index + 1 < process.argv.length) {
        return process.argv[index + 1];
    }
    return null;
}

const isTestMode = process.argv.includes('--test') || process.env.MODE === 'test';
const noImageRequested = process.argv.includes('--no-image');

// --- Image Path Configuration ---
function resolveImagePath() {
    if (noImageRequested) return null;

    const customImagePath = getCliArg('--image') || process.env.IMAGE_PATH;
    if (customImagePath) {
        const resolved = path.resolve(customImagePath);
        if (fs.existsSync(resolved)) {
            return resolved;
        }
        console.warn(`⚠️ Specified image not found at "${resolved}". Proceeding without image.`);
        return null;
    }

    const defaultImages = ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp'];
    for (const img of defaultImages) {
        const fullPath = path.join(__dirname, img);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return null;
}

const imagePath = resolveImagePath();

// --- Message Template Configuration ---
function loadMessageTemplate() {
    const inlineMessage = getCliArg('--message') || process.env.MESSAGE_TEMPLATE;
    if (inlineMessage) {
        return inlineMessage;
    }

    const customMessageFile = getCliArg('--message-file') || process.env.MESSAGE_FILE;
    if (customMessageFile) {
        const resolved = path.resolve(customMessageFile);
        if (fs.existsSync(resolved)) {
            return fs.readFileSync(resolved, 'utf-8');
        }
        console.warn(`⚠️ Specified message file not found at "${resolved}". Falling back to defaults.`);
    }

    const defaultMessagePath = path.join(__dirname, 'message.txt');
    if (fs.existsSync(defaultMessagePath)) {
        return fs.readFileSync(defaultMessagePath, 'utf-8');
    }

    const exampleMessagePath = path.join(__dirname, 'message.example.txt');
    if (fs.existsSync(exampleMessagePath)) {
        console.warn('ℹ️ "message.txt" not found. Using "message.example.txt" template.');
        return fs.readFileSync(exampleMessagePath, 'utf-8');
    }

    return 'Hi {name} 👋,\n\nThis is a friendly reminder. We look forward to seeing you there!';
}

const messageTemplate = loadMessageTemplate();

// --- Recipients Configuration ---
function loadRecipients() {
    const customRecipientsPath = getCliArg('--recipients') || process.env.RECIPIENTS_PATH;
    if (customRecipientsPath) {
        const resolved = path.resolve(customRecipientsPath);
        if (fs.existsSync(resolved)) {
            return JSON.parse(fs.readFileSync(resolved, 'utf-8'));
        }
        throw new Error(`Specified recipients file not found at "${resolved}".`);
    }

    if (isTestMode) {
        const testPath = path.join(__dirname, 'test-recipients.json');
        if (fs.existsSync(testPath)) {
            return JSON.parse(fs.readFileSync(testPath, 'utf-8'));
        }
        const testExamplePath = path.join(__dirname, 'test-recipients.example.json');
        if (fs.existsSync(testExamplePath)) {
            console.warn('⚠️ "test-recipients.json" not found. Using "test-recipients.example.json".');
            return JSON.parse(fs.readFileSync(testExamplePath, 'utf-8'));
        }
        throw new Error('No test recipients found. Please create "test-recipients.json".');
    }

    const prodPath = path.join(__dirname, 'recipients.json');
    if (fs.existsSync(prodPath)) {
        return JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
    }

    const prodExamplePath = path.join(__dirname, 'recipients.example.json');
    if (fs.existsSync(prodExamplePath)) {
        console.warn('⚠️ "recipients.json" not found. Using "recipients.example.json".');
        return JSON.parse(fs.readFileSync(prodExamplePath, 'utf-8'));
    }

    throw new Error('No recipients found. Please create "recipients.json".');
}

const targetRecipients = loadRecipients();

if (!Array.isArray(targetRecipients) || targetRecipients.length === 0) {
    console.error('❌ Error: Recipient list is empty or invalid.');
    process.exit(1);
}

/**
 * Generates personalized message from template
 */
function createPersonalizedMessage(template, name) {
    let fullName = (name && name.trim() && name !== '[Name]') ? name.trim() : '';
    let firstName = fullName ? fullName.split(/\s+/)[0] : 'there';
    let displayName = fullName || 'there';

    return template
        .replace(/\{fullName\}/g, displayName)
        .replace(/\{firstName\}/g, firstName)
        .replace(/\{greetingName\}/g, firstName)
        .replace(/\{name\}/g, firstName);
}

// --- WhatsApp Client Initialization ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        protocolTimeout: 180000, // 3 minutes timeout to prevent Runtime.callFunctionOn timed out
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('Scan this QR code with your WhatsApp mobile app:');
    qrcode.generate(qr, { small: true });
});

let hasStartedBroadcast = false;

client.once('ready', async () => {
    if (hasStartedBroadcast) return;
    hasStartedBroadcast = true;

    const myPhone = client.info && client.info.wid ? client.info.wid.user : '';
    console.log(`\n📱 Connected WhatsApp account: ${myPhone || 'OK'}`);

    if (isTestMode) {
        console.log(`🧪 [TEST MODE] Starting test send to ${targetRecipients.length} recipient(s)...`);
    } else {
        console.log(`🚀 [PRODUCTION MODE] Starting broadcast to ${targetRecipients.length} recipient(s)...`);
    }

    const hasImage = Boolean(imagePath && fs.existsSync(imagePath));
    if (hasImage) {
        console.log(`🖼️  Image found: "${path.basename(imagePath)}" (sending picture with message as caption)\n`);
    } else {
        console.log(`ℹ️  No image configured or found. Sending text-only messages.\n`);
    }

    // Give WhatsApp Web 5 seconds to fully establish comms sockets
    console.log('Synchronizing with WhatsApp network (5s)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    for (let i = 0; i < targetRecipients.length; i++) {
        const item = targetRecipients[i];
        const num = String(item.number).replace(/\D/g, ''); // strip any non-digits

        try {
            console.log(`[${i + 1}/${targetRecipients.length}] Checking WhatsApp registration for ${num}...`);

            // Check if number is registered on WhatsApp
            const numberDetails = await client.getNumberId(num);
            if (!numberDetails) {
                console.error(`❌ [Failed] ${num} is NOT registered on WhatsApp or format is invalid!`);
                continue;
            }

            const chatId = numberDetails._serialized;
            const isSelf = myPhone && num === myPhone;
            if (isSelf) {
                console.log(`ℹ️ [Notice] You are sending to your own WhatsApp number. It will appear in your "Message yourself" / "You" chat without a ringtone notification.`);
            }

            // Determine recipient name
            let recipientName = item.name;
            if (!recipientName || recipientName === '[Name]') {
                try {
                    const contact = await client.getContactById(chatId);
                    recipientName = contact.name || contact.pushname || contact.shortName || '';
                } catch {
                    recipientName = '';
                }
            }

            const personalizedMessage = createPersonalizedMessage(messageTemplate, recipientName);

            // Send with image if present, or as text-only
            if (hasImage) {
                const media = MessageMedia.fromFilePath(imagePath);
                await client.sendMessage(chatId, media, {
                    caption: personalizedMessage,
                    waitUntilMsgSent: true
                });
            } else {
                await client.sendMessage(chatId, personalizedMessage, {
                    waitUntilMsgSent: true
                });
            }

            const loggedName = recipientName ? ` (${recipientName})` : '';
            console.log(`✅ [${i + 1}/${targetRecipients.length}] Successfully delivered to WhatsApp servers for ${num}${loggedName}`);

            // Random delay between 6 to 12 seconds between recipients to prevent spam detection
            if (i < targetRecipients.length - 1) {
                const delay = Math.floor(Math.random() * 6000) + 6000;
                console.log(`Waiting ${Math.round(delay / 1000)}s before next message...\n`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

        } catch (err) {
            console.error(`❌ [Failed] Could not send to ${num}:`, err.message);
        }
    }

    console.log('\nAll messages processed successfully.');
    console.log('Waiting 6 seconds for background socket sync before closing session...');
    await new Promise(resolve => setTimeout(resolve, 6000));

    try {
        await client.destroy();
    } catch {
        // ignore
    }

    console.log('Done.');
    process.exit(0);
});

client.initialize();
