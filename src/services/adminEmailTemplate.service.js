import AdminEmailTemplateRepository from '../repositories/adminEmailTemplate.repository.js';
import AdminEmailTemplate from '../models/adminEmailTemplate.model.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Logger from '../utils/logger.js';

class AdminEmailTemplateService {
  async getAllTemplates() {
    return await AdminEmailTemplateRepository.getAll();
  }

  async getTemplateByEvent(event) {
    const template = await AdminEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError(`Template not found for event: ${event}`, HTTP_STATUS.NOT_FOUND);
    }
    return template;
  }

  async updateTemplate(event, updateData) {
    const template = await AdminEmailTemplateRepository.updateByEvent(event, updateData);
    Logger.info(`Admin email template updated for event: ${event}`);
    return template;
  }

  async updateTemplateLogo(event, file) {
    const template = await AdminEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    }

    if (template.logo && template.logo.publicId) {
      await deleteFromCloudinary(template.logo.publicId);
    }

    const result = await uploadToCloudinary(file, 'admin-email-templates/logos');
    
    return await AdminEmailTemplateRepository.updateByEvent(event, {
      logo: {
        url: result.secure_url,
        publicId: result.public_id,
      }
    });
  }

  async updateTemplateIcon(event, file) {
    const template = await AdminEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    }

    if (template.mainIcon && template.mainIcon.publicId) {
      await deleteFromCloudinary(template.mainIcon.publicId);
    }

    const result = await uploadToCloudinary(file, 'admin-email-templates/icons');
    
    return await AdminEmailTemplateRepository.updateByEvent(event, {
      mainIcon: {
        url: result.secure_url,
        publicId: result.public_id,
      }
    });
  }

  async toggleTemplateStatus(event) {
    const template = await AdminEmailTemplateRepository.findByEvent(event);
    if (!template) {
      throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    }

    return await AdminEmailTemplateRepository.updateByEvent(event, {
      isEnabled: !template.isEnabled
    });
  }

  async bootstrapTemplates() {
    const events = [
      'Vendor Request',
    ];

    for (const event of events) {
      const exists = await AdminEmailTemplate.findOne({ event });
      if (!exists) {
        await AdminEmailTemplate.create({
          event,
          templateTitle: 'New Vendor Registration Request',
          emailContent: `
            <p>Hello Admin,</p>
            <p>A new vendor has registered and is awaiting your approval.</p>
            <ul>
              <li><strong>Business Name:</strong> {businessName}</li>
              <li><strong>Vendor Name:</strong> {firstName} {lastName}</li>
              <li><strong>Email:</strong> {email}</li>
              <li><strong>Phone:</strong> {phoneNumber}</li>
            </ul>
          `,
          isEnabled: true,
          includedLinks: { privacyPolicy: false, contactUs: false },
          socialMediaLinks: { facebook: false, instagram: false, twitter: false },
          copyrightNotice: '© 2025 Dobby Mall. Admin Notification.',
        });
        Logger.info(`Bootstrapped default ADMIN email template for: ${event}`);
      }
    }
  }
}

export default new AdminEmailTemplateService();
