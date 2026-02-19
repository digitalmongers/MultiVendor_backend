import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './src/models/admin.model.js';
import connectDB from './src/config/db.js';
import { comparePassword } from './src/utils/security.js';

dotenv.config();

const testVerification = async () => {
    try {
        await connectDB();
        const admin = await Admin.findOne({ email: 'digitalmongers72@gmail.com' }).select('+password');
        if (!admin) {
            console.log('Admin not found');
            process.exit(1);
        }

        const testPassword = 'Digital1234#';
        const isMatch = await comparePassword(admin.password, testPassword);

        console.log(`Testing password: ${testPassword}`);
        console.log(`Match Result: ${isMatch}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

testVerification();
