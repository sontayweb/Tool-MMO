import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TeamDocument = Team & Document;

@Schema({ timestamps: true })
export class Team {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string; // e.g. TEAM_HA_NOI, TEAM_TIKTOK_US

  @Prop({ required: true, trim: true })
  display_name: string; // e.g. "Team Hà Nội"

  @Prop({ default: '' })
  description?: string;

  @Prop({ default: '#8b5cf6' })
  color?: string;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: 0 })
  member_count?: number;

  @Prop({ default: 'SYSTEM' })
  created_by?: string;
}

export const TeamSchema = SchemaFactory.createForClass(Team);
