// src/components/ChatMessage.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import OpengraphReactComponent from 'opengraph-react';
import Colors from '../../app/constants/Colors';

// Helper function to detect URLs in text
const extractUrls = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

interface ChatMessageProps {
  content: string;
  sender: string;
  timestamp: Date;
}

export default function ChatMessage({ content, sender, timestamp }: ChatMessageProps) {
  const urls = extractUrls(content);
  
  return (
    <View style={styles.container}>
      <Text style={styles.sender}>{sender}</Text>
      <Text style={styles.content}>{content}</Text>
      
      {urls.map((url, index) => (
        <View key={index} style={styles.linkPreview}>
          <OpengraphReactComponent
            site={url}
            component="small"
            // Get a free API key from https://dashboard.opengraph.io
            appId={process.env.EXPO_PUBLIC_OPENGRAPH_API_KEY}
          />
        </View>
      ))}
      
      <Text style={styles.timestamp}>
        {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    marginVertical: 5,
    backgroundColor: Colors.card,
    borderRadius: 8,
  },
  sender: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  content: {
    marginBottom: 5,
  },
  linkPreview: {
    marginTop: 5,
    marginBottom: 5,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.inactive,
    alignSelf: 'flex-end',
  },
});