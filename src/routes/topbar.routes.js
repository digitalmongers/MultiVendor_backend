import express from 'express';
import TopbarController from '../controllers/topbar.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { saveTopbarSchema } from '../validations/topbar.validation.js';
import cacheMiddleware from '../middleware/cache.middleware.js';

const router = express.Router();

// Public route
router.get('/public', cacheMiddleware(3600), TopbarController.getPublicTopbar);

// Protected routes
router.use(adminProtect);

router.route('/')
  .post(validate(saveTopbarSchema), TopbarController.saveTopbar)
  .get(TopbarController.getTopbar);

export default router;
