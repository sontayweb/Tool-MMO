import { Schema, Document } from 'mongoose';

export interface IApiKeyDocument extends Document {
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[]; // ['READ_ACCOUNTS', 'WRITE_ACCOUNTS', 'CONSUME_ACCOUNTS']
  status: 'ACTIVE' | 'REVOKED';
  created_by: string;
  last_used_at?: Date;
  expires_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const ApiKeySchema = new Schema<IApiKeyDocument>({
  name: { type: String, required: true, trim: true },
  key_prefix: { type: String, required: true, index: true },
  key_hash: { type: String, required: true },
  scopes: { 
    type: [String], 
    default: ['READ_ACCOUNTS'], 
    enum: ['READ_ACCOUNTS', 'WRITE_ACCOUNTS', 'CONSUME_ACCOUNTS'] 
  },
  status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE', index: true },
  created_by: { type: String, required: true },
  last_used_at: { type: Date },
  expires_at: { type: Date },
}, {
  timestamps: true
});
