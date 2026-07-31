import { auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const wrap = (def: any) => async (input: any) => {
  const currentUser = auth.currentUser;
  const role = currentUser?.email === 'satyamgupta1287@gmail.com' ? 'Admin' : 'User';
  
  let userData: any = { id: currentUser?.uid || 'user-1', role, email: currentUser?.email };
  
  if (currentUser?.uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        userData = { ...userData, ...userDoc.data() };
      }
    } catch (e) {
      console.warn("Could not fetch user document", e);
    }
  }

  return await def.execute({ input: input || {}, context: { user: userData } });
};

import activateLicenseDef from '../api/activateLicense';
export const activateLicense = wrap(activateLicenseDef);
import bulkUploadProductsDef from '../api/bulkUploadProducts';
export const bulkUploadProducts = wrap(bulkUploadProductsDef);
import checkLicenseDef from '../api/checkLicense';
export const checkLicense = wrap(checkLicenseDef);
import deleteCustomerDef from '../api/deleteCustomer';
export const deleteCustomer = wrap(deleteCustomerDef);
import deleteInvoiceDef from '../api/deleteInvoice';
export const deleteInvoice = wrap(deleteInvoiceDef);
import deleteManufacturerDef from '../api/deleteManufacturer';
export const deleteManufacturer = wrap(deleteManufacturerDef);
import deleteProductDef from '../api/deleteProduct';
export const deleteProduct = wrap(deleteProductDef);
import deletePurchaseDef from '../api/deletePurchase';
export const deletePurchase = wrap(deletePurchaseDef);
import deleteSupplierDef from '../api/deleteSupplier';
export const deleteSupplier = wrap(deleteSupplierDef);
import generateInvoicePdfDef from '../api/generateInvoicePdf';
export const generateInvoicePdf = wrap(generateInvoicePdfDef);
import generateLicensesDef from '../api/generateLicenses';
export const generateLicenses = wrap(generateLicensesDef);
import getCompanyDef from '../api/getCompany';
export const getCompany = wrap(getCompanyDef);
import getCustomersDef from '../api/getCustomers';
export const getCustomers = wrap(getCustomersDef);
import getDashboardDef from '../api/getDashboard';
export const getDashboard = wrap(getDashboardDef);
import getInvoiceDetailDef from '../api/getInvoiceDetail';
export const getInvoiceDetail = wrap(getInvoiceDetailDef);
import getInvoicesDef from '../api/getInvoices';
export const getInvoices = wrap(getInvoicesDef);
import getLicensesDef from '../api/getLicenses';
export const getLicenses = wrap(getLicensesDef);
import getManufacturersDef from '../api/getManufacturers';
export const getManufacturers = wrap(getManufacturersDef);
import getProductsDef from '../api/getProducts';
export const getProducts = wrap(getProductsDef);
import getPurchasesDef from '../api/getPurchases';
export const getPurchases = wrap(getPurchasesDef);
import getReportsDef from '../api/getReports';
export const getReports = wrap(getReportsDef);
import getStockDef from '../api/getStock';
export const getStock = wrap(getStockDef);
import getSuppliersDef from '../api/getSuppliers';
export const getSuppliers = wrap(getSuppliersDef);
import getUserSettingsDef from '../api/getUserSettings';
export const getUserSettings = wrap(getUserSettingsDef);
import parseExcelProductsDef from '../api/parseExcelProducts';
export const parseExcelProducts = wrap(parseExcelProductsDef);
import previewTemplateDef from '../api/previewTemplate';
export const previewTemplate = wrap(previewTemplateDef);
import recordPaymentDef from '../api/recordPayment';
export const recordPayment = wrap(recordPaymentDef);
import saveBulkPurchaseDef from '../api/saveBulkPurchase';
export const saveBulkPurchase = wrap(saveBulkPurchaseDef);
import saveCompanyDef from '../api/saveCompany';
export const saveCompany = wrap(saveCompanyDef);
import saveCustomerDef from '../api/saveCustomer';
export const saveCustomer = wrap(saveCustomerDef);
import saveInvoiceDef from '../api/saveInvoice';
export const saveInvoice = wrap(saveInvoiceDef);
import saveManufacturerDef from '../api/saveManufacturer';
export const saveManufacturer = wrap(saveManufacturerDef);
import saveProductDef from '../api/saveProduct';
export const saveProduct = wrap(saveProductDef);
import savePurchaseDef from '../api/savePurchase';
export const savePurchase = wrap(savePurchaseDef);
import saveSupplierDef from '../api/saveSupplier';
export const saveSupplier = wrap(saveSupplierDef);
import saveUserSettingsDef from '../api/saveUserSettings';
export const saveUserSettings = wrap(saveUserSettingsDef);
import updateLicenseStatusDef from '../api/updateLicenseStatus';
export const updateLicenseStatus = wrap(updateLicenseStatusDef);

export type GetDashboardOutputType = any;
export type GetUserSettingsOutputType = any;
export type GetLicensesOutputType = any;
