const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Middleware setup
app.use(cors());
app.use(express.json()); // <-- The critical line that allows your server to read form data!
app.use(express.static(__dirname));

// Simple file-based database
const dbPath = path.join(__dirname, 'database.json');

function readDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({ visits: 0, leads: [] }));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ─── API ENDPOINTS ───

// Get all data for the dashboard
app.get('/api/dashboard', (req, res) => {
    res.json(readDB());
});

// Record a new website visit
app.post('/api/visits', (req, res) => {
    const db = readDB();
    db.visits += 1;
    writeDB(db);
    io.emit('dashboard_update', db); // Real-time push
    res.json({ success: true, visits: db.visits });
});

// Submit a new lead (Called from your public website)
app.post('/api/leads', (req, res) => {
    const db = readDB();
    const newLead = {
        id: Date.now(),
        ...req.body,
        date: new Date().toISOString()
    };
    db.leads.push(newLead);
    writeDB(db);
    io.emit('dashboard_update', db); // Real-time push
    res.json({ success: true, lead: newLead });
});

// Delete a single lead
app.delete('/api/leads/:id', (req, res) => {
    const db = readDB();
    db.leads = db.leads.filter(l => l.id !== parseInt(req.params.id));
    writeDB(db);
    io.emit('dashboard_update', db);
    res.json({ success: true });
});

// Clear all leads
app.delete('/api/leads', (req, res) => {
    const db = readDB();
    db.leads = [];
    writeDB(db);
    io.emit('dashboard_update', db);
    res.json({ success: true });
});

// Reset visits
app.delete('/api/visits', (req, res) => {
    const db = readDB();
    db.visits = 0;
    writeDB(db);
    io.emit('dashboard_update', db);
    res.json({ success: true });
});

// ─── WEBSOCKETS ───
io.on('connection', (socket) => {
    console.log('Admin dashboard connected');
    // Send initial data on connect
    socket.emit('dashboard_update', readDB());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
