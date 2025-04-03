// Message model
export interface Message {
  id: string;
  sender: string; // user id
  senderUsername?: string; // username for display
  recipient?: string; // user id, undefined if sent to a garden
  garden?: string; // garden id, undefined if direct message
  channel?: string; // channel id, undefined if direct message or garden-wide
  content: string;
  contentType: MessageContentType;
  sent: boolean;
  delivered: boolean;
  read: boolean;
  selfDestructEnabled: boolean;
  selfDestructAt: Date;
  createdAt: Date;
  updatedAt: Date;
  replyToId?: string; // For threaded conversations
}

  export enum MessageContentType {
    TEXT = 'text',
    IMAGE = 'image',
    VIDEO = 'video',
    AUDIO = 'audio',
    FILE = 'file',
    SYSTEM = 'system'
  }