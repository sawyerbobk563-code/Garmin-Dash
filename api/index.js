const express = require('express');
const { GarminConnect } = require('@flow-js/garmin-connect');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// We store the client in a global-ish variable for the serverless session
let gcClient = null;

// 1. Initial Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        gcClient = new GarminConnect({ username: email, password: password });
        await gcClient.login();
        res.json({ status: 'success' });
    } catch (error) {
        if (error.message.includes('MFA') || error.message.includes('2FA')) {
            res.json({ status: 'mfa_required' });
        } else {
            res.status(401).json({ status: 'error', message: 'Login failed' });
        }
    }
});

// 2. MFA Verification Route
app.post('/api/verify-mfa', async (req, res) => {
    const { code } = req.body;
    try {
        if (!gcClient) throw new Error('No active session');
        await gcClient.provideMFA(code); 
        res.json({ status: 'success' });
    } catch (error) {
        res.status(400).json({ status: 'error', message: 'MFA failed' });
    }
});

// 3. Get Step Count Route
app.get('/api/steps', async (req, res) => {
    try {
        if (!gcClient) return res.status(401).json({ error: 'Please login' });
        const stats = await gcClient.getUserSummary(new Date());
        res.json({ steps: stats.totalSteps, goal: stats.dailyStepGoal });
    } catch (error) {
        res.status(500).json({ error: 'Data fetch failed' });
    }
});

// Export the app for Vercel's Serverless environment
module.exports = app;
