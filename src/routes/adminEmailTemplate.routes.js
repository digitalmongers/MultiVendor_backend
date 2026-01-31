import express from 'express';
import AdminEmailTemplateController from '../controllers/adminEmailTemplate.controller.js';
import uploadMiddleware from '../middleware/upload.middleware.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';

const router = express.Router();

// All routes are protected and for admin / staff based on permissions
router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.get('/', AdminEmailTemplateController.getAllTemplates);

router.route('/:event')
  .get(AdminEmailTemplateController.getTemplateByEvent)
  .patch(AdminEmailTemplateController.updateTemplate);

router.patch('/:event/logo', uploadMiddleware.single('logo'), AdminEmailTemplateController.updateLogo);
router.patch('/:event/icon', uploadMiddleware.single('icon'), AdminEmailTemplateController.updateIcon);
router.patch('/:event/toggle', AdminEmailTemplateController.toggleTemplate);

export default router;
