import { Schema, Document, Types } from 'mongoose';

// Account Types & Schema
export type AccountStatus = "AVAILABLE" | "SOLD" | "USED" | "ERROR" | "BLACKLISTED";

export interface IAccountHistory {
  action: string;
  actor_id: string;
  timestamp: Date;
  note?: string;
  batch_id?: Types.ObjectId;
  diff?: any;
}

export interface IAccount extends Document {
  platform?: "SHOPEE" | "TIKTOK" | "FACEBOOK" | "MAIL" | "OTHER";
  username: string;
  username_normalized: string;
  password_enc?: string;
  cookie_enc?: string;
  token_enc?: string;
  session_token?: string;
  machine_id?: string;
  email?: string;
  email_password_enc?: string;
  custom_metadata?: Record<string, any>;
  raw?: {
    values: Record<string, any>;
    row_number?: number;
    row_hash?: string;
  };
  metadata: {
    source_file?: string;
    source_url?: string;
    source_sheet?: string;
    source_tab_label?: string;
    managed_by?: string;
    team?: string;
    batch_id?: Types.ObjectId;
    first_scan_at: Date;
    last_scan_at: Date;
  };
  status: AccountStatus;
  health_status?: "UNKNOWN" | "LIVE" | "SOFT_DEAD" | "DEAD" | "IVS_PENDING";
  health_checked_at?: Date;
  source_system?: string;
  source_job_id?: string;
  shopee_cookies?: {
    SPC_ST?: string;
    SPC_EC?: string;
    SPC_F?: string;
    SPC_U?: string;
  };
  consumption?: {
    sold_to?: string;
    sold_at?: Date;
    order_id?: string;
    note?: string;
  };
  quality?: {
    has_cookie: boolean;
    has_token: boolean;
    has_email: boolean;
    parse_errors: string[];
    last_check_at?: Date;
    last_check_result?: string;
  };
  tags: string[];
  history: IAccountHistory[];
  createdAt: Date;
  updatedAt: Date;
}

export const AccountHistorySchema = new Schema<IAccountHistory>({
  action: { type: String, required: true },
  actor_id: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: { type: String },
  batch_id: { type: Schema.Types.ObjectId, ref: 'ScanBatch' },
  diff: { type: Schema.Types.Mixed }
}, { _id: false });

export const AccountSchema = new Schema<IAccount>(
  {
    platform: {
      type: String,
      enum: ["SHOPEE", "TIKTOK", "FACEBOOK", "MAIL", "OTHER"],
      default: "SHOPEE",
      index: true
    },
    username: { type: String, required: true },
    username_normalized: { type: String, required: true, unique: true },
    password_enc: { type: String },
    cookie_enc: { type: String },
    token_enc: { type: String },
    session_token: { type: String },
    machine_id: { type: String, index: true },
    email: { type: String },
    email_password_enc: { type: String },
    custom_metadata: { type: Schema.Types.Mixed },
    raw: {
      values: { type: Map, of: Schema.Types.Mixed },
      row_number: Number,
      row_hash: String
    },
    metadata: {
      source_file: String,
      source_url: String,
      source_sheet: String,
      source_tab_label: String,
      managed_by: String,
      team: { type: String, index: true },
      batch_id: { type: Schema.Types.ObjectId, ref: 'ScanBatch' },
      first_scan_at: { type: Date, default: Date.now },
      last_scan_at: { type: Date, default: Date.now }
    },
    status: {
      type: String,
      enum: ["AVAILABLE", "SOLD", "USED", "ERROR", "BLACKLISTED"],
      default: "AVAILABLE",
      index: true
    },
    health_status: {
      type: String,
      enum: ["UNKNOWN", "LIVE", "SOFT_DEAD", "DEAD", "IVS_PENDING"],
      default: "UNKNOWN",
      index: true
    },
    health_checked_at: Date,
    source_system: { type: String, index: true },
    source_job_id: String,
    shopee_cookies: {
      SPC_ST: String,
      SPC_EC: String,
      SPC_F: String,
      SPC_U: String
    },
    consumption: {
      sold_to: String,
      sold_at: Date,
      order_id: String,
      note: String
    },
    quality: {
      has_cookie: { type: Boolean, default: false },
      has_token: { type: Boolean, default: false },
      has_email: { type: Boolean, default: false },
      parse_errors: [String],
      last_check_at: Date,
      last_check_result: String
    },
    tags: [String],
    history: [AccountHistorySchema]
  },
  { timestamps: true }
);


AccountSchema.index({ status: 1, "metadata.last_scan_at": -1 });
AccountSchema.index({ "metadata.source_sheet": 1, status: 1 });
AccountSchema.index({ "metadata.batch_id": 1 });
AccountSchema.index({ email: 1 }, { sparse: true });


// ScanBatch Types & Schema
export type ScanBatchStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface IScanBatchSheet {
  name: string;
  total: number;
  valid: number;
  new: number;
  duplicate: number;
  error: number;
}

export interface IScanBatchRowError {
  sheet: string;
  row_number: number;
  raw_line: string;
  reason: string;
}

export interface IScanBatch extends Document {
  status: ScanBatchStatus;
  file_name: string;
  file_size?: number;
  sheets: IScanBatchSheet[];
  total_rows: number;
  valid_rows: number;
  new_accounts: number;
  duplicate_accounts: number;
  error_rows: number;
  row_errors: IScanBatchRowError[];
  managed_by?: string;
  callback_url?: string;
  spreadsheet_id?: string;
  started_at: Date;
  completed_at?: Date;
  error_message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ScanBatchSheetSchema = new Schema<IScanBatchSheet>({
  name: { type: String, required: true },
  total: { type: Number, default: 0 },
  valid: { type: Number, default: 0 },
  new: { type: Number, default: 0 },
  duplicate: { type: Number, default: 0 },
  error: { type: Number, default: 0 }
}, { _id: false });

export const ScanBatchRowErrorSchema = new Schema<IScanBatchRowError>({
  sheet: { type: String, required: true },
  row_number: { type: Number, required: true },
  raw_line: { type: String },
  reason: { type: String, required: true }
}, { _id: false });

export const ScanBatchSchema = new Schema<IScanBatch>(
  {
    status: {
      type: String,
      enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true
    },
    file_name: { type: String, required: true },
    file_size: Number,
    sheets: [ScanBatchSheetSchema],
    total_rows: { type: Number, default: 0 },
    valid_rows: { type: Number, default: 0 },
    new_accounts: { type: Number, default: 0 },
    duplicate_accounts: { type: Number, default: 0 },
    error_rows: { type: Number, default: 0 },
    row_errors: [ScanBatchRowErrorSchema],
    managed_by: String,
    callback_url: String,
    spreadsheet_id: String,
    started_at: { type: Date, default: Date.now },
    completed_at: Date,
    error_message: String
  },
  { timestamps: true }
);


// ExportJob Types & Schema
export type ExportJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface IExportJob extends Document {
  status: ExportJobStatus;
  template_name?: string;
  template_format?: string;
  file_format: "TXT" | "CSV" | "XLSX";
  filters: any;
  mark_as_used_after_export: boolean;
  total_rows: number;
  file_path?: string;
  download_url?: string;
  expires_at?: Date;
  managed_by?: string;
  error_message?: string;
  started_at: Date;
  completed_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const ExportJobSchema = new Schema<IExportJob>(
  {
    status: {
      type: String,
      enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true
    },
    template_name: String,
    template_format: String,
    file_format: { type: String, enum: ["TXT", "CSV", "XLSX"], required: true },
    filters: { type: Schema.Types.Mixed },
    mark_as_used_after_export: { type: Boolean, default: false },
    total_rows: { type: Number, default: 0 },
    file_path: String,
    download_url: String,
    expires_at: Date,
    managed_by: String,
    error_message: String,
    started_at: { type: Date, default: Date.now },
    completed_at: Date
  },
  { timestamps: true }
);


// AuditLog Types & Schema
export interface IAuditLog extends Document {
  action: string;
  actor_id: string;
  actor_username?: string;
  ip_address?: string;
  timestamp: Date;
  target_type?: string;
  target_id?: string;
  details?: any;
  createdAt: Date;
  updatedAt: Date;
}

export const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    actor_id: { type: String, required: true, index: true },
    actor_username: String,
    ip_address: String,
    timestamp: { type: Date, default: Date.now, index: true },
    target_type: String,
    target_id: String,
    details: Schema.Types.Mixed
  },
  { timestamps: true }
);

// User Types & Schema (Multi-Team & RBAC)
export interface IUser extends Document {
  username: string;
  password_hash: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER' | 'AUDITOR';
  team: string; // 'ALL' or specific team like 'TEAM_HA_NOI'
  display_name?: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, index: true },
    password_hash: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['OWNER', 'MANAGER', 'MEMBER', 'VIEWER', 'AUDITOR'], 
      default: 'MEMBER',
      index: true
    },
    team: { type: String, default: 'ALL', index: true },
    display_name: { type: String },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE', index: true }
  },
  { timestamps: true }
);

