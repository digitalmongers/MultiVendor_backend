import sgMail from '@sendgrid/mail';
import env from '../config/env.js';
import Logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import SupplierEmailTemplateRepository from '../repositories/supplierEmailTemplate.repository.js';
import CustomerEmailTemplateRepository from '../repositories/customerEmailTemplate.repository.js';
import AdminEmailTemplateRepository from '../repositories/adminEmailTemplate.repository.js';
import SocialMediaRepository from '../repositories/socialMedia.repository.js';
import SiteContentRepository from '../repositories/siteContent.repository.js';

// Initialize SendGrid
sgMail.setApiKey(env.SENDGRID_API_KEY);

class EmailService {
  /**
   * Core Email Sending Method
   */
  async sendEmail(to, subject, html) {
    const msg = {
      to,
      from: {
        email: env.EMAIL_FROM,
        name: env.EMAIL_FROM_NAME,
      },
      subject,
      html,
    };

    try {
      await sgMail.send(msg);
      Logger.info(`📧 Email sent to ${to}`);
    } catch (error) {
      Logger.error('❌ SendGrid Error:', error);
      // We don't throw here to prevent breaking the caller flow (like signup)
      // but we log it heavily.
    }
  }

  /**
   * Compile Dynamic Template
   * role: 'supplier' | 'customer' | 'admin'
   */
  async compileTemplate(event, placeholders = {}, role = 'supplier') {
    let template;
    
    if (role === 'customer') {
      template = await CustomerEmailTemplateRepository.findByEvent(event);
    } else if (role === 'admin') {
      template = await AdminEmailTemplateRepository.findByEvent(event);
    } else {
      template = await SupplierEmailTemplateRepository.findByEvent(event);
    }
    
    // Check if template exists and is enabled
    if (!template || !template.isEnabled) {
      Logger.debug(`Email skipped: ${role} Template ${event} is disabled or missing.`);
      return null;
    }

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', sans-serif; background-color: #f4f7f9; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .header { padding: 30px; text-align: center; background: #ffffff; }
          .logo { max-height: 50px; }
          .content { padding: 40px; color: #333333; line-height: 1.6; }
          .main-icon { display: block; margin: 0 auto 20px; max-height: 80px; }
          .footer { padding: 30px; background: #f9fafb; text-align: center; border-top: 1px solid #edf2f7; }
          .links { margin: 20px 0; font-size: 13px; }
          .links a { color: #4a5568; text-decoration: none; margin: 0 10px; }
          .social-icons { margin: 20px 0; }
          .social-icons img { width: 24px; margin: 0 8px; vertical-align: middle; }
          .copyright { font-size: 11px; color: #a0aec0; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${template.logo?.url ? `<img src="${template.logo.url}" class="logo" alt="Logo">` : ''}
          </div>
          <div class="content">
            ${template.mainIcon?.url ? `<img src="${template.mainIcon.url}" class="main-icon" alt="Icon">` : ''}
            <h1 style="font-size: 22px; color: #1a202c; margin-bottom: 20px;">${template.templateTitle}</h1>
            ${this.replacePlaceholders(template.emailContent, placeholders)}
          </div>
          <div class="footer">
            <div style="font-size: 14px; color: #4a5568;">
              ${template.footerDescription || ''}
            </div>
            
            <div class="links">
              ${await this.getPolicyLinks(template.includedLinks)}
            </div>

            <div class="social-icons">
              ${await this.getSocialIcons(template.socialMediaLinks)}
            </div>

            <div class="copyright">
              ${template.copyrightNotice || `&copy; ${new Date().getFullYear()} All rights reserved.`}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject: template.templateTitle, html };
  }

  /**
   * Replace placeholders in text
   */
  replacePlaceholders(text, placeholders) {
    let result = text;
    Object.keys(placeholders).forEach(key => {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, placeholders[key]);
    });
    return result;
  }

  /**
   * Generate Policy Links HTML based on SiteContent model
   */
  async getPolicyLinks(includedLinks) {
    if (!includedLinks) return '';
    const frontendUrl = env.FRONTEND_URL || 'https://dobbymall.com';
    let linksHtml = '';

    if (includedLinks.privacyPolicy) linksHtml += `<a href="${frontendUrl}/privacy-policy">Privacy Policy</a>`;
    if (includedLinks.refundPolicy) linksHtml += `<a href="${frontendUrl}/refund-policy">Refund Policy</a>`;
    if (includedLinks.cancellationPolicy) linksHtml += `<a href="${frontendUrl}/cancellation-policy">Cancellation Policy</a>`;
    if (includedLinks.contactUs) linksHtml += `<a href="${frontendUrl}/contact-us">Contact Us</a>`;

    return linksHtml;
  }

  /**
   * Generate Social Media Icons HTML based on SocialMedia model
   */
  async getSocialIcons(enabledPlatforms) {
    if (!enabledPlatforms) return '';
    const activeLinks = await SocialMediaRepository.findAll({ status: true });
    let iconsHtml = '';

    const iconMap = {
      facebook: 'https://res.cloudinary.com/dwy76u9sc/image/upload/v1711200000/icons/facebook.png',
      instagram: 'https://res.cloudinary.com/dwy76u9sc/image/upload/v1711200000/icons/instagram.png',
      twitter: 'https://res.cloudinary.com/dwy76u9sc/image/upload/v1711200000/icons/twitter.png',
      linkedin: 'https://res.cloudinary.com/dwy76u9sc/image/upload/v1711200000/icons/linkedin.png',
      youtube: 'https://res.cloudinary.com/dwy76u9sc/image/upload/v1711200000/icons/youtube.png',
    };

    for (const item of activeLinks) {
      const platformKey = item.platform.toLowerCase() === 'x' ? 'twitter' : item.platform.toLowerCase();
      if (enabledPlatforms[platformKey]) {
        iconsHtml += `<a href="${item.link}"><img src="${iconMap[platformKey]}" alt="${item.platform}"></a>`;
      }
    }

    return iconsHtml;
  }

  /**
   * REFACTORED METHODS - Using Dynamic Templates
   */

  async sendOtpEmail(to, otp, role = 'supplier') {
    const event = role === 'customer' ? 'Verify Email' : 'Registration';
    const result = await this.compileTemplate(event, { otp }, role);
    if (result) await this.sendEmail(to, result.subject, result.html);
  }

  async sendVerificationEmail(to, otp, role = 'supplier') {
    const event = role === 'customer' ? 'Verify Email' : 'Registration';
    const result = await this.compileTemplate(event, { otp }, role);
    if (result) await this.sendEmail(to, result.subject, result.html);
  }

  async sendPasswordResetOtpEmail(to, otp, role = 'supplier') {
    const event = role === 'customer' ? 'Verify Email' : 'Registration';
    const result = await this.compileTemplate(event, { otp }, role);
    if (result) await this.sendEmail(to, result.subject, result.html);
  }

  async sendVendorWelcomeEmail(to, vendorName) {
    const result = await this.compileTemplate('Account Activation', { username: vendorName });
    if (result) await this.sendEmail(to, result.subject, result.html);
  }

  async sendAdminVendorRequestEmail(vendorData) {
    // Admin notifications usually don't use the customer-facing templates
    // But we can keep it as is or create an "Admin Notification" template
    const subject = 'New Vendor Registration Request';
    const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>New Vendor Signup</h2>
        <p>A new vendor has registered and is awaiting approval.</p>
        <ul>
          <li><strong>Business Name:</strong> ${vendorData.businessName}</li>
          <li><strong>Vendor Name:</strong> ${vendorData.firstName} ${vendorData.lastName}</li>
          <li><strong>Email:</strong> ${vendorData.email}</li>
          <li><strong>Phone:</strong> ${vendorData.phoneNumber}</li>
        </ul>
      </div>
    `;
    await this.sendEmail(env.EMAIL_FROM, subject, html);
  }

  /**
   * Send Generic Email Template
   */
  async sendEmailTemplate(to, event, placeholders = {}, role = 'supplier') {
    const result = await this.compileTemplate(event, placeholders, role);
    if (result) {
      await this.sendEmail(to, result.subject, result.html);
    }
  }
}

export default new EmailService();
