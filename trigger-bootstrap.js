import connectDB from './src/config/db.js';
import AdminEmailTemplateService from './src/services/adminEmailTemplate.service.js';
import CustomerEmailTemplateService from './src/services/customerEmailTemplate.service.js';
import SupplierEmailTemplateService from './src/services/supplierEmailTemplate.service.js';
import Logger from './src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const triggerBootstrap = async () => {
    try {
        await connectDB();
        Logger.info('Manual template bootstrap started...');

        await AdminEmailTemplateService.bootstrapTemplates();
        await CustomerEmailTemplateService.bootstrapTemplates();
        await SupplierEmailTemplateService.bootstrapTemplates();

        Logger.info('Manual template bootstrap completed successfully.');
        process.exit(0);
    } catch (error) {
        Logger.error('Bootstrap failed:', error);
        process.exit(1);
    }
};

triggerBootstrap();
