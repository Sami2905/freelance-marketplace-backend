import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  content: string;
  sender: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  readBy: mongoose.Types.ObjectId[];
  attachments: Array<{
    url: string;
    type: 'image' | 'document' | 'other';
    name: string;
    size: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    content: {
      type: String,
      required: false,
      trim: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    attachments: [
      {
        url: { type: String, required: true },
        type: {
          type: String,
          enum: ['image', 'document', 'other'],
          required: true,
        },
        name: { type: String, required: true },
        size: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

// Index for faster querying of messages by order
messageSchema.index({ order: 1, createdAt: -1 });

// Add a text index for message content search
messageSchema.index({ content: 'text' });

// Virtual for unread count
messageSchema.virtual('unreadCount', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'order',
  match: { readBy: { $ne: ['$sender'] } },
  count: true,
});

const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;
