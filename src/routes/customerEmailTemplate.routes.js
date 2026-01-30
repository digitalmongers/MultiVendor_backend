import express from 'express';
import CustomerEmailTemplateController from '../controllers/customerEmailTemplate.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import uploadMiddleware from '../middleware/upload.middleware.js';

const router = express.Router();

// All routes are protected and for admin only
router.use(adminProtect);

router.get('/', CustomerEmailTemplateController.getAllTemplates);

router.route('/:event')
  .get(CustomerEmailTemplateController.getTemplateByEvent)
  .patch(CustomerEmailTemplateController.updateTemplate);

router.patch('/:event/logo', uploadMiddleware.single('logo'), CustomerEmailTemplateController.updateLogo);
router.patch('/:event/icon', uploadMiddleware.single('icon'), CustomerEmailTemplateController.updateIcon);
router.patch('/:event/toggle', CustomerEmailTemplateController.toggleTemplate);

export default router;
