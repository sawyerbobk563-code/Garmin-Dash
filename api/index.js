const express = require('express');
const { GarminConnect } = require('@flow-js/garmin-connect');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Use a persistent variable to keep the session alive across requests
let gcClient = null;

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Initialize the client
        gcClient = new GarminConnect({ username: email, password: password });
        
        // Attempt login - this triggers the MFA email if needed
        await gcClient.login();
        
        // If it gets here, login was successful without MFA
        res.json({ status: 'success' });
    } catch (error) {
        // If MFA is required, the library throws an error containing "MFA"
        if (error.message.includes('MFA') || error.message.includes('2FA') || error.message.includes('code')) {
            console.log("MFA status detected for user");
            res.json({ status: 'mfa_required' });
        } else {
            console.error("Login Error:", error.message);
            res.status(401).json({ status: 'error', message: 'Login failed. Check credentials.' });
        }
    }
});

app.post('/api/verify-mfa', async (req, res) => {
    const { code } = req.body;
    
    if (!gcClient) {
        return res.status(400).json({ error: 'Your session timed out. Please go back and login again.' });
    }

    try {
        // Clean the code (remove spaces) just in case
        const cleanCode = code.toString().trim();
        
        // Submit the code to the active session
        await gcClient.provideMFA(cleanCode); 
        
        res.json({ status: 'success' });
    } catch (error) {
        console.error("MFA Verification Error:", error.message);
        // If it fails here, the session might have expired on Garmin's side
        res.status(400).json({ status: 'error', message: 'Code rejected by Garmin. Try logging in again to get a new code.' });
    }
});

app.get('/api/steps', async (req, res) => {
    try {
        if (!gcClient) return res.status(401).json({ error: 'Not logged in' });
        
        const stats = await gcClient.getUserSummary(new Date());
        res.json({ 
            steps: stats.totalSteps || 0, 
            goal: stats.dailyStepGoal || 0 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch steps' });
    }
});

module.exports = app;
