import ProductSubCategoryService from '../services/productSubCategory.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class ProductSubCategoryController {
  createSubCategory = async (req, res) => {
    const sub = await ProductSubCategoryService.createSubCategory(req.body);
    return res.status(HTTP_STATUS.CREATED).json(
      new ApiResponse(HTTP_STATUS.CREATED, sub, 'Subcategory created successfully')
    );
  };

  getAllSubCategories = async (req, res) => {
    const subs = await ProductSubCategoryService.getAllSubCategories();
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, subs, SUCCESS_MESSAGES.FETCHED)
    );
  };

  getSubCategoriesByCategory = async (req, res) => {
    const subs = await ProductSubCategoryService.getSubCategoriesByCategory(req.params.categoryId);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, subs, SUCCESS_MESSAGES.FETCHED)
    );
  };

  updateSubCategory = async (req, res) => {
    const sub = await ProductSubCategoryService.updateSubCategory(req.params.id, req.body);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, sub, SUCCESS_MESSAGES.UPDATED)
    );
  };

  deleteSubCategory = async (req, res) => {
    await ProductSubCategoryService.deleteSubCategory(req.params.id);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'Subcategory deleted successfully')
    );
  };
}

export default new ProductSubCategoryController();
