/**
 * Vercel Serverless Chat API (Node.js)
 * Pass through encryption + 24h retention logic
 */
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.STORAGE_URL || process.env.MONGODB_URI;
const DB_NAME = 'gallery_chat';

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const client = await MongoClient.connect(MONGODB_URI);
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const db = await connectToDatabase();
    const chats = db.collection('chats');
    const messages = db.collection('messages');

    // TTL Index for 24h (86400 seconds)
    await messages.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 86400 });

    const { action, payload } = req.body;

    switch (action) {
      case 'REQUEST_CHAT':
        // Request a user by name
        const { from, to } = payload;
        await chats.updateOne(
          { users: { $all: [from, to] } },
          { $set: { users: [from, to], lastActivity: new Date() } },
          { upsert: true }
        );
        return res.json({ success: true });

      case 'SEND_MESSAGE':
        const { sender, recipient, encryptedText } = payload;
        const msg = {
          users: [sender, recipient],
          sender,
          text: encryptedText,
          createdAt: new Date(),
          status: 'sent'
        };
        await messages.insertOne(msg);
        return res.json({ success: true, message: msg });

      case 'GET_CHATS':
        const { user } = payload;
        const result = await chats.find({ users: user }).sort({ lastActivity: -1 }).toArray();
        return res.json(result);

      case 'GET_MESSAGES':
        const { u1, u2 } = payload;
        const msgs = await messages.find({ users: { $all: [u1, u2] } }).sort({ createdAt: 1 }).toArray();
        return res.json(msgs);

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
