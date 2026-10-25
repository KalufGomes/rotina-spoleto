/* Configuração da instalação. Preencha depois de publicar o servidor (Apps Script) e criar o projeto no Firebase.
   Com apiUrl vazio, o app abre em MODO DEMONSTRAÇÃO, com dados de exemplo guardados só no aparelho. */
self.APP_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbywoiJDpNukJu99sffcphQ-GtVP_aSdfF8o6JWlOSoY0NDIG6k8H4xuRNVazDngRy1Z/exec",            // URL do app da Web do Apps Script (termina em /exec)
  firebase: // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDAa2kaLXbwg0ddnol_pubX996u-8O3ips",
  authDomain: "rotina-spoleto.firebaseapp.com",
  projectId: "rotina-spoleto",
  storageBucket: "rotina-spoleto.firebasestorage.app",
  messagingSenderId: "1059013341666",
  appId: "1:1059013341666:web:d584d655f2239def7a09bb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);,        // { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
  vapidKey: "BGZJHhPVVyV-LQjb13H5N6e-94YuP3x_AJlq-C3-R8GasstN-uxFefg592zYlGAizQiQhGkLDgotIw6GRnVBiuk",          // Firebase > Configurações do projeto > Cloud Messaging > Certificados push da Web
};
