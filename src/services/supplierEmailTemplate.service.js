import SupplierEmailTemplateRepository from '../repositories/supplierEmailTemplate.repository.js';
import SupplierEmailTemplate from '../models/supplierEmailTemplate.model.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Logger from '../utils/logger.js';

class SupplierEmailTemplateService {
  async getAllTemplates() {
    return await SupplierEmailTemplateRepository.getAll();
  }

  async getTemplateByEvent(event) {
    const template = await SupplierEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError(`Template not found for event: ${event}`, HTTP_STATUS.NOT_FOUND);
    }
    return template;
  }

  async updateTemplate(event, updateData) {
    const template = await SupplierEmailTemplateRepository.updateByEvent(event, updateData);
    Logger.info(`Email template updated for event: ${event}`);
    return template;
  }

  async updateTemplateLogo(event, file) {
    const template = await SupplierEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    }

    // Delete existing logo if any
    if (template.logo && template.logo.publicId) {
      await deleteFromCloudinary(template.logo.publicId);
    }

    // Upload new logo
    const result = await uploadToCloudinary(file, 'email-templates/logos');
    
    return await SupplierEmailTemplateRepository.updateByEvent(event, {
      logo: {
        url: result.secure_url,
        publicId: result.public_id,
      }
    });
  }

  async updateTemplateIcon(event, file) {
    const template = await SupplierEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    }

    // Delete existing icon if any
    if (template.mainIcon && template.mainIcon.publicId) {
      await deleteFromCloudinary(template.mainIcon.publicId);
    }

    // Upload new icon
    const result = await uploadToCloudinary(file, 'email-templates/icons');
    
    return await SupplierEmailTemplateRepository.updateByEvent(event, {
      mainIcon: {
        url: result.secure_url,
        publicId: result.public_id,
      }
    });
  }

  async toggleTemplateStatus(event) {
    const template = await SupplierEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    }

    return await SupplierEmailTemplateRepository.updateByEvent(event, {
      isEnabled: !template.isEnabled
    });
  }

  async bootstrapTemplates() {
    const events = [
      'Registration',
      'Registration Approved',
      'Registration Denied',
      'Account Suspended',
      'Account Activation',
      'Order Received',
    ];

    for (const event of events) {
      const exists = await SupplierEmailTemplate.findOne({ event }).lean();
      if (!exists) {
        await SupplierEmailTemplate.create({
          event,
          templateTitle: `${event} Notification`,
          emailContent: `Hello {username}, this is a notification for ${event}.`,
          isEnabled: true,
          includedLinks: { privacyPolicy: true, contactUs: true },
          socialMediaLinks: { facebook: true, instagram: true, twitter: true },
          copyrightNotice: '© 2025 MultiVendor. All rights reserved.',
        });
        Logger.info(`Bootstrapped default email template for: ${event}`);
      }
    }
  }
}

export default new SupplierEmailTemplateService();
