import mailchimp from '@mailchimp/mailchimp_marketing';
import crypto from 'crypto';
import env from '../config/env.js';
import Logger from '../utils/logger.js';

class MailchimpService {
  constructor() {
    if (env.MAILCHIMP_API_KEY && env.MAILCHIMP_SERVER_PREFIX) {
      mailchimp.setConfig({
        apiKey: env.MAILCHIMP_API_KEY,
        server: env.MAILCHIMP_SERVER_PREFIX,
      });
      this.isConfigured = true;
      Logger.info('✅ Mailchimp configured successfully');
    } else {
      this.isConfigured = false;
      Logger.warn('⚠️ Mailchimp is not configured. Falling back to local storage only.');
    }
  }

  async addSubscriber(email) {
    if (!this.isConfigured || !env.MAILCHIMP_AUDIENCE_ID) {
      return null;
    }

    try {
      // MD5 hash of lowercase email for Mailchimp member identification
      const subscriberHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');

      const response = await mailchimp.lists.setListMember(
        env.MAILCHIMP_AUDIENCE_ID,
        subscriberHash,
        {
          email_address: email,
          status_if_new: 'subscribed', // "subscribed" for single opt-in, "pending" for double
          status: 'subscribed',        // Ensure existing members are re-subscribed if they were unsubscribed
        }
      );

      Logger.info(`Mailchimp: Subscriber added/updated - ${email}`);
      return response;
    } catch (error) {
      Logger.error(`Mailchimp Error: ${error.message}`, { 
        email, 
        detail: error.response?.body?.detail || error.message 
      });
      // We don't throw here to avoid failing the local subscription if Mailchimp fails
      return null;
    }
  }

  async ping() {
    if (!this.isConfigured) return false;
    try {
      const response = await mailchimp.ping.get();
      return response.health_status === "Everything's Chimpy!";
    } catch (error) {
      return false;
    }
  }
}

export default new MailchimpService();
