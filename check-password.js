import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './src/models/admin.model.js';
import connectDB from './src/config/db.js';

dotenv.config();

const checkPassword = async () => {
    try {
        await connectDB();
        const admin = await Admin.findOne({ email: 'digitalmongers72@gmail.com' }).select('+password');
        if (!admin) {
            console.log('Admin not found');
        } else {
            console.log(`Email: ${admin.email}`);
            console.log(`Password length: ${admin.password.length}`);
            console.log(`Is hashed (starts with $argon2): ${admin.password.startsWith('$argon2')}`);
            console.log(`First 10 chars: ${admin.password.substring(0, 10)}`);
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

checkPassword();
