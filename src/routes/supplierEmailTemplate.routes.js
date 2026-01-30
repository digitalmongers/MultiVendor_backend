import express from 'express';
import SupplierEmailTemplateController from '../controllers/supplierEmailTemplate.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import uploadMiddleware from '../middleware/upload.middleware.js';

const router = express.Router();

// All routes are protected and for admin only
router.use(adminProtect);

router.get('/', SupplierEmailTemplateController.getAllTemplates);

router.route('/:event')
  .get(SupplierEmailTemplateController.getTemplateByEvent)
  .patch(SupplierEmailTemplateController.updateTemplate);

router.patch('/:event/logo', uploadMiddleware.single('logo'), SupplierEmailTemplateController.updateLogo);
router.patch('/:event/icon', uploadMiddleware.single('icon'), SupplierEmailTemplateController.updateIcon);
router.patch('/:event/toggle', SupplierEmailTemplateController.toggleTemplate);

export default router;
