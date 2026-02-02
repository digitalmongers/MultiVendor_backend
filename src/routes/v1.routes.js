import express from 'express';
import healthRoutes from './health.routes.js';
import uploadRoutes from './upload.routes.js';
import adminRoutes from './admin.routes.js';
import contentRoutes from './content.routes.js';
import faqRoutes from './faq.routes.js';
import productCategoryRoutes from './productCategory.routes.js';
import productSubCategoryRoutes from './productSubCategory.routes.js';
import newsletterRoutes from './newsletter.routes.js';
import blogCategoryRoutes from './blogCategory.routes.js';
import blogRoutes from './blog.routes.js';
import publicBlogRoutes from './publicBlog.routes.js';
import bannerRoutes from './banner.routes.js';
import sliderRoutes from './slider.routes.js';
import topbarRoutes from './topbar.routes.js';
import reliabilityRoutes from './reliability.routes.js';
import trustedByRoutes from './trustedBy.routes.js';
import socialMediaRoutes from './socialMedia.routes.js';
import customerRoutes from './customer.routes.js';
import vendorRoutes from './vendor.routes.js';
import supplierEmailTemplateRoutes from './supplierEmailTemplate.routes.js';
import customerEmailTemplateRoutes from './customerEmailTemplate.routes.js';
import adminEmailTemplateRoutes from './adminEmailTemplate.routes.js';
import supportTicketRoutes from './supportTicket.routes.js';
import employeeManagementRoutes from './employeeManagement.routes.js';
import employeeAuthRoutes from './employeeAuth.routes.js';
import paymentGatewayRoutes from './paymentGateway.routes.js';
import paymentSettingRoutes from './paymentSetting.routes.js';
import socialLoginRoutes from './socialLogin.routes.js';
import socialMediaChatRoutes from './socialMediaChat.routes.js';
import smsGatewayRoutes from './smsGateway.routes.js';
import googleMapRoutes from './googleMap.routes.js';
import loginSettingRoutes from './loginSetting.routes.js';
import systemSettingRoutes from './systemSetting.routes.js';

import cookieConsentRoutes from './cookieConsent.routes.js';
import productAttributeRoutes from './productAttribute.routes.js';
import productRoutes from './product.routes.js';
import couponRoutes from './coupon.routes.js';
import clearanceSaleRoutes from './clearanceSale.routes.js';
import adminClearanceSaleRoutes from './adminClearanceSale.routes.js';
import flashDealRoutes from './flashDeal.routes.js';
import adminFlashDealRoutes from './adminFlashDeal.routes.js';
import featuredDealRoutes from './featuredDeal.routes.js';
import adminFeaturedDealRoutes from './adminFeaturedDeal.routes.js';
import dealOfTheDayRoutes from './dealOfTheDay.routes.js';
import adminDealOfTheDayRoutes from './adminDealOfTheDay.routes.js';
import adminCouponRoutes from './adminCoupon.routes.js';

const router = express.Router();

/**
 * V1 Route Entry Point
 * Centralizes all version 1 endpoints.
 */
router.use('/admin/auth', adminRoutes);
router.use('/upload', uploadRoutes);
router.use('/content', contentRoutes);
router.use('/faqs', faqRoutes);
router.use('/categories', productCategoryRoutes);
router.use('/subcategories', productSubCategoryRoutes);
router.use('/blog-categories', blogCategoryRoutes);
router.use('/blogs', blogRoutes);
router.use('/public/blogs', publicBlogRoutes);
router.use('/newsletter', newsletterRoutes);
router.use('/banners', bannerRoutes);
router.use('/sliders', sliderRoutes);
router.use('/topbar', topbarRoutes);
router.use('/company-reliability', reliabilityRoutes);
router.use('/trusted-by', trustedByRoutes);
router.use('/social-media', socialMediaRoutes);
router.use('/customers', customerRoutes);
router.use('/vendors', vendorRoutes);
router.use('/admin/supplier-template', supplierEmailTemplateRoutes);
router.use('/admin/customer-template', customerEmailTemplateRoutes);
router.use('/admin/admin-template', adminEmailTemplateRoutes);
router.use('/support-tickets', supportTicketRoutes);
router.use('/admin/staff', employeeManagementRoutes);
router.use('/employee/auth', employeeAuthRoutes);
router.use('/payment-gateways', paymentGatewayRoutes);
router.use('/payment-settings', paymentSettingRoutes);
router.use('/social-login', socialLoginRoutes);
router.use('/social-media-chat', socialMediaChatRoutes);
router.use('/sms-gateways', smsGatewayRoutes);
router.use('/google-map-apis', googleMapRoutes);
router.use('/login-settings', loginSettingRoutes);
router.use('/system-settings', systemSettingRoutes);
router.use('/cookie-consent', cookieConsentRoutes);
router.use('/product-attributes', productAttributeRoutes);
router.use('/products', productRoutes);
router.use('/coupons', couponRoutes);
router.use('/clearance-sale', clearanceSaleRoutes);
router.use('/admin/clearance-sale', adminClearanceSaleRoutes);
router.use('/flash-deals', flashDealRoutes);
router.use('/admin/flash-deals', adminFlashDealRoutes);
router.use('/featured-deals', featuredDealRoutes);
router.use('/admin/featured-deals', adminFeaturedDealRoutes);
router.use('/deal-of-the-day', dealOfTheDayRoutes);
router.use('/admin/deal-of-the-day', adminDealOfTheDayRoutes);
router.use('/admin/coupons', adminCouponRoutes);

// Health check can also be versioned if needed, but usually kept root
router.use('/health', healthRoutes);

export default router;
