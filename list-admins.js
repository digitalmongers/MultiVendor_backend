import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './src/models/admin.model.js';
import connectDB from './src/config/db.js';

dotenv.config();

const listAdmins = async () => {
    try {
        await connectDB();
        const admins = await Admin.find({}, 'email');
        console.log('Existing Admins:');
        admins.forEach(a => console.log(` - ${a.email}`));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

listAdmins();
