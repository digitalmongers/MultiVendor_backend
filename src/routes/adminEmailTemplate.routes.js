import express from 'express';
import AdminEmailTemplateController from '../controllers/adminEmailTemplate.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import uploadMiddleware from '../middleware/upload.middleware.js';

const router = express.Router();

// All routes are protected and for admin only
router.use(adminProtect);

router.get('/', AdminEmailTemplateController.getAllTemplates);

router.route('/:event')
  .get(AdminEmailTemplateController.getTemplateByEvent)
  .patch(AdminEmailTemplateController.updateTemplate);

router.patch('/:event/logo', uploadMiddleware.single('logo'), AdminEmailTemplateController.updateLogo);
router.patch('/:event/icon', uploadMiddleware.single('icon'), AdminEmailTemplateController.updateIcon);
router.patch('/:event/toggle', AdminEmailTemplateController.toggleTemplate);

export default router;
