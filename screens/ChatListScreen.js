import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getChats, requestChat, registerUser, acceptChat } from '../services/chatService';

export default function ChatListScreen({ navigation }) {
  const { colors } = useTheme();
  const [chats, setChats] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [targetUser, setTargetUser] = React.useState('');
  const [requesting, setRequesting] = React.useState(false);

  React.useEffect(() => {
    registerUser(); // Register current device profile
    const unsub = navigation.addListener('focus', () => {
      fetchChats();
    });
    return unsub;
  }, [navigation]);

  const fetchChats = async () => {
    setLoading(true);
    const data = await getChats();
    setChats(data);
    setLoading(false);
  };

  const handleAccept = async (id) => {
    await acceptChat(id);
    fetchChats();
  };

  const handleRequest = async () => {
    if (!targetUser.trim()) return;
    setRequesting(true);
    const res = await requestChat(targetUser);
    setRequesting(false);
    if (!res.error) {
      setIsModalVisible(false);
      setTargetUser('');
      fetchChats();
      Alert.alert('Request Sent!', `We've sent a global chat request to ${targetUser}. You can chat as soon as they accept!`);
    } else {
        Alert.alert('Error', res.error || 'User not found or connection lost.');
    }
  };

  const renderChatItem = ({ item }) => {
    const isPendingAndReceived = item.isReceived;
    const isAccepted = item.status === 'accepted';

    return (
      <View style={styles.chatItem}>
        <View style={[styles.avatar, { backgroundColor: colors.border }]}>
          <Ionicons name="person" size={24} color={isAccepted ? colors.primary : colors.textSecondary} />
          {isAccepted && <View style={styles.onlineStatus} />}
        </View>
        <TouchableOpacity 
           style={styles.chatInfo} 
           onPress={() => isAccepted && navigation.navigate('Chat', { chatId: item.id, name: item.name })}
           disabled={!isAccepted}
        >
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, { color: colors.text }]}>{item.name}</Text>
            {isAccepted && (
              <Text style={[styles.chatTime, { color: colors.textSecondary }]}>
                {item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
              </Text>
            )}
          </View>
          <Text style={[styles.lastMessage, { color: isAccepted ? colors.textSecondary + 'aa' : colors.primary }]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </TouchableOpacity>
        
        {isPendingAndReceived && (
          <TouchableOpacity 
            style={[styles.acceptBtn, { backgroundColor: colors.primary }]} 
            onPress={() => handleAccept(item.id)}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Accept</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Global Chats</Text>
        <TouchableOpacity style={styles.headerButton} onPress={fetchChats}>
          <Ionicons name="reload" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.border + '33' }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput 
          placeholder="Search global users..." 
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading && !chats.length ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList 
            data={chats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={renderChatItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={60} color={colors.border} />
                <Text style={{ color: colors.textSecondary, marginTop: 15, fontSize: 16 }}>Nobody here yet.</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, opacity: 0.6 }}>Tap + to start a global chat!</Text>
            </View>
            }
        />
      )}

      {/* New Chat Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Enter Username</Text>
            <TextInput
                style={[styles.modalInput, { color: colors.text, borderBottomColor: colors.primary }]}
                placeholder="e.g. John Doe or Emily"
                placeholderTextColor={colors.textSecondary}
                value={targetUser}
                onChangeText={setTargetUser}
                autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}><Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleRequest} disabled={requesting}>
                {requesting ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '700' }}>Request Chat</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setIsModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 15,
    height: 44,
    borderRadius: 22,
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  chatItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  onlineStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatInfo: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { fontSize: 17, fontWeight: '700' },
  chatTime: { fontSize: 12 },
  lastMessage: { fontSize: 14 },
  acceptBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    padding: 25,
    borderRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
  },
  modalInput: {
    borderBottomWidth: 1.5,
    fontSize: 18,
    paddingVertical: 10,
    marginBottom: 25,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 30,
    alignItems: 'center',
  },
});
