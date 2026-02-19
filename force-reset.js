import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './src/models/admin.model.js';
import connectDB from './src/config/db.js';

dotenv.config();

const forceReset = async () => {
    try {
        await connectDB();
        const admin = await Admin.findOne({ email: 'digitalmongers72@gmail.com' });
        if (!admin) {
            console.log('Admin not found');
            process.exit(1);
        }

        admin.password = 'Digital1234#';
        admin.loginAttempts = 0;
        admin.lockoutUntil = undefined;

        await admin.save();
        console.log('Password set to hardcoded: Digital1234#');

        // Immediately verify
        const isMatch = await admin.matchPassword('Digital1234#');
        console.log(`Immediate match test: ${isMatch}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

forceReset();
