import express from 'express';
import CustomerEmailTemplateController from '../controllers/customerEmailTemplate.controller.js';
import uploadMiddleware from '../middleware/upload.middleware.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';

const router = express.Router();

// All routes are protected and for admin / staff based on permissions
router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.get('/', CustomerEmailTemplateController.getAllTemplates);

router.route('/:event')
  .get(CustomerEmailTemplateController.getTemplateByEvent)
  .patch(CustomerEmailTemplateController.updateTemplate);

router.patch('/:event/logo', uploadMiddleware.single('logo'), CustomerEmailTemplateController.updateLogo);
router.patch('/:event/icon', uploadMiddleware.single('icon'), CustomerEmailTemplateController.updateIcon);
router.patch('/:event/toggle', CustomerEmailTemplateController.toggleTemplate);

export default router;
