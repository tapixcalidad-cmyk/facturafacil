/* =========================================================
   auth.js — inicio de sesión con Google (Google Identity Services)
   ---------------------------------------------------------
   IMPORTANTE: para que el botón de Google funcione en tu propia
   página debes:
     1. Crear un "OAuth Client ID" tipo "Web application" en
        https://console.cloud.google.com/apis/credentials
     2. Agregar como "Authorized JavaScript origin" la URL donde
        publiques la página (por ejemplo https://tuusuario.github.io)
     3. Reemplazar GOOGLE_CLIENT_ID abajo con el Client ID que te den.
   Mientras tanto, o si prefieres no usar Google, el botón
   "Continuar sin cuenta de Google" funciona siempre y guarda
   todo localmente en el navegador.
   ========================================================= */

const GOOGLE_CLIENT_ID = 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

function decodeJwt(token){
  try{
    const base64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(decodeURIComponent(atob(base64).split('').map(c=>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')));
  }catch(e){ return null; }
}

function handleGoogleCredential(response){
  const payload = decodeJwt(response.credential);
  if(!payload) return;
  DB.user = { name: payload.name, email: payload.email, picture: payload.picture, provider:'google' };
  persist();
  enterApp();
}

function initGoogleButton(){
  if(!window.google || GOOGLE_CLIENT_ID.startsWith('TU_')){
    // Sin Client ID configurado todavía: ocultamos el botón oficial
    // para no mostrar un botón de Google que no va a funcionar.
    document.getElementById('g_id_signin_container').innerHTML =
      '<p class="muted small" style="margin:0 0 .6rem;">Configura tu Google Client ID en js/auth.js para activar el inicio de sesión con Google.</p>';
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential
  });
  google.accounts.id.renderButton(
    document.getElementById('g_id_signin_container'),
    { theme:'outline', size:'large', shape:'pill', width:280 }
  );
}

function loginLocal(){
  DB.user = { name:'Usuario local', email:'', picture:'', provider:'local' };
  persist();
  enterApp();
}

function logout(){
  DB.user = null;
  persist();
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
}

function enterApp(){
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-app').classList.remove('hidden');
  renderUserChip();
  if(typeof initAppData === 'function') initAppData();
}

function renderUserChip(){
  const chip = document.getElementById('user-chip');
  if(DB.user) chip.textContent = DB.user.name + (DB.user.email ? ' · '+DB.user.email : '');
}

window.addEventListener('load', ()=>{
  initGoogleButton();
  document.getElementById('btn-local-login').addEventListener('click', loginLocal);
  document.getElementById('btn-logout').addEventListener('click', logout);
  if(DB.user){ enterApp(); }
});
