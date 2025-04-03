import React, { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../app/constants/Colors';
import * as ChannelService from '../services/ChannelService';
import { Channel } from '../models/Channel';

type CreateChannelModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (channel: Channel) => void;
  gardenId: string;
};

export default function CreateChannelModal({ 
  visible, 
  onClose, 
  onSuccess,
  gardenId
}: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAdministrative, setIsAdministrative] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const channel = await ChannelService.createChannel({
        name: name.trim(),
        description: description.trim() || undefined,
        gardenId,
        isAdministrative
      });
      
      onSuccess(channel);
      resetForm();
    } catch (error) {
      console.error('Error creating channel:', error);
      // Show error toast
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setName('');
    setDescription('');
    setIsAdministrative(false);
  };
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Create New Channel</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.input}
            placeholder="Channel Name"
            value={name}
            onChangeText={setName}
            maxLength={30}
          />
          
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={200}
          />
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Administrative Channel</Text>
            <Switch
              value={isAdministrative}
              onValueChange={setIsAdministrative}
              trackColor={{ false: Colors.inactive, true: Colors.primary }}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.loadingButton]}
            onPress={handleSubmit}
            disabled={loading || !name.trim()}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Creating...' : 'Create Channel'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    color: Colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  switchLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  loadingButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: Colors.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 