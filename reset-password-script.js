import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './src/models/admin.model.js';
import connectDB from './src/config/db.js';

dotenv.config();

const updateAdmin = async () => {
    const targetEmail = process.env.ADMIN_EMAIL || 'digitalmongers72@gmail.com';
    const targetPassword = process.env.ADMIN_PASSWORD || 'Digital1234#';

    try {
        await connectDB();

        // Find the current admin (admin@example.com) or any admin
        let admin = await Admin.findOne({ email: 'admin@example.com' });

        if (!admin) {
            admin = await Admin.findOne({});
        }

        if (!admin) {
            console.log('No admin found in database. Creating a new one...');
            admin = new Admin({
                name: 'System Admin',
                email: targetEmail,
                password: targetPassword
            });
        } else {
            console.log(`Found existing admin with email: ${admin.email}. Updating to ${targetEmail}...`);
            admin.email = targetEmail;
            admin.password = targetPassword;
            admin.loginAttempts = 0;
            admin.lockoutUntil = undefined;
        }

        await admin.save();

        console.log(`Admin updated successfully: ${targetEmail}`);
        process.exit(0);
    } catch (error) {
        console.error('Error updating admin:', error.message);
        process.exit(1);
    }
};

updateAdmin();
