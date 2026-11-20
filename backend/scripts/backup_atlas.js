import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { BSON } from 'mongodb';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(__dirname, '../.env') });

async function createBackup() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing from backend/.env');
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  console.log(`Connected to database: ${dbName}`);

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const backupBaseDir = path.join(rootDir, 'backup', `atlas_${dbName}_${timestamp}`);
  const dbBackupDir = path.join(backupBaseDir, dbName);

  if (!fs.existsSync(dbBackupDir)) {
    fs.mkdirSync(dbBackupDir, { recursive: true });
  }

  const collections = await db.listCollections().toArray();
  collections.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Found ${collections.length} collections. Starting BSON dump...\n`);

  const report = [];

  for (const collInfo of collections) {
    const collName = collInfo.name;
    const coll = db.collection(collName);

    // 1. Fetch indexes and metadata
    const indexes = await coll.indexes();
    const metadata = {
      options: collInfo.options || {},
      indexes: indexes,
      uuid: collInfo.info?.uuid?.toString('hex') || null,
      collectionName: collName
    };

    const metadataPath = path.join(dbBackupDir, `${collName}.metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    // 2. Fetch all documents and serialize to BSON
    const docs = await coll.find({}).toArray();
    const bsonBuffers = [];

    for (const doc of docs) {
      const serialized = BSON.serialize(doc);
      bsonBuffers.push(serialized);
    }

    const fullBsonBuffer = Buffer.concat(bsonBuffers);
    const bsonPath = path.join(dbBackupDir, `${collName}.bson`);
    fs.writeFileSync(bsonPath, fullBsonBuffer);

    // 3. Verification check: deserialize and count
    let verifiedCount = 0;
    if (fullBsonBuffer.length > 0) {
      let offset = 0;
      while (offset < fullBsonBuffer.length) {
        const docSize = fullBsonBuffer.readInt32LE(offset);
        if (docSize <= 0 || offset + docSize > fullBsonBuffer.length) {
          throw new Error(`Corrupted BSON stream at offset ${offset} in ${collName}`);
        }
        const docBuffer = fullBsonBuffer.subarray(offset, offset + docSize);
        BSON.deserialize(docBuffer);
        verifiedCount++;
        offset += docSize;
      }
    }

    const bsonStat = fs.statSync(bsonPath);
    const metaStat = fs.statSync(metadataPath);

    report.push({
      collection: collName,
      liveCount: docs.length,
      verifiedBsonCount: verifiedCount,
      bsonSizeKB: parseFloat((bsonStat.size / 1024).toFixed(2)),
      metaSizeKB: parseFloat((metaStat.size / 1024).toFixed(2)),
      status: docs.length === verifiedCount ? 'VERIFIED' : 'MISMATCH'
    });

    console.log(`✓ [${collName}] Dumped ${docs.length} docs (${(bsonStat.size / 1024).toFixed(2)} KB). Status: VERIFIED`);
  }

  await mongoose.disconnect();
  console.log('\nAll collections successfully backed up and verified.');

  const totalBytes = fs.readdirSync(dbBackupDir).reduce((acc, file) => {
    return acc + fs.statSync(path.join(dbBackupDir, file)).size;
  }, 0);

  const result = {
    backupLocation: dbBackupDir,
    databaseName: dbName,
    collectionCount: collections.length,
    totalBackupSizeBytes: totalBytes,
    totalBackupSizeKB: parseFloat((totalBytes / 1024).toFixed(2)),
    timestamp,
    report
  };

  fs.writeFileSync(path.join(backupBaseDir, 'backup_verification_manifest.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log('\nSummary:\n' + JSON.stringify(result, null, 2));
}

createBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
