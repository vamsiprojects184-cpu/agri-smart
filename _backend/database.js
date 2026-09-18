const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'agrismart.db');

// Database helper function
async function queryDB(sql, params = []) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) return resolve([]);
        });
        db.all(sql, params, (err, rows) => {
            db.close();
            if (err) resolve([]);
            else resolve(rows);
        });
    });
}

async function runDB(sql, params = []) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
            if (err) return resolve({ id: null, changes: 0 });
        });
        db.run(sql, params, function (err) {
            db.close();
            if (err) resolve({ id: null, changes: 0 });
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

// Ensure database exists and is seeded
function initDB() {
    const db = new sqlite3.Database(DB_PATH);
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS schemes (
            id TEXT PRIMARY KEY, name TEXT, nameLocal TEXT, category TEXT, benefits TEXT,
            eligibility TEXT, minLand REAL, maxLand TEXT, documents TEXT,
            applicationProcess TEXT, officialLink TEXT, deadline TEXT, type TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, name TEXT, username TEXT, email TEXT, state TEXT,
            land_size REAL, primary_crop TEXT, social_category TEXT, last_updated DATETIME
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS sensor_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_id TEXT DEFAULT 'farm_01',
            soil_moisture REAL,
            temperature REAL,
            humidity REAL,
            water_level REAL,
            rain_probability REAL,
            source TEXT DEFAULT 'simulator',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS farm_decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_id TEXT DEFAULT 'farm_01',
            status TEXT,
            reason TEXT,
            recommendation TEXT,
            action TEXT,
            confidence REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS farm_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_id TEXT DEFAULT 'farm_01',
            actuator TEXT,
            state TEXT,
            reason TEXT,
            source TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS iot_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farm_id TEXT DEFAULT 'farm_01',
            type TEXT,
            message TEXT,
            icon TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log("Database schema verified (including IoT tables).");
    });
    db.close();
}

module.exports = { queryDB, runDB, initDB, DB_PATH };
