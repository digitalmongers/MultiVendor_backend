import express from 'express';
import SupplierEmailTemplateController from '../controllers/supplierEmailTemplate.controller.js';
import uploadMiddleware from '../middleware/upload.middleware.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';

const router = express.Router();

// All routes are protected and for admin / staff based on permissions
router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.get('/', SupplierEmailTemplateController.getAllTemplates);

router.route('/:event')
  .get(SupplierEmailTemplateController.getTemplateByEvent)
  .patch(SupplierEmailTemplateController.updateTemplate);

router.patch('/:event/logo', uploadMiddleware.single('logo'), SupplierEmailTemplateController.updateLogo);
router.patch('/:event/icon', uploadMiddleware.single('icon'), SupplierEmailTemplateController.updateIcon);
router.patch('/:event/toggle', SupplierEmailTemplateController.toggleTemplate);

export default router;
