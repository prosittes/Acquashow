// firebase.js – configuração completa do Firebase (compat)

// --- Configuração do seu projeto ---
const firebaseConfig = {
 apiKey: "AIzaSyA8yUZ2wN5Ad8ZSolOnGI2PIb_6j3Zsbh4",
  authDomain: "acquashow-piscinas.firebaseapp.com",
  projectId: "acquashow-piscinas",
  storageBucket: "acquashow-piscinas.firebasestorage.app",
  messagingSenderId: "823366312565",
  appId: "1:823366312565:web:d75f19f4b8f186febd8e3c"
};

// --- Inicializa Firebase ---
firebase.initializeApp(firebaseConfig);

// --- Atalhos para usar no auth.js ---
const auth = firebase.auth();
const db   = firebase.firestore();
