/* Configuração da instalação. Preencha depois de publicar o servidor (Apps Script) e criar o projeto no Firebase.
   Com apiUrl vazio, o app abre em MODO DEMONSTRAÇÃO, com dados de exemplo guardados só no aparelho. */
self.APP_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbywoiJDpNukJu99sffcphQ-GtVP_aSdfF8o6JWlOSoY0NDIG6k8H4xuRNVazDngRy1Z/exec",            // URL do app da Web do Apps Script (termina em /exec)
  firebase: null,        // { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
  vapidKey: "",          // Firebase > Configurações do projeto > Cloud Messaging > Certificados push da Web
};
