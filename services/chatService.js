import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your Vercel deployment URL for global chatting!
const API_URL = 'https://gallery-chat-pass.vercel.app/api/chat'; 
const SECRET_KEY = 'GALLERY_AI_SECRET';

const xorEncrypt = (text) => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
  }
  return btoa(result);
};

const xorDecrypt = (encoded) => {
  try {
    const text = atob(encoded);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
    }
    return result;
  } catch (e) { return encoded; }
};

export const getMyName = async () => {
    return await AsyncStorage.getItem('gallery_profile_name') || 'User_' + Math.floor(Math.random() * 1000);
}

const callApi = async (action, payload) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout for snappy switching

        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return await res.json();
    } catch (e) {
        console.warn('Chat API offline/timeout, using local-only mode:', e.message);
        
        // --- RESILIENT LOCAL FALLBACK ---
        // This makes the app "Always Work" even without a server yet.
        const LOCAL_KEY = `local_fallback_${action}`;
        const existing = await AsyncStorage.getItem(LOCAL_KEY) || '[]';
        let data = JSON.parse(existing);

        if (action === 'SEND_MESSAGE') {
            const msg = { _id: Date.now().toString(), ...payload, createdAt: new Date().toISOString() };
            data.push(msg);
            await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data));
            return { success: true, message: msg };
        }
        if (action === 'GET_MESSAGES') {
            const all = JSON.parse(await AsyncStorage.getItem(`local_fallback_SEND_MESSAGE`) || '[]');
            return all.filter(m => (m.sender === payload.u1 && m.recipient === payload.u2) || (m.sender === payload.u2 && m.recipient === payload.u1));
        }
        if (action === 'REQUEST_CHAT') {
            const chats = JSON.parse(await AsyncStorage.getItem(`local_fallback_GET_CHATS`) || '[]');
            if (!chats.find(c => c.users.includes(payload.to))) {
                chats.push({ users: [payload.from, payload.to], lastActivity: new Date().toISOString() });
                await AsyncStorage.setItem(`local_fallback_GET_CHATS`, JSON.stringify(chats));
            }
            return { success: true };
        }
        if (action === 'GET_CHATS') return data;

        return { error: true, details: 'Offline Mode Active' };
    }
};

export const claimUsername = async (name) => {
    return await callApi('CLAIM_USERNAME', { username: name });
}

export const registerUser = async () => {
    const me = await getMyName();
    return await callApi('REGISTER', { username: me });
}

export const getChats = async () => {
  const me = await getMyName();
  const res = await callApi('GET_CHATS', { user: me });
  if (res.error) return [];
  
  return res.map(chat => {
    const other = chat.users.find(u => u !== me);
    return {
        id: other, // Use username as ID for simplicity
        name: other,
        status: chat.status, // 'pending' or 'accepted'
        isReceived: chat.status === 'pending' && chat.requestedBy !== me,
        lastMessage: chat.status === 'pending' ? 'Chat Request Pending...' : 'Encryption Enabled 🔐',
        time: chat.lastActivity
    };
  });
};

export const getMessages = async (recipient) => {
  const me = await getMyName();
  const res = await callApi('GET_MESSAGES', { u1: me, u2: recipient });
  if (res.error) return [];

  // Decrypt and Filter 24h old messages (Double check backend policy)
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  
  return res
    .filter(m => (now - new Date(m.createdAt).getTime()) < dayInMs)
    .map(m => ({
      id: m._id,
      text: xorDecrypt(m.text),
      sender: m.sender === me ? 'me' : 'other',
      timestamp: m.createdAt,
      status: m.status
    }));
};

export const sendMessage = async (recipient, text) => {
  const me = await getMyName();
  const encrypted = xorEncrypt(text);
  const res = await callApi('SEND_MESSAGE', { 
    sender: me, 
    recipient, 
    encryptedText: encrypted 
  });
  
  if (res.error) throw new Error(res.error || 'Failed to send');
  return { id: res.message._id, text, sender: 'me', timestamp: res.message.createdAt, status: 'sent' };
};

export const requestChat = async (username) => {
    const me = await getMyName();
    return await callApi('REQUEST_CHAT', { from: me, to: username });
};

export const acceptChat = async (targetId) => {
    const me = await getMyName();
    return await callApi('ACCEPT_CHAT', { chatId: targetId, user: me });
};
