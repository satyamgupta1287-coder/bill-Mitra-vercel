import { db } from '../firebase';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, QueryConstraint } from 'firebase/firestore';

export class ZiteError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ZiteError';
  }
}

function stripUndefined(obj: any): any {
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj && typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        res[key] = stripUndefined(obj[key]);
      }
    }
    return res;
  }
  return obj;
}

class FirestoreTable {
  collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  async create({ record, data }: any) {
    const obj = record || data || {};
    const id = obj.id || Math.random().toString(36).substring(7);
    const newRecord = stripUndefined({ id, ...obj, createdAt: new Date().toISOString() });
    await setDoc(doc(db, this.collectionName, id), newRecord);
    return newRecord;
  }

  async bulkCreate({ records }: any) {
    for (const r of records) {
      await this.create({ record: r });
    }
  }

  async update({ id, record, data }: any) {
    const obj = record || data || {};
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new ZiteError('Not found');
    const updated = stripUndefined({ ...docSnap.data(), ...obj, updatedAt: new Date().toISOString() });
    await updateDoc(docRef, updated);
    return updated;
  }

  async delete({ id }: any) {
    await deleteDoc(doc(db, this.collectionName, id));
  }

  async findOne({ id, filters }: any) {
    if (id) {
      const docSnap = await getDoc(doc(db, this.collectionName, id));
      return docSnap.exists() ? docSnap.data() : null;
    }
    if (filters) {
      // Very basic filter matching for findOne
      const collRef = collection(db, this.collectionName);
      const queryConstraints: QueryConstraint[] = [];
      for (const [k, v] of Object.entries(filters)) {
        if (typeof v !== 'object') {
           queryConstraints.push(where(k, '==', v));
        }
      }
      const q = query(collRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      const all = querySnapshot.docs.map(d => d.data());
      // In-memory filter for complex filters not supported by firestore directly
      return all.find(r => {
        for (const [k, v] of Object.entries(filters)) {
          if (r[k] !== v) return false;
        }
        return true;
      }) || null;
    }
    return null;
  }

  async findAll({ filters, limit: limitVal, offset }: any) {
    const collRef = collection(db, this.collectionName);
    
    // Instead of building complex firestore queries that might require indexes, 
    // we fetch and filter in memory for this simple mock replacement
    const querySnapshot = await getDocs(collRef);
    let all = querySnapshot.docs.map(d => d.data());

    if (filters) {
      all = all.filter((r: any) => {
        for (const [k, v] of Object.entries(filters)) {
          if (v && typeof v === 'object' && 'in' in (v as any)) {
            if (!(v as any).in.includes(r[k])) return false;
          } else if (v && typeof v === 'object' && 'contains' in (v as any)) {
            const searchStr = (v as any).contains;
            if (typeof searchStr === 'string' && typeof r[k] === 'string') {
               if (!r[k].toLowerCase().includes(searchStr.toLowerCase())) return false;
            } else {
               return false;
            }
          } else if (v && typeof v === 'object' && ('gte' in (v as any) || 'lte' in (v as any) || 'gt' in (v as any) || 'lt' in (v as any))) {
            const vObj = v as any;
            if (vObj.gte !== undefined && r[k] < vObj.gte) return false;
            if (vObj.lte !== undefined && r[k] > vObj.lte) return false;
            if (vObj.gt !== undefined && r[k] <= vObj.gt) return false;
            if (vObj.lt !== undefined && r[k] >= vObj.lt) return false;
          } else {
            // allow loose match or substring for search
            if (typeof v === 'string' && typeof r[k] === 'string') {
               if (r[k] !== v && !r[k].toLowerCase().includes(v.toLowerCase())) return false;
            } else {
               if (r[k] !== v) return false;
            }
          }
        }
        return true;
      });
    }

    const total = all.length;
    if (offset) all = all.slice(offset);
    if (limitVal) all = all.slice(0, limitVal);
    
    return { records: all, total };
  }
}

export const Companies = new FirestoreTable('companies');
export const Users = new FirestoreTable('users');
export const Customers = new FirestoreTable('customers');
export const Invoices = new FirestoreTable('invoices');
export const InvoiceItems = new FirestoreTable('invoice_items');
export const Licenses = new FirestoreTable('licenses');
export const ActivationLogs = new FirestoreTable('activation_logs');
export const Manufacturers = new FirestoreTable('manufacturers');
export const Payments = new FirestoreTable('payments');
export const Products = new FirestoreTable('products');
export const Purchases = new FirestoreTable('purchases');
export const Suppliers = new FirestoreTable('suppliers');
export const UserSettings = new FirestoreTable('user_settings');

export const ZitePdf = {
  renderHtml: async ({ html }: any) => {
    return { url: 'data:application/pdf;base64,JVBERi...' };
  }
};

export const createEndpoint = (config: any) => {
  return config; 
};
