import CustomerEmailTemplateRepository from '../repositories/customerEmailTemplate.repository.js';
import CustomerEmailTemplate from '../models/customerEmailTemplate.model.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Logger from '../utils/logger.js';

class CustomerEmailTemplateService {
  async getAllTemplates() {
    return await CustomerEmailTemplateRepository.getAll();
  }

  async getTemplateByEvent(event) {
    const template = await CustomerEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError(`Template not found for event: ${event}`, HTTP_STATUS.NOT_FOUND);
    }
    return template;
  }

  async updateTemplate(event, updateData) {
    const template = await CustomerEmailTemplateRepository.updateByEvent(event, updateData);
    Logger.info(`Customer email template updated for event: ${event}`);
    return template;
  }

  async updateTemplateLogo(event, file) {
    const template = await CustomerEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    }

    if (template.logo && template.logo.publicId) {
      await deleteFromCloudinary(template.logo.publicId);
    }

    const result = await uploadToCloudinary(file, 'customer-email-templates/logos');
    
    return await CustomerEmailTemplateRepository.updateByEvent(event, {
      logo: {
        url: result.secure_url,
        publicId: result.public_id,
      }
    });
  }

  async updateTemplateIcon(event, file) {
    const template = await CustomerEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    }

    if (template.mainIcon && template.mainIcon.publicId) {
      await deleteFromCloudinary(template.mainIcon.publicId);
    }

    const result = await uploadToCloudinary(file, 'customer-email-templates/icons');
    
    return await CustomerEmailTemplateRepository.updateByEvent(event, {
      mainIcon: {
        url: result.secure_url,
        publicId: result.public_id,
      }
    });
  }

  async toggleTemplateStatus(event) {
    const template = await CustomerEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    }

    return await CustomerEmailTemplateRepository.updateByEvent(event, {
      isEnabled: !template.isEnabled
    });
  }

  async bootstrapTemplates() {
    const events = [
      'Order Placed',
      'Verify Email',
      'Account Blocked',
      'Account Unblocked',
    ];

    for (const event of events) {
      const exists = await CustomerEmailTemplate.findOne({ event });
      if (!exists) {
        await CustomerEmailTemplate.create({
          event,
          templateTitle: `${event} Notification`,
          emailContent: `Hello {username}, this is a notification for ${event}.`,
          isEnabled: true,
          includedLinks: { privacyPolicy: true, contactUs: true },
          socialMediaLinks: { facebook: true, instagram: true, twitter: true },
          copyrightNotice: '© 2025 Dobby Mall. All rights reserved.',
        });
        Logger.info(`Bootstrapped default CUSTOMER email template for: ${event}`);
      }
    }
  }
}

export default new CustomerEmailTemplateService();
