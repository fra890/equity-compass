import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { Client } from '../types';

// Collection reference: users/{userId}/clients
const getClientCollection = (userId: string) => collection(db, 'users', userId, 'clients');

export const getClients = async (userId: string): Promise<Client[]> => {
  try {
    const querySnapshot = await getDocs(getClientCollection(userId));
    return querySnapshot.docs.map(doc => doc.data() as Client);
  } catch (error) {
    console.error("Error fetching clients:", error);
    throw error;
  }
};

export const saveClient = async (userId: string, client: Client): Promise<void> => {
  try {
    const docRef = doc(db, 'users', userId, 'clients', client.id);
    await setDoc(docRef, client);
  } catch (error) {
    console.error("Error saving client:", error);
    throw error;
  }
};

export const deleteClient = async (userId: string, clientId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'users', userId, 'clients', clientId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting client:", error);
    throw error;
  }
};