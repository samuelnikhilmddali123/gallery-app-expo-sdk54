import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getMessages, sendMessage } from '../services/chatService';

export default function ChatScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { chatId, name } = route.params;
  const [messages, setMessages] = React.useState([]);
  const [inputText, setInputText] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);

  React.useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    const data = await getMessages(chatId);
    setMessages(data);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const msg = await sendMessage(chatId, inputText);
    setMessages([...messages, msg]);
    setInputText('');
    setIsTyping(false);
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.sender === 'me' ? styles.myMessage : styles.otherMessage,
      { backgroundColor: item.sender === 'me' ? colors.primary : colors.border + '33' }
    ]}>
      <Text style={[styles.messageText, { color: item.sender === 'me' ? '#fff' : colors.text }]}>
        {item.text}
      </Text>
      <View style={styles.messageFooter}>
        <Text style={[styles.messageTime, { color: item.sender === 'me' ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {item.sender === 'me' && (
          <Ionicons 
            name={item.status === 'read' ? "checkmark-done" : "checkmark"} 
            size={14} 
            color={item.status === 'read' ? "#4FC3F7" : "rgba(255,255,255,0.7)"} 
            style={{ marginLeft: 4 }}
          />
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.headerStatus, { color: '#4CAF50' }]}>Online</Text>
        </View>
        <View style={styles.headerActions}>
           <TouchableOpacity><Ionicons name="videocam-outline" size={24} color={colors.primary} /></TouchableOpacity>
           <TouchableOpacity style={{ marginLeft: 20 }}><Ionicons name="call-outline" size={20} color={colors.primary} /></TouchableOpacity>
        </View>
      </View>

      <FlatList 
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
          <View style={[styles.inputBox, { backgroundColor: colors.border + '33' }]}>
            <TouchableOpacity><Ionicons name="happy-outline" size={24} color={colors.textSecondary} /></TouchableOpacity>
            <TextInput 
              placeholder="Type a message..." 
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text }]}
              value={inputText}
              onChangeText={val => {
                setInputText(val);
                setIsTyping(val.length > 0);
              }}
              multiline
            />
            <TouchableOpacity><Ionicons name="attach" size={24} color={colors.textSecondary} /></TouchableOpacity>
            <TouchableOpacity style={{ marginLeft: 15 }}><Ionicons name="camera-outline" size={24} color={colors.textSecondary} /></TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            onPress={handleSend}
          >
            <Ionicons name={inputText.length > 0 ? "send" : "mic"} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerButton: { padding: 5, marginLeft: -10 },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerName: { fontSize: 18, fontWeight: '700' },
  headerStatus: { fontSize: 12, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', marginRight: 5 },
  messageList: { padding: 15, paddingBottom: 20 },
  messageContainer: {
    maxWidth: '80%',
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginBottom: 10,
  },
  myMessage: { alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  otherMessage: { alignSelf: 'flex-start', borderBottomLeftRadius: 2 },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  messageTime: { fontSize: 10 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 15,
    gap: 10,
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 24,
    height: 48,
  },
  input: { flex: 1, marginHorizontal: 10, fontSize: 16, maxHeight: 100 },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
});
