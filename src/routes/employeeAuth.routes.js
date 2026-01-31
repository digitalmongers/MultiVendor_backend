import express from 'express';
import EmployeeController from '../controllers/employee.controller.js';

const router = express.Router();

router.post('/login', EmployeeController.login);

export default router;
