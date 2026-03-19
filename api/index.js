const express = require('express');
const { GarminConnect } = require('@flow-js/garmin-connect');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// This variable stays in memory as long as the "serverless function" is warm
let gcClient = null;

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // We create a fresh client for every login attempt
        gcClient = new GarminConnect({ username: email, password: password });
        await gcClient.login();
        res.json({ status: 'success' });
    } catch (error) {
        // If MFA is needed, the gcClient object stays "in progress" in memory
        if (error.message.includes('MFA') || error.message.includes('2FA')) {
            res.json({ status: 'mfa_required' });
        } else {
            res.status(401).json({ status: 'error', message: 'Login failed' });
        }
    }
});

app.post('/api/verify-mfa', async (req, res) => {
    const { code } = req.body;
    try {
        // Check if we have a client waiting for a code
        if (!gcClient) {
            return res.status(400).json({ error: 'Session expired. Please try logging in again.' });
        }
        
        // Submit the code to the existing client
        await gcClient.provideMFA(code); 
        res.json({ status: 'success' });
    } catch (error) {
        console.error("MFA Error:", error);
        res.status(400).json({ status: 'error', message: 'Invalid MFA code or session timeout' });
    }
});

app.get('/api/steps', async (req, res) => {
    try {
        if (!gcClient) return res.status(401).json({ error: 'Not authenticated' });
        const stats = await gcClient.getUserSummary(new Date());
        res.json({ 
            steps: stats.totalSteps || 0, 
            goal: stats.dailyStepGoal || 0 
        });
    } catch (error) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});

module.exports = app;
