require("dotenv").config();
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// Inicializa o Firebase apenas uma vez
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- FUNÇÕES DE RSVP (Confirmação) ---

const saveConfirmation = async (data) => {
  try {
    const docRef = await addDoc(collection(db, "confirmations"), data);
    return docRef.id;
  } catch (error) {
    console.error("Erro ao salvar:", error);
    throw error;
  }
};

const checkEmailExists = async (email) => {
  const q = query(collection(db, "confirmations"), where("email", "==", email));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
};

// --- FUNÇÕES DE EMAIL AUTOMÁTICO (Job) ---

const getApprovedPendingGuests = async () => {
  try {
    const confirmRef = collection(db, "confirmations");
    // Busca apenas quem está APROVADO e ainda NÃO recebeu email
    const q = query(
      confirmRef,
      where("status", "==", "approved"),
      where("emailSent", "==", false)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Erro ao buscar pendentes:", error);
    return [];
  }
};

const markGuestAsNotified = async (id) => {
  try {
    const docRef = doc(db, "confirmations", id);
    await updateDoc(docRef, {
      emailSent: true,
      emailSentAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Erro ao marcar notificado:", error);
    return false;
  }
};

module.exports = {
  db,
  saveConfirmation,
  checkEmailExists,
  getApprovedPendingGuests,
  markGuestAsNotified,
};
