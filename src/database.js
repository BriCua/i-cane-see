import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const usersCollection = collection(db, 'users');

export const createUser = async (uid, data) => {
  try {
    await setDoc(doc(usersCollection, uid), data);
  } catch (error) {
    console.error('Error creating user:', error);
    throw new Error('Failed to create user.');
  }
};
export const updateUser = async (uid, data) => {
  try {
    await setDoc(doc(usersCollection, uid), data, { merge: true });
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error('Failed to update user.');
  }
};