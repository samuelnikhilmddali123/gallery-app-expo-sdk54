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
    const users = db.collection('users');

    // TTL Index for 24h (86400 seconds)
    await messages.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 86400 });

    const { action, payload } = req.body;

    switch (action) {
      case 'REGISTER':
        // Register user name during app startup
        const { username } = payload;
        await users.updateOne(
          { username },
          { $set: { username, lastSeen: new Date() } },
          { upsert: true }
        );
        return res.json({ success: true });

      case 'SEARCH_USER':
        const { q } = payload;
        const found = await users.findOne({ username: q });
        return res.json({ exists: !!found });

      case 'REQUEST_CHAT':
        // Check if target user exists
        const { from, to } = payload;
        const targetExists = await users.findOne({ username: to });
        if (!targetExists) return res.status(404).json({ error: 'User not found in global registry!' });

        // Add a pending request
        await chats.updateOne(
          { users: { $all: [from, to] } },
          { 
            $set: { 
              users: [from, to], 
              status: 'pending', 
              requestedBy: from,
              lastActivity: new Date() 
            } 
          },
          { upsert: true }
        );
        return res.json({ success: true });

      case 'ACCEPT_CHAT':
        const { chatId, user } = payload;
        // Verify only the recipient can accept
        await chats.updateOne(
          { users: { $all: [user, chatId] }, status: 'pending', requestedBy: { $ne: user } },
          { $set: { status: 'accepted', lastActivity: new Date() } }
        );
        return res.json({ success: true });

      case 'SEND_MESSAGE':
        const { sender, recipient, encryptedText } = payload;
        // Verify chat is accepted before sending
        const chat = await chats.findOne({ users: { $all: [sender, recipient] }, status: 'accepted' });
        if (!chat) return res.status(403).json({ error: 'Chat not accepted yet!' });

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
        const { user: me } = payload;
        const list = await chats.find({ users: me }).sort({ lastActivity: -1 }).toArray();
        return res.json(list);

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
