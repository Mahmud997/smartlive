import {initializeApp, getApps} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const firebaseConfig={
  apiKey:"AIzaSyAYgfp3qrAzC4wTe6uhMXkdRhmGVMCt0gs",
  authDomain:"smatrlive.firebaseapp.com",
  projectId:"smatrlive",
  storageBucket:"smatrlive.firebasestorage.app",
  messagingSenderId:"42821091789",
  appId:"1:42821091789:web:9596abf558af79d88e4484",
  measurementId:"G-CWBNC3D4TW"
};

try{
  const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
  const auth=getAuth(app);
  const provider=new GoogleAuthProvider();

  window.loginWithGoogle=async()=>{
    try{
      await signInWithRedirect(auth,provider);
    }catch(error){
      console.error(error);
      notify("Google-вход сейчас недоступен. Используйте демо-вход.","error");
    }
  };

  getRedirectResult(auth).catch(error=>{
    if(error) console.error("Firebase redirect:",error);
  });

  onAuthStateChanged(auth,user=>{
    if(!user)return;
    const old=window.currentUser;
    const data={uid:user.uid,displayName:user.displayName||"Пользователь",email:user.email||"",phone:user.phoneNumber||user.email||"Google Аккаунт",role:"user"};
    localStorage.setItem(STORAGE.user,JSON.stringify(data));
    currentUser=data;
    updateProfileUI();
    closeModal("auth-modal");
    if(!old) notify("Вы успешно вошли через Google");
  });
}catch(error){
  console.warn("Firebase не инициализирован:",error);
  window.loginWithGoogle=()=>notify("Firebase Authentication не настроен. Используйте демо-вход.","error");
}
