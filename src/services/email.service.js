import sgMail from '@sendgrid/mail';
import env from '../config/env.js';
import Logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';

// Initialize SendGrid
sgMail.setApiKey(env.SENDGRID_API_KEY);

class EmailService {
  /**
   * Send Email using SendGrid
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
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
      throw new AppError('Failed to send email', HTTP_STATUS.INTERNAL_SERVER_ERROR, 'EMAIL_SEND_FAILED');
    }
  }

  /**
   * Send OTP Email
   */
  async sendOtpEmail(to, otp) {
    const subject = 'Reset Your Password';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
          .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); margin-top: 40px; margin-bottom: 40px; }
          .header { background-color: #1a1a1a; padding: 30px 40px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
          .content { padding: 40px; color: #333333; line-height: 1.6; }
          .otp-box { background-color: #f0f7ff; border: 1px dashed #0070f3; border-radius: 6px; padding: 20px; text-align: center; margin: 30px 0; }
          .otp-code { font-family: 'Monaco', 'Consolas', monospace; font-size: 32px; font-weight: 700; color: #0070f3; letter-spacing: 8px; }
          .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
          .warning { font-size: 13px; color: #666666; margin-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset the password for your admin account. To proceed, please use the One-Time Password (OTP) below.</p>
            
            <div class="otp-box">
              <span class="otp-code">${otp}</span>
            </div>

            <p style="text-align: center;">This OTP is valid for <strong>1 minute</strong>.</p>
            
            <p class="warning">If you did not request a password reset, you can safely ignore this email. Your account remains secure.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${env.EMAIL_FROM_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    await this.sendEmail(to, subject, html);
  }
}

export default new EmailService();
