"use strict";

/* =========================
   САЙРАМ LIVE — ОСНОВНАЯ ЛОГИКА
   Всё хранится локально, поэтому приложение работает даже без backend.
========================= */

const STORAGE = {
  ads:"sairam_live_ads_v2",
  favs:"sairam_live_favorites_v2",
  user:"sairam_live_user_v2",
  notifications:"sairam_live_notifications_v2",
  orders:"sairam_live_taxi_orders_v2"
};

const categories = [
  ["Такси","fa-taxi",45],["Мастера","fa-screwdriver-wrench",124],
  ["Скот / Агро","fa-cow",89],["Авто","fa-car",56],
  ["Жильё","fa-house",41],["Электроника","fa-mobile-screen",67],
  ["Одежда","fa-shirt",38],["Еда","fa-utensils",22],
  ["Работа","fa-briefcase",19],["Детские товары","fa-baby",15],
  ["Мебель","fa-couch",27],["Животные","fa-paw",11],["Другое","fa-ellipsis",34]
];

const defaultAds = [
 {id:"demo1",title:"Опытный тандырщик и повар на тои и мероприятия",price:"Договорная",category:"Еда",location:"Центр",phone:"+77001234567",icon:"fa-fire-burner",hit:true,owner:"demo"},
 {id:"demo2",title:"Электрик + сантехник с выездом по Сайраму",price:"от 3 000 ₸",category:"Мастера",location:"Сайрам",phone:"+77001234567",icon:"fa-bolt",owner:"demo"},
 {id:"demo3",title:"Продажа бычков — племенные, упитанные",price:"450 000 ₸",category:"Скот / Агро",location:"Мар-Тобе",phone:"+77001234567",icon:"fa-cow",owner:"demo"},
 {id:"demo4",title:"Toyota Camry 2018, отличное состояние",price:"8 900 000 ₸",category:"Авто",location:"Сайрам",phone:"+77001234567",icon:"fa-car",owner:"demo"},
 {id:"demo5",title:"Сдам 2-комн. квартиру, центр, мебель",price:"120 000 ₸/мес",category:"Жильё",location:"Центр",phone:"+77001234567",icon:"fa-house",owner:"demo"},
 {id:"demo6",title:"Мастер по ремонту бытовой техники",price:"от 2 500 ₸",category:"Мастера",location:"Сайрам",phone:"+77001234567",icon:"fa-screwdriver-wrench",owner:"demo"}
];

let ads = loadJSON(STORAGE.ads, defaultAds);
let favorites = new Set(loadJSON(STORAGE.favs, []));
let notifications = loadJSON(STORAGE.notifications, []);
let taxiOrders = loadJSON(STORAGE.orders, []);
let currentUser = loadJSON(STORAGE.user, null);
let activeCategory = "";
let map = null;
let mapInitialized = false;

function loadJSON(key, fallback){
  try{
    const raw=localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ console.warn("Storage error",key,e); return fallback; }
}
function saveJSON(key,value){ try{localStorage.setItem(key,JSON.stringify(value));}catch(e){console.warn(e)} }
function esc(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function notify(text,type="success"){
  const box=document.getElementById("toast-container");
  const el=document.createElement("div");
  el.className="toast "+type;
  el.innerHTML=`<i class="fa-solid ${type==="error"?"fa-circle-exclamation":"fa-circle-check"}"></i><span>${esc(text)}</span>`;
  box.appendChild(el);
  setTimeout(()=>el.remove(),3200);

  notifications.unshift({id:Date.now(),text:String(text),time:new Date().toLocaleString("ru-RU")});
  notifications=notifications.slice(0,30);
  saveJSON(STORAGE.notifications,notifications);
  renderNotifications();
}
function showPage(page){
  const target=document.getElementById("page-"+page);
  if(!target){ console.warn("Unknown page:",page); notify("Раздел пока недоступен","error"); return; }
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  target.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  const nav=document.getElementById("nav-"+page);
  if(nav) nav.classList.add("active");
  window.scrollTo({top:0,behavior:"instant"});
  if(page==="taxi") setTimeout(initMap,80);
  if(page==="favorites") renderFavorites();
  if(page==="categories") renderCategories();
  if(page==="profile") updateProfileUI();
}
function refreshFeed(){
  renderFeed();
  notify("Лента обновлена");
}
function selectCategory(category){
  activeCategory=category;
  if(category==="Такси"){showPage("taxi");return;}
  showPage("home");
  renderFeed();
  document.getElementById("feed-title").textContent=category;
  window.scrollTo({top:document.querySelector(".section-title")?.offsetTop||0,behavior:"smooth"});
}
function matchesSearch(ad,q){
  if(!q) return true;
  const hay=[ad.title,ad.price,ad.category,ad.location,ad.description].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}
function renderFeed(){
  const q=document.getElementById("search-input")?.value.trim()||"";
  const list=ads.filter(a=>(!activeCategory||a.category===activeCategory)&&matchesSearch(a,q));
  const box=document.getElementById("feed-container");
  document.getElementById("feed-title").textContent=activeCategory||"Свежие объявления";
  if(!list.length){
    box.innerHTML=`<div class="empty"><i class="fa-regular fa-face-frown"></i><p>Объявлений не найдено</p><small>Попробуйте другую категорию или поиск</small></div>`;
    return;
  }
  box.innerHTML=list.map(renderCard).join("");
}
function renderCard(ad){
  const fav=favorites.has(ad.id);
  return `<article class="card">
    ${ad.hit?'<div class="badge">Хит</div>':""}
    <button class="fav-small ${fav?"active":""}" onclick="toggleFavorite('${esc(ad.id)}')" aria-label="Избранное"><i class="${fav?"fa-solid":"fa-regular"} fa-heart"></i></button>
    <div class="card-img"><i class="fa-solid ${esc(ad.icon||"fa-box")}"></i></div>
    <div class="card-info">
      <div><div class="card-title">${esc(ad.title)}</div><div class="card-price ${ad.price==="Договорная"?"negotiable":""}">${esc(ad.price)}</div></div>
      <div class="card-footer">
        <span class="card-meta"><i class="fa-solid fa-location-dot"></i>${esc(ad.location||"Сайрам")}</span>
        <a class="btn-call" href="tel:${esc(ad.phone||"")}"><i class="fa-solid fa-phone"></i> Позвонить</a>
      </div>
    </div>
  </article>`;
}
function toggleFavorite(id){
  if(favorites.has(id)) favorites.delete(id); else favorites.add(id);
  saveJSON(STORAGE.favs,[...favorites]);
  renderFeed(); renderFavorites();
  notify(favorites.has(id)?"Добавлено в избранное":"Удалено из избранного");
}
function renderFavorites(){
  const box=document.getElementById("favorites-container");
  const list=ads.filter(a=>favorites.has(a.id));
  box.innerHTML=list.length?list.map(renderCard).join(""):`<div class="empty"><i class="fa-regular fa-heart"></i><p>Пока пусто</p><small>Нажмите ❤️ на объявлении, чтобы сохранить его</small></div>`;
}
function renderCategories(){
  document.getElementById("category-list").innerHTML=categories.map(([name,icon,count])=>
    `<div class="cat-item" onclick="selectCategory('${esc(name)}')"><i class="fa-solid ${icon}"></i><span>${esc(name)}</span><small>${count}</small></div>`
  ).join("");
  document.getElementById("ad-category").innerHTML=categories.map(c=>`<option value="${esc(c[0])}">${esc(c[0])}</option>`).join("");
}
function renderNotifications(){
  const box=document.getElementById("notifications-list");
  if(!notifications.length){
    box.innerHTML=`<div class="empty"><i class="fa-regular fa-bell"></i><p>Уведомлений пока нет</p></div>`;return;
  }
  box.innerHTML=notifications.map(n=>`<div class="profile-item"><i class="fa-solid fa-bell"></i><div><span>${esc(n.text)}</span><small style="display:block;color:#94a3b8;font-size:10px;margin-top:3px">${esc(n.time)}</small></div></div>`).join("");
}
function showMyAds(){
  if(!currentUser){openAuthModal();return;}
  const mine=ads.filter(a=>a.owner===currentUser.uid);
  if(!mine.length){notify("У вас пока нет активных объявлений");return;}
  showPage("home");
  activeCategory="";
  document.getElementById("feed-title").textContent="Мои объявления";
  document.getElementById("feed-container").innerHTML=mine.map(renderCard).join("");
}
function updateProfileUI(){
  const name=document.getElementById("user-display-name");
  const phone=document.getElementById("user-display-phone");
  const auth=document.getElementById("auth-btn-text");
  if(currentUser){
    name.textContent=currentUser.displayName||"Пользователь";
    phone.textContent=currentUser.phone||currentUser.email||"Аккаунт";
    auth.textContent="Выйти из аккаунта";
  }else{
    name.textContent="Гость";phone.textContent="Войдите, чтобы размещать объявления";auth.textContent="Войти / Зарегистрироваться";
  }
  const isAdmin=!!currentUser&&currentUser.role==="admin";
  document.getElementById("admin-panel-item").style.display=isAdmin?"flex":"none";
  document.getElementById("admin-toggle-text").textContent=isAdmin?"Выйти из режима Администратора":"Войти как Администратор";
  document.getElementById("stat-users").textContent=currentUser?1:0;
  document.getElementById("stat-ads").textContent=ads.length;
  document.getElementById("stat-orders").querySelector("h4").textContent=taxiOrders.length;
}
function openAuthModal(){ if(currentUser){ if(confirm("Выйти из аккаунта?")) logout(); return;} openModal("auth-modal"); }
function openModal(id){document.getElementById(id)?.classList.add("active");document.body.classList.add("no-scroll")}
function closeModal(id){document.getElementById(id)?.classList.remove("active");if(!document.querySelector(".modal.active"))document.body.classList.remove("no-scroll")}
function demoLogin(){
  currentUser={uid:"demo-user",displayName:"Демо пользователь",phone:"+77001234567",email:"demo@sairam.live",role:"user"};
  saveJSON(STORAGE.user,currentUser);updateProfileUI();closeModal("auth-modal");notify("Вы вошли как демо-пользователь");
}
async function logout(){
  try{
    if(typeof window.firebaseSignOut === "function"){
      await window.firebaseSignOut();
    }
  }catch(error){
    console.warn("Firebase signOut:", error);
  }
  currentUser=null;
  saveJSON(STORAGE.user,null);
  updateProfileUI();
  notify("Вы вышли из аккаунта");
  showPage("home");
}
function toggleAdminRole(){
  if(!currentUser){openAuthModal();return;}
  if(currentUser.role==="admin"){
    currentUser.role="user";saveJSON(STORAGE.user,currentUser);updateProfileUI();notify("Режим администратора отключен");return;
  }
  const pass=prompt("Введите пароль администратора (демо):");
  if(pass==="admin123"){
    currentUser.role="admin";saveJSON(STORAGE.user,currentUser);updateProfileUI();notify("Режим администратора активирован");showPage("admin");
  }else if(pass!==null) notify("Неверный пароль","error");
}
function openAddModal(){
  if(!currentUser){notify("Сначала войдите или используйте демо-вход","error");openAuthModal();return;}
  document.getElementById("ad-title").value="";
  document.getElementById("ad-price").value="";
  document.getElementById("ad-phone").value=currentUser.phone||"";
  document.getElementById("ad-desc").value="";
  renderCategories();openModal("add-modal");
}
function publishAd(){
  if(!currentUser){notify("Требуется вход","error");return;}
  const title=document.getElementById("ad-title").value.trim();
  const category=document.getElementById("ad-category").value;
  const price=document.getElementById("ad-price").value.trim();
  const phone=document.getElementById("ad-phone").value.trim()||currentUser.phone||"";
  const description=document.getElementById("ad-desc").value.trim();
  if(title.length<3){notify("Введите название объявления","error");return;}
  if(!price){notify("Укажите цену","error");return;}
  const ad={id:"ad_"+Date.now(),title,category,price,phone,description,location:"Сайрам",icon:iconFor(category),owner:currentUser.uid,createdAt:Date.now()};
  ads.unshift(ad);saveJSON(STORAGE.ads,ads);closeModal("add-modal");renderFeed();updateProfileUI();notify("Объявление опубликовано");showPage("home");
}
function iconFor(cat){
  const m={"Такси":"fa-taxi","Мастера":"fa-screwdriver-wrench","Скот / Агро":"fa-cow","Авто":"fa-car","Жильё":"fa-house","Электроника":"fa-mobile-screen","Одежда":"fa-shirt","Еда":"fa-utensils","Работа":"fa-briefcase"};
  return m[cat]||"fa-box";
}
function sendTaxiOrder(){
  const from=document.getElementById("taxi-from").value.trim(),to=document.getElementById("taxi-to").value.trim();
  const price=document.getElementById("taxi-price").value.trim(),phone=document.getElementById("taxi-phone").value.trim();
  if(!from||!to||!price||!phone){notify("Заполните все поля заказа такси","error");return;}
  const order={id:"taxi_"+Date.now(),from,to,price,phone,createdAt:Date.now()};
  taxiOrders.unshift(order);saveJSON(STORAGE.orders,taxiOrders);
  notify(`Заявка ${from} → ${to} отправлена водителям`);
  document.getElementById("taxi-to").value="";document.getElementById("taxi-price").value="";
  updateProfileUI();
}
function initMap(){
  if(mapInitialized)return;
  const mapBox=document.getElementById("map");
  if(!mapBox||typeof L==="undefined"){return;}
  map=L.map("map").setView([42.3089,69.7592],14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);
  const marker=L.marker([42.3089,69.7592],{draggable:true}).addTo(map);
  marker.bindPopup("Место подачи такси").openPopup();
  marker.on("dragend",e=>{
    const c=e.target.getLatLng();
    document.getElementById("taxi-from").value=`Точка: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
  });
  map.on("click",e=>{
    marker.setLatLng(e.latlng);
    document.getElementById("taxi-from").value=`Точка: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
  });
  mapInitialized=true;
}
function sendBroadcastNotification(){
  const msg=prompt("Введите текст уведомления:");
  if(msg?.trim()) notify("Рассылка создана: "+msg.trim());
}
function exportData(){
  const data={ads,favorites:[...favorites],notifications,taxiOrders,user:currentUser};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="sairam-live-backup.json";a.click();URL.revokeObjectURL(url);notify("Резервная копия скачана");
}
function clearDemoData(){
  if(!confirm("Удалить только добавленные вами тестовые объявления?"))return;
  if(currentUser){
    ads=ads.filter(a=>a.owner!==currentUser.uid);
    saveJSON(STORAGE.ads,ads);renderFeed();updateProfileUI();notify("Ваши тестовые объявления удалены");
  }
}

/* Поиск */
document.getElementById("search-input").addEventListener("input",()=>{activeCategory="";renderFeed()});

/* Закрытие модалок тапом по фону и Escape */
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal.active").forEach(m=>closeModal(m.id))});

/* Безопасная загрузка */
function boot(){
  renderCategories();renderFeed();renderFavorites();renderNotifications();updateProfileUI();
  if(!notifications.length){
    notifications=[{id:1,text:"Добро пожаловать в Сайрам Live!",time:new Date().toLocaleString("ru-RU")}];
    saveJSON(STORAGE.notifications,notifications);renderNotifications();
  }
}
window.addEventListener("load",boot);

/* Совместимость с именами функций старой версии */
window.switchView=id=>showPage(String(id).replace(/^view-/,""));
window.filterCategory=selectCategory;
window.renderListings=renderFeed;
window.orderTaxi=sendTaxiOrder;
window.toggleAuth=openAuthModal;


/* =========================
   GLOBAL BRIDGE
   Firebase is an ES module and cannot directly see app.js lexical variables.
   Expose only the functions/state it needs through one stable API.
========================= */
window.SairamLive = {
  getUser: () => currentUser,
  setUser: (user) => { currentUser = user; },
  clearUser: () => { currentUser = null; },
  saveUser: () => saveJSON(STORAGE.user, currentUser),
  updateProfile: () => updateProfileUI(),
  closeAuth: () => closeModal("auth-modal"),
  notify: (text, type="success") => notify(text, type),
  goHome: () => showPage("home"),
  logoutLocal: () => {
    currentUser = null;
    saveJSON(STORAGE.user, null);
    updateProfileUI();
    showPage("home");
  }
};

/* Never let a missing Firebase module make the Login button dead. */
if (typeof window.loginWithGoogle !== "function") {
  window.loginWithGoogle = () => notify(
    "Firebase ещё загружается. Повторите через секунду.",
    "error"
  );
}

