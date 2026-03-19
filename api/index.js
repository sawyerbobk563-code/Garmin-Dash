const express = require('express');
const { GarminConnect } = require('@flow-js/garmin-connect');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// We use a simple Map to store active clients by email to help prevent session loss
const sessions = new Map();

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Create a new client and store it in our map using the email as a key
        const client = new GarminConnect({ username: email, password: password });
        sessions.set(email, client);
        
        await client.login();
        res.json({ status: 'success' });
    } catch (error) {
        // Check for MFA/2FA requirements
        if (error.message.toLowerCase().includes('mfa') || 
            error.message.toLowerCase().includes('2fa') || 
            error.message.toLowerCase().includes('code')) {
            res.json({ status: 'mfa_required', email: email });
        } else {
            console.error("Login Error:", error.message);
            res.status(401).json({ status: 'error', message: 'Login failed. Check credentials.' });
        }
    }
});

app.post('/api/verify-mfa', async (req, res) => {
    const { email, code } = req.body;
    
    // Retrieve the client that was created during the initial login step
    const client = sessions.get(email);

    if (!client) {
        return res.status(400).json({ 
            error: 'Session lost. On Vercel, you must enter the code very quickly (within 10-15 seconds) before the server resets.' 
        });
    }

    try {
        const cleanCode = code.toString().trim();
        await client.provideMFA(cleanCode); 
        res.json({ status: 'success' });
    } catch (error) {
        console.error("MFA Error:", error.message);
        res.status(400).json({ status: 'error', message: 'Garmin rejected the code. It may have expired.' });
    }
});

app.get('/api/steps', async (req, res) => {
    // Note: In a serverless environment, this may fail if the function has "restarted"
    // We try to find any active session in the Map
    const client = Array.from(sessions.values())[0]; 

    try {
        if (!client) return res.status(401).json({ error: 'Not logged in' });
        const stats = await client.getUserSummary(new Date());
        res.json({ 
            steps: stats.totalSteps || 0, 
            goal: stats.dailyStepGoal || 0 
        });
    } catch (error) {
        res.status(500).json({ error: 'Session expired. Please login again.' });
    }
});

module.exports = app;
