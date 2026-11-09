# WhatsApp Bulk Message Sender

A Node.js tool for sending personalized bulk WhatsApp messages with optional media attachments, automated QR authentication, contact verification, and randomized delays to prevent spam detection.

## Features

- **Personalized Messages**: Use `{name}`, `{firstName}`, or `{fullName}` placeholders in message templates.
- **Media Attachments**: Automatically attaches event flyers/images (`cover.jpg`, `cover.png`, or custom path) and sends the message as a caption.
- **Safe by Design**: Sensitive recipient data, phone numbers, WhatsApp authentication sessions, and private media are excluded from version control.
- **Test Mode**: Easily test deliveries with dedicated test recipients before broadcasting to production.
- **WhatsApp Web Integration**: Uses `whatsapp-web.js` with persistent local session caching via QR code scanning.
- **Anti-Ban Throttling**: Built-in randomized 6–12 second delays between sends and socket synchronization safeguards.

---

## Getting Started

### 1. Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)
- A mobile phone with an active WhatsApp account

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/symon9/whatsapp-msg.git
cd whatsapp-msg
npm install
```

---

## Configuration

Duplicate the provided `.example` files to set up your local configuration:

### 1. Recipients List

Create `recipients.json` for production broadcasts (copy from `recipients.example.json`):

```bash
cp recipients.example.json recipients.json
```

```json
[
  { "name": "Jane Doe", "number": "12345678901" },
  { "name": "John Smith", "number": "12345678902" }
]
```

> **Note:** Numbers should include the international country code without spaces or the `+` sign (e.g. `2348012345678`).

### 2. Test Recipients List

Create `test-recipients.json` for testing (copy from `test-recipients.example.json`):

```bash
cp test-recipients.example.json test-recipients.json
```

```json
[
  { "name": "Test User", "number": "12345678900" }
]
```

### 3. Message Template

Create `message.txt` (copy from `message.example.txt`):

```bash
cp message.example.txt message.txt
```

Example template:

```text
Hi {name} 👋,

This is a reminder for our upcoming event *Sample Event 2026*!

📅 *Date:* Saturday, 15th November 2026
⏰ *Time:* 10:00 AM – 2:00 PM
📍 *Venue:* Main Hall

We look forward to seeing you there! 🙌
```

#### Template Variables

- `{name}` or `{firstName}`: Recipient's first name (falls back to `'there'`).
- `{fullName}`: Recipient's full name.

### 4. Optional Media Attachment

Place an image named `cover.jpg` (or `cover.png`, `cover.webp`) in the root directory. If present, the image will be sent with your message as the caption. If absent, messages are sent as text-only.

---

## Usage

### Run in Test Mode

Always test with your own number first:

```bash
npm run test
```

*Or:*

```bash
node index.js --test
```

### Run in Production Mode

Send messages to all recipients in `recipients.json`:

```bash
npm run send
```

*Or:*

```bash
npm start
```

### Advanced CLI Options

You can override default files and settings via CLI arguments:

| Option | Description |
| --- | --- |
| `--test` | Runs against `test-recipients.json` |
| `--recipients <path>` | Specify a custom JSON recipients file |
| `--message-file <path>` | Specify a custom message template text file |
| `--message "<text>"` | Pass an inline message string directly |
| `--image <path>` | Specify a custom image to attach |
| `--no-image` | Disable image attachment even if `cover.jpg` exists |

**Example:**

```bash
node index.js --recipients ./vip-list.json --image ./flyer.png --message-file ./custom-msg.txt
```

---

## Authentication & Sessions

1. On the first run, a terminal QR code will appear.
2. Open WhatsApp on your phone > **Linked Devices** > **Link a Device**.
3. Scan the terminal QR code.
4. Your session will be securely stored locally in `.wwebjs_auth/` so you won't need to scan again on subsequent runs.

---

## Security & Privacy

The `.gitignore` is pre-configured to strictly protect your privacy:

- 🔒 **WhatsApp Session Credentials** (`.wwebjs_auth/`, `.wwebjs_cache/`) are ignored.
- 🔒 **Recipient phone numbers and names** (`recipients.json`, `test-recipients.json`) are ignored.
- 🔒 **Message contents & media** (`message.txt`, `cover.jpg`, `*.png`, `*.jpg`) are ignored.
- 🔒 **Environment variables** (`.env`) are ignored.

Never commit sensitive recipient lists, phone numbers, or session credentials to public repositories.

---

## License

This project is licensed under the MIT License.

## Disclaimer

This software is for educational and administrative notification purposes. Ensure compliance with WhatsApp's Terms of Service and Anti-Spam policies when broadcasting messages.
