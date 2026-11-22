const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'database', 'room314.db');
const BACKUP_DIR = path.resolve(__dirname);

function backup() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `room314-backup-${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database file not found at:', DB_PATH);
    console.error('   Run "npm run migrate" first to create the database.');
    process.exit(1);
  }

  try {
    fs.copyFileSync(DB_PATH, backupPath);
    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log('✅ Backup created successfully!');
    console.log(`   File: ${backupName}`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   Path: ${backupPath}`);
    console.log('');
    console.log('To restore, copy this file to database/room314.db');
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  }
}

// Also copy WAL and SHM files if they exist (for consistency)
function backupWAL() {
  const walPath = DB_PATH + '-wal';
  const shmPath = DB_PATH + '-shm';
  
  if (fs.existsSync(walPath)) {
    console.log('   Note: WAL file exists. For a fully consistent backup,');
    console.log('   consider stopping the server first.');
  }
}

backup();
backupWAL();

