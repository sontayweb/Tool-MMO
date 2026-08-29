import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'apps/api/.env') });

import mongoose from 'mongoose';
import { AccountParser } from './packages/shared/src/account.parser';

async function fixCorruptedAccounts() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arms-v4';
  console.log(`Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  if (!db) {
    console.error('Failed to connect to database');
    process.exit(1);
  }

  const accountsCol = db.collection('accounts');
  
  // Find accounts that were corrupted (username starts with M.C or is excessively long)
  const query = { 
    $or: [
      { username: { $regex: /^M\.C/i } },
      { username: { $type: "string" } } // We'll just fetch string and filter below for safety if needed, but regex is better.
    ]
  };

  const corruptedAccounts = await accountsCol.find({ username: { $regex: /^M\.C/i } }).toArray();
  console.log(`Found ${corruptedAccounts.length} corrupted accounts to fix.`);

  let fixedCount = 0;
  let failedCount = 0;

  for (const acc of corruptedAccounts) {
    if (!acc.raw || !acc.raw.values || !Array.isArray(acc.raw.values)) {
      console.log(`Skip ID ${acc._id} - missing raw values`);
      continue;
    }

    try {
      // Re-parse using the fixed parser
      const parsed = AccountParser.parseRow(acc.raw.values, acc.raw.row_number || 1);
      
      if (parsed && parsed.username && parsed.is_valid) {
        // Prepare update fields
        const updateFields: any = {
          username: parsed.username,
          username_normalized: parsed.username_normalized,
        };

        if (parsed.platform && parsed.platform !== 'OTHER') {
          updateFields.platform = parsed.platform;
        }

        // We should also update token, session_token if parsed found them. 
        // Note: The worker normally encrypts these fields before saving.
        // For a quick fix, since the system encrypts tokens using CryptoService, 
        // we might just fix the username and let the rest be for now, 
        // OR we can just set the unencrypted token if the system supports it (which it doesn't, it uses token_enc).
        // Let's just fix the username, username_normalized and platform for the UI to display correctly.
        
        await accountsCol.updateOne(
          { _id: acc._id },
          { $set: updateFields }
        );
        console.log(`Successfully fixed ID ${acc._id}. Old Username: ${acc.username.substring(0, 30)}... -> New Username: ${parsed.username}`);
        fixedCount++;
      } else {
        failedCount++;
        console.log(`Failed to parse valid username for ID ${acc._id}. Parsed username: ${parsed.username}`);
      }
    } catch (e) {
      failedCount++;
      console.error(`Error processing ID ${acc._id}:`, e);
    }
  }

  console.log(`Done! Fixed: ${fixedCount}. Failed: ${failedCount}.`);
  await mongoose.disconnect();
}

fixCorruptedAccounts().catch(console.error);
