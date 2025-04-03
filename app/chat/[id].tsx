import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text,
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Modal,
  Pressable
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GiftedChat, Bubble, Send, Message as GiftedMessage, IMessage } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../contexts/UserStore';
import { usePresence } from '../../src/contexts/PresenceContext';
import * as MessageService from '../../src/services/MessageService';
import * as UserService from '../../src/services/UserService';
import { Message, MessageContentType } from '../../src/models/Message';
import UserAvatar from '../../src/components/UserAvatar';
import Colors from '../constants/Colors';


// Self-destruct options
const SELF_DESTRUCT_OPTIONS = [
  { label: '5 minutes', value: '5m' },
  { label: '30 minutes', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '1 day', value: '1d' },
  { label: '1 week', value: '1w' }
] as const;

type SelfDestructDuration = typeof SELF_DESTRUCT_OPTIONS[number]['value'];

// Add this helper function after SELF_DESTRUCT_OPTIONS
const getDurationInMs = (duration: SelfDestructDuration): number => {
  const durations: Record<SelfDestructDuration, number> = {
    '5m': 5 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000
  };
  return durations[duration];
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const recipientId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selfDestructDuration, setSelfDestructDuration] = useState<SelfDestructDuration | null>(null);
  const [showSelfDestructModal, setShowSelfDestructModal] = useState(false);
  const [recipient, setRecipient] = useState<{ id: string; name: string; avatar?: string }>({
    id: recipientId,
    name: 'Loading...'
  });
  
  const { watchUsers, getUserPresence } = usePresence();
  
  // Convert API messages to GiftedChat format
  const convertToGiftedMessage = (message: Message): IMessage => {
    return {
      _id: message.id,
      text: message.content,
      createdAt: message.createdAt,
      user: {
        _id: message.sender,
        name: message.sender === user?.id ? user.username : recipient.name,
        avatar: message.sender === user?.id ? user?.profilePic : recipient.avatar
      }
    };
  };
  
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        // Load recipient details first
        try {
          const userData = await UserService.getUserById(recipientId);
          if (userData) {
            setRecipient({
              id: userData.id,
              name: userData.username,
              avatar: userData.profilePic
            });
            
            // Watch this user for presence updates
            watchUsers([userData.id]);
          } else {
            throw new Error('User not found');
          }
        } catch (error) {
          console.error('Failed to load recipient data:', error);
          Alert.alert(
            'Error',
            'Could not find the recipient. They may have deleted their account.',
            [{ 
              text: 'Go Back',
              onPress: () => router.back()
            }]
          );
          return;
        }

        // Fetch messages from the API with decryption
        const apiMessages = await MessageService.getDecryptedMessages(recipientId);
        
        // Convert to GiftedChat format and sort by date
        const giftedMessages = apiMessages
          .map(convertToGiftedMessage)
          .sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
        
        setMessages(giftedMessages);
        
        // Mark messages as read
        const unreadMessageIds = apiMessages
          .filter((m: Message) => m.sender !== user?.id && !m.read)
          .map((m: Message) => m.id);
          
        if (unreadMessageIds.length > 0) {
          await MessageService.markMessagesAsRead(unreadMessageIds);
        }
        
      } catch (error) {
        console.error('Failed to load messages:', error);
        
        // Show specific error messages based on the error type
        let errorMessage = 'Failed to load messages. Please try again later.';
        if (error instanceof Error) {
          if (error.message.includes('decrypt')) {
            errorMessage = 'Could not decrypt messages. Your keys may need to be refreshed.';
          } else if (error.message.includes('network')) {
            errorMessage = 'Network error. Please check your connection.';
          }
        }
        
        Alert.alert(
          'Error',
          errorMessage,
          [{ text: 'OK' }]
        );
        
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (recipientId && user) {
      loadMessages();
    }
  }, [recipientId, user, watchUsers, router]);
  
  // Get recipient status text
  const getStatusText = () => {
    if (!recipient.id) return '';
    
    const presence = getUserPresence(recipient.id);
    if (!presence) return '';
    
    return presence.status;
  };

  // Handle self-destruct selection
  const handleSelfDestructSelect = (duration: SelfDestructDuration) => {
    setSelfDestructDuration(duration);
    setShowSelfDestructModal(false);
  };

  const onSend = useCallback(async (newGiftedMessages: IMessage[] = []) => {
    if (!user || !recipient.id) return;
    
    setIsSending(true);
    const tempMessageId = newGiftedMessages[0]._id;
    
    try {
      const newMessage = newGiftedMessages[0];
      
      // Create a new message in the API format
      const messageToSend: Omit<Message, 'id' | 'createdAt' | 'updatedAt' > = {
        sender: user.id,
        recipient: recipient.id,
        content: newMessage.text,
        contentType: MessageContentType.TEXT,
        sent: false,
        delivered: false,
        read: false,
        selfDestructEnabled: selfDestructDuration ? true : false,
        selfDestructAt: selfDestructDuration ? new Date(Date.now() + getDurationInMs(selfDestructDuration)) : new Date(0)
      };
      
      // Add the message to the UI immediately with pending status
      setMessages(previousMessages => 
        GiftedChat.append(previousMessages, [{
          ...newGiftedMessages[0],
          pending: true
        }])
      );
      
      // Send to the API
      const sentMessage = await MessageService.sendMessage(messageToSend);
      
      // Reset self-destruct after sending
      setSelfDestructDuration(null);
      
      // Update the message with success status
      setMessages(previousMessages => 
        previousMessages.map(msg => 
          msg._id === tempMessageId 
            ? { 
                ...msg, 
                _id: sentMessage.id,
                pending: false,
                sent: true 
              } 
            : msg
        )
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Show specific error messages based on the error type
      let errorMessage = 'Failed to send message. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('encrypt')) {
          errorMessage = 'Could not encrypt message. The recipient\'s key may be missing.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection.';
        }
      }
      
      Alert.alert('Error', errorMessage);
      
      // Update the message with error status
      setMessages(previousMessages => 
        previousMessages.map(msg => 
          msg._id === tempMessageId 
            ? { 
                ...msg, 
                pending: false,
                error: true 
              } 
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  }, [user, recipient, selfDestructDuration]);

  // Add retry handler
  const handleRetry = useCallback(async (message: IMessage) => {
    const messageIndex = messages.findIndex(msg => msg._id === message._id);
    if (messageIndex === -1) return;

    // Create a new message object without the error state
    const newMessage = {
      ...message,
      error: undefined,
      pending: undefined,
      _id: Math.random().toString()
    };

    // Remove the failed message
    setMessages(prev => prev.filter(msg => msg._id !== message._id));
    
    // Send the message again
    await onSend([newMessage]);
  }, [messages, onSend]);
  
  const renderBubble = (props: any) => {
    const message = props.currentMessage;
    const isError = message.error;
    const isPending = message.pending;

    return (
      <View>
        <Bubble
          {...props}
          wrapperStyle={{
            right: {
              backgroundColor: isError ? Colors.error : Colors.primary,
              opacity: isPending ? 0.7 : 1,
            },
            left: {
              backgroundColor: Colors.card,
            },
          }}
          textStyle={{
            right: {
              color: Colors.text,
            },
            left: {
              color: Colors.text,
            },
          }}
        />
        {isPending && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        )}
        {isError && (
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => handleRetry(message)}
          >
            <Ionicons name="refresh" size={16} color={Colors.error} />
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  const renderSend = (props: any) => {
    return (
      <Send
        {...props}
        disabled={props.text.trim().length === 0 || isSending}
        containerStyle={styles.sendContainer}
      >
        {isSending ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <View style={[styles.sendButton, props.text.trim().length === 0 ? styles.sendButtonDisabled : {}]}>
            <Ionicons name="send" size={20} color={Colors.text} />
          </View>
        )}
      </Send>
    );
  };
  
  // Render input toolbar with self-destruct button
  const renderInputToolbar = (props: any) => {
    return (
      <View style={styles.inputContainer}>
        <TouchableOpacity 
          onPress={() => setShowSelfDestructModal(true)}
          style={[
            styles.selfDestructButton,
            selfDestructDuration ? styles.selfDestructButtonActive : {}
          ]}
        >
          <Ionicons 
            name="timer-outline" 
            size={24} 
            color={selfDestructDuration ? Colors.primary : Colors.inactive} 
          />
        </TouchableOpacity>
        <TextInput 
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.inactive}
          value={props.text}
          onChangeText={props.onTextChanged}
          multiline
        />
        {renderSend(props)}
      </View>
    );
  };

  // Self-destruct modal
  const renderSelfDestructModal = () => (
    <Modal
      visible={showSelfDestructModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowSelfDestructModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Set Message Lifespan</Text>
          {SELF_DESTRUCT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                selfDestructDuration === option.value && styles.optionButtonActive
              ]}
              onPress={() => handleSelfDestructSelect(option.value)}
            >
              <Text style={[
                styles.optionText,
                selfDestructDuration === option.value && styles.optionTextActive
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setSelfDestructDuration(null);
              setShowSelfDestructModal(false);
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerTitleContainer}
          onPress={() => recipient.id && router.push(`/user/${recipient.id}`)}
        >
          {recipient.id ? (
            <UserAvatar 
              userId={recipient.id}
              username={recipient.name}
              profilePic={recipient.avatar}
              showStatus={true}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={32} color={Colors.primary} />
          )}
          <View>
            <Text style={styles.headerTitle}>{recipient.name}</Text>
            <Text style={styles.headerSubtitle}>
              {recipient.id ? getStatusText() : 'End-to-End Encrypted'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <GiftedChat
          messages={messages}
          onSend={onSend}
          user={{
            _id: user?.id || '1',
            name: user?.username || 'Me',
            avatar: user?.profilePic || undefined,
          }}
          renderBubble={renderBubble}
          renderInputToolbar={renderInputToolbar}
          renderAvatar={null}
          renderTime={(props) => (
            <View style={styles.timeContainer}>
              <Text style={[styles.timeText, { color: props.position === 'left' ? Colors.inactive : Colors.text }]}>
                {new Date(props.currentMessage?.createdAt || 0).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </View>
          )}
          maxComposerHeight={100}
          minComposerHeight={40}
          placeholder="Type a message..."
          alwaysShowSend
          inverted={true}
        />
        {renderSelfDestructModal()}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingLeft: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: 10,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.inactive,
    marginLeft: 10,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginHorizontal: 10,
    marginVertical: 5,
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  input: {
    flex: 1,
    minHeight: 40,
    color: Colors.text,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.inactive,
  },
  timeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeText: {
    fontSize: 10,
  },
  selfDestructButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selfDestructButtonActive: {
    backgroundColor: Colors.card,
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  optionButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  optionButtonActive: {
    backgroundColor: Colors.primary,
  },
  optionText: {
    fontSize: 16,
    color: Colors.text,
  },
  optionTextActive: {
    color: Colors.text,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.inactive,
  },
  statusContainer: {
    position: 'absolute',
    right: 10,
    bottom: -20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryButton: {
    position: 'absolute',
    right: 10,
    bottom: -20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 4,
    borderRadius: 12,
  },
  retryText: {
    color: Colors.error,
    fontSize: 12,
    marginLeft: 4,
  },
}); 