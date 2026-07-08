/* =========================================================
   auth.js — inicio de sesión con Google (vía Firebase) o modo local
   ========================================================= */

function loginLocal(){
  if(CLOUD_MODE) stopCloudSync();
  DB = loadDB(); // aseguramos que usamos los datos locales, no restos de la nube
  DB.user = { name:'Usuario local', email:'', picture:'', provider:'local' };
  persist();
  enterApp();
}

async function loginGoogle(){
  if(!FIREBASE_CONFIGURED){
    alert('Todavía no se ha configurado Firebase en js/firebase-config.js. Puedes usar "Continuar sin cuenta" mientras tanto.');
    return;
  }
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    // onAuthStateChanged se encarga del resto
  }catch(e){
    console.error(e);
    alert('No se pudo iniciar sesión con Google: ' + (e.message || e));
  }
}

async function logout(){
  if(CLOUD_MODE){
    stopCloudSync();
    try{ await auth.signOut(); }catch(e){ console.error(e); }
  }
  DB = loadDB(); // al salir, volvemos a ver solo los datos locales de este navegador
  DB.user = null;
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
}

function enterApp(){
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-app').classList.remove('hidden');
  renderUserChip();
  renderSyncStatus();
  if(typeof initAppData === 'function') initAppData();
}

function renderUserChip(){
  const chip = document.getElementById('user-chip');
  chip.textContent = DB.user ? (DB.user.name + (DB.user.email ? ' · '+DB.user.email : '')) : '';
}

function renderSyncStatus(){
  const el = document.getElementById('sync-status');
  if(!el) return;
  el.textContent = CLOUD_MODE ? '☁️ Sincronizado' : '💾 Solo en este dispositivo';
}

/* Se llama cada vez que llegan datos nuevos desde Firestore
   (por ejemplo, si editas la misma cuenta desde otro dispositivo) */
function onCloudDataChange(){
  renderSyncStatus();
  if(typeof refreshCurrentView === 'function') refreshCurrentView();
}

window.addEventListener('load', ()=>{
  document.getElementById('btn-local-login').addEventListener('click', loginLocal);
  document.getElementById('btn-google-login').addEventListener('click', loginGoogle);
  document.getElementById('btn-logout').addEventListener('click', logout);

  if(!FIREBASE_CONFIGURED){
    document.getElementById('firebase-warning').classList.remove('hidden');
  }

  if(FIREBASE_CONFIGURED){
    auth.onAuthStateChanged((user)=>{
      if(user){
        DB.user = {
          name: user.displayName || 'Usuario de Google',
          email: user.email || '',
          picture: user.photoURL || '',
          provider: 'google',
          uid: user.uid
        };
        startCloudSync(user.uid);
        enterApp();
      } else if(DB.user && DB.user.provider === 'local'){
        enterApp();
      }
    });
  } else if(DB.user && DB.user.provider === 'local'){
    enterApp();
  }
});
