const express = require('express');
const { GarminConnect } = require('@flow-js/garmin-connect');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// This tells the server to show your website from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// A memory map to store the exact Garmin connection for your email
const sessions = new Map();

// 1. Initial Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // Create the connection and save it to the Map
        const client = new GarminConnect({ username: email, password: password });
        sessions.set(email, client);
        
        await client.login();
        res.json({ status: 'success' });
    } catch (error) {
        if (error.message.includes('MFA') || error.message.includes('2FA') || error.message.includes('code')) {
            res.json({ status: 'mfa_required' });
        } else {
            console.error("Login Error:", error.message);
            res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }
    }
});

// 2. MFA Verification Route
app.post('/api/verify-mfa', async (req, res) => {
    const { email, code } = req.body;
    
    // Find the EXACT same connection we started in step 1 using the email
    const client = sessions.get(email);

    if (!client) {
        return res.status(400).json({ status: 'error', message: 'Session lost. Please try logging in again.' });
    }

    try {
        const cleanCode = code.toString().trim();
        await client.provideMFA(cleanCode); 
        res.json({ status: 'success' });
    } catch (error) {
        console.error("MFA Error:", error.message);
        res.status(400).json({ status: 'error', message: 'Garmin rejected the code.' });
    }
});

// 3. Get Step Count Route
app.get('/api/steps', async (req, res) => {
    // Try to grab the first active session we have stored
    const client = Array.from(sessions.values())[0];

    if (!client) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const stats = await client.getUserSummary(new Date());
        res.json({ 
            steps: stats.totalSteps || 0,
            goal: stats.dailyStepGoal || 0 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch steps' });
    }
});

// Start the server (Render will provide the PORT automatically)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
