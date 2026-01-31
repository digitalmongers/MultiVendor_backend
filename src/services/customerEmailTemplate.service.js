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
      'Support Ticket Reply',
    ];

    for (const event of events) {
      const exists = await CustomerEmailTemplate.findOne({ event });
      if (!exists) {
        let emailContent = `Hello {username}, this is a notification for ${event}.`;
        if (event === 'Support Ticket Reply') {
          emailContent = `
            <p>Hello {username},</p>
            <p>Our support team has replied to your ticket <strong>{ticketId}</strong> regarding <strong>{subject}</strong>.</p>
            <div style="background: #f4f7f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Admin Reply:</strong><br/>
              {reply}
            </div>
            <p>If you have further questions, please let us know.</p>
          `;
        }
        await CustomerEmailTemplate.create({
          event,
          templateTitle: event === 'Support Ticket Reply' ? 'Reply to your Support Ticket' : `${event} Notification`,
          emailContent,
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
