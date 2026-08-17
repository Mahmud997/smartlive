/* САЙРАМ LIVE — Firebase Authentication
   Project: smatrlive
   Hosting: GitHub Pages

   Firebase Console:
   1) Authentication -> Sign-in method -> Google -> Enable
   2) Authentication -> Settings -> Authorized domains
      add: mahmud997.github.io
*/

import { initializeApp, getApps, getApp } from
  "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut
} from
  "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYgfp3qrAzC4wTe6uhMXkdRhmGVMCt0gs",
  authDomain: "smatrlive.firebaseapp.com",
  projectId: "smatrlive",
  storageBucket: "smatrlive.firebasestorage.app",
  messagingSenderId: "42821091789",
  appId: "1:42821091789:web:9596abf558af79d88e4484",
  measurementId: "G-CWBNC3D4TW"
};

let auth = null;
let provider = null;

function bridge() {
  return window.SairamLive || null;
}

function readableAuthError(error) {
  const code = error?.code || "";
  const map = {
    "auth/unauthorized-domain":
      "Firebase не разрешает этот домен. Добавьте mahmud997.github.io в Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed":
      "Google-вход выключен. В Firebase → Authentication → Sign-in method включите Google.",
    "auth/popup-blocked":
      "Браузер заблокировал окно Google. Разрешите всплывающие окна для mahmud997.github.io.",
    "auth/popup-closed-by-user":
      "Окно входа Google закрыто. Нажмите «Войти через Google» ещё раз.",
    "auth/cancelled-popup-request":
      "Предыдущий запрос входа ещё выполняется.",
    "auth/network-request-failed":
      "Нет соединения с Firebase/Google. Проверьте интернет.",
    "auth/invalid-api-key":
      "Firebase API key неверный.",
    "auth/app-not-authorized":
      "Приложение не авторизовано в Firebase.",
    "auth/invalid-credential":
      "Учетные данные Google недействительны или истекли.",
    "auth/account-exists-with-different-credential":
      "Этот email уже зарегистрирован через другой способ входа."
  };
  return map[code] || ("Firebase: " + (code || "unknown") +
    (error?.message ? " — " + error.message : ""));
}

function showError(error) {
  console.error("Firebase Authentication:", error);
  bridge()?.notify(readableAuthError(error), "error");
}

async function init() {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    await setPersistence(auth, browserLocalPersistence);

    window.firebaseAuth = auth;
    window.firebaseSignOut = () => signOut(auth);

    /*
      GitHub Pages is a third-party host relative to firebaseapp.com.
      Firebase documents popup as the simple workaround for browsers
      that block third-party storage used by redirect auth.
    */
    window.loginWithGoogle = async () => {
      if (!auth || !provider) {
        bridge()?.notify("Firebase ещё не готов. Повторите вход через секунду.", "error");
        return;
      }

      try {
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          console.log("Google sign-in successful:", result.user.uid);
        }
      } catch (error) {
        /*
          Popup blocked -> try redirect automatically.
          Other errors are shown immediately with their exact Firebase code.
        */
        if (error?.code === "auth/popup-blocked") {
          try {
            await signInWithRedirect(auth, provider);
            return;
          } catch (redirectError) {
            showError(redirectError);
            return;
          }
        }
        showError(error);
      }
    };

    try {
      await getRedirectResult(auth);
    } catch (error) {
      showError(error);
    }

    onAuthStateChanged(auth, (user) => {
      const api = bridge();
      if (!api) return;

      if (user) {
        const data = {
          uid: user.uid,
          displayName: user.displayName || "Пользователь",
          email: user.email || "",
          phone: user.phoneNumber || user.email || "Google Аккаунт",
          photoURL: user.photoURL || "",
          role: "user",
          provider: "google"
        };

        api.setUser(data);
        api.saveUser();
        api.updateProfile();
        api.closeAuth();
        api.notify("Вы успешно вошли через Google");
      } else {
        /*
          Only remove a persisted Firebase/Google session here.
          A demo user is intentionally left alone until the user logs out.
        */
        const localUser = api.getUser();
        if (localUser?.provider === "google") {
          api.clearUser();
          api.saveUser();
          api.updateProfile();
        }
      }
    });

    console.log("Firebase initialized:", firebaseConfig.projectId);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    window.loginWithGoogle = () => showError(error);
    bridge()?.notify(
      "Firebase не запустился. Проверьте Authentication → Google и Authorized domains.",
      "error"
    );
  }
}

init();
