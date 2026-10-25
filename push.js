/* Notificações no celular do gestor (Firebase Cloud Messaging) e service worker do app instalável. */
(function(){
const CFG = window.APP_CONFIG || {};
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const load = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
let reg = null, messaging = null;
async function init(){
  if("serviceWorker" in navigator && location.protocol === "https:"){
    try{ reg = await navigator.serviceWorker.register("sw.js"); }catch(e){ console.warn("SW", e); }
  }
  if(!CFG.firebase) return;
  try{
    await load(FB + "firebase-app-compat.js"); await load(FB + "firebase-messaging-compat.js");
    firebase.initializeApp(CFG.firebase); messaging = firebase.messaging();
    messaging.onMessage(p => {
      const n = (p && p.notification) || {}; const t = document.createElement("div"); t.className = "toast warn on"; t.textContent = (n.title ? n.title + ": " : "") + (n.body || "");
      document.body.appendChild(t); setTimeout(() => t.remove(), 8000);
      if(window.ROTINA) window.ROTINA.load();
    });
  }catch(e){ console.warn("Firebase", e); }
}
async function enable(token, st){
  const say = m => { if(st) st.textContent = m; };
  if(!("Notification" in window)) return say("Este navegador não aceita notificações. No iPhone, instale o app pelo Safari (Compartilhar > Adicionar à Tela de Início) e abra pelo ícone.");
  if(!messaging) return say("O serviço de notificações não carregou. Confira a internet e a configuração do Firebase.");
  const perm = await Notification.requestPermission();
  if(perm !== "granted") return say("Permissão negada. Libere as notificações deste app nas configurações do celular.");
  try{
    const fcm = await messaging.getToken({vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg || await navigator.serviceWorker.ready});
    await API.admin("registerPush", token, {fcm, device: navigator.userAgent.slice(0, 120)});
    say("Pronto: este celular vai receber os avisos.");
  }catch(e){ say("Não foi possível ativar: " + e.message); }
}
window.PUSH = {init, enable};
})();
