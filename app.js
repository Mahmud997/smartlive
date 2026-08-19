"use strict";

/* =========================
   SMART LIVE — основная логика
   Дизайн и структура сохранены. Добавлены:
   • фото объявлений (до 5)
   • предпросмотр и удаление фото
   • сохранение фото локально
   • расширенная логика такси passenger/driver
   • realtime taxi через Firebase, с локальным fallback
========================= */

const STORAGE = {
  ads:"sairam_live_ads_v3",
  favs:"sairam_live_favorites_v3",
  user:"sairam_live_user_v3",
  notifications:"sairam_live_notifications_v3",
  orders:"sairam_live_taxi_orders_v3",
  driver:"sairam_live_driver_v2"
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
let taxiMode = "passenger";
let pendingPhotos = [];
let taxiRealtimeUnsub = null;

function loadJSON(key,fallback){
  try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}
  catch(e){console.warn("Storage error",key,e);return fallback;}
}
function saveJSON(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));}
  catch(e){console.warn("Storage save error",e);notify("Память телефона заполнена. Удалите старые объявления с фото.","error");}
}
function esc(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function notify(text,type="success"){
  const box=document.getElementById("toast-container");
  if(!box)return;
  const el=document.createElement("div");
  el.className="toast "+type;
  el.innerHTML=`<i class="fa-solid ${type==="error"?"fa-circle-exclamation":"fa-circle-check"}"></i><span>${esc(text)}</span>`;
  box.appendChild(el);setTimeout(()=>el.remove(),3200);
  notifications.unshift({id:Date.now(),text:String(text),time:new Date().toLocaleString("ru-RU")});
  notifications=notifications.slice(0,30);saveJSON(STORAGE.notifications,notifications);renderNotifications();
}

function showPage(page){
  const target=document.getElementById("page-"+page);
  if(!target){notify("Раздел пока недоступен","error");return;}
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  target.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  document.getElementById("nav-"+page)?.classList.add("active");
  window.scrollTo({top:0,behavior:"instant"});
  if(page==="taxi"){setTimeout(initMap,80);setTimeout(()=>TaxiLive?.start(taxiMode),100);}
  if(page==="favorites")renderFavorites();
  if(page==="categories")renderCategories();
  if(page==="profile")updateProfileUI();
}
function refreshFeed(){activeCategory="";renderFeed();notify("Лента обновлена");}
function selectCategory(category){
  activeCategory=category;
  if(category==="Такси"){showPage("taxi");return;}
  showPage("home");renderFeed();
  document.getElementById("feed-title").textContent=category;
  window.scrollTo({top:document.querySelector(".section-title")?.offsetTop||0,behavior:"smooth"});
}
function matchesSearch(ad,q){
  if(!q)return true;
  return [ad.title,ad.price,ad.category,ad.location,ad.description].join(" ").toLowerCase().includes(q.toLowerCase());
}
function renderFeed(){
  const q=document.getElementById("search-input")?.value.trim()||"";
  const list=ads.filter(a=>(!activeCategory||a.category===activeCategory)&&matchesSearch(a,q));
  const box=document.getElementById("feed-container");
  if(!box)return;
  document.getElementById("feed-title").textContent=activeCategory||"Свежие объявления";
  box.innerHTML=list.length?list.map(renderCard).join(""):`<div class="empty"><i class="fa-regular fa-face-frown"></i><p>Объявлений не найдено</p><small>Попробуйте другую категорию или поиск</small></div>`;
}
function renderCard(ad){
  const fav=favorites.has(ad.id);
  const img=ad.photos?.[0];
  const imageHtml=img?`<img src="${esc(img)}" alt="${esc(ad.title)}" loading="lazy">`:`<i class="fa-solid ${esc(ad.icon||"fa-box")}"></i>`;
  const ownerBtn=ad.owner===(currentUser?.uid)?`<button class="delete-ad-btn" onclick="deleteAd('${esc(ad.id)}');event.stopPropagation()" title="Удалить"><i class="fa-solid fa-trash"></i></button>`:"";
  return `<article class="card">
    ${ad.hit?'<div class="badge">Хит</div>':""}
    <button class="fav-small ${fav?"active":""}" onclick="toggleFavorite('${esc(ad.id)}');event.stopPropagation()" aria-label="Избранное"><i class="${fav?"fa-solid":"fa-regular"} fa-heart"></i></button>
    ${ownerBtn}
    <div class="card-img">${imageHtml}</div>
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
  if(favorites.has(id))favorites.delete(id);else favorites.add(id);
  saveJSON(STORAGE.favs,[...favorites]);renderFeed();renderFavorites();
  notify(favorites.has(id)?"Добавлено в избранное":"Удалено из избранного");
}
function renderFavorites(){
  const box=document.getElementById("favorites-container");if(!box)return;
  const list=ads.filter(a=>favorites.has(a.id));
  box.innerHTML=list.length?list.map(renderCard).join(""):`<div class="empty"><i class="fa-regular fa-heart"></i><p>Пока пусто</p><small>Нажмите ❤️ на объявлении, чтобы сохранить его</small></div>`;
}
function renderCategories(){
  const list=document.getElementById("category-list"),select=document.getElementById("ad-category");
  if(list)list.innerHTML=categories.map(([name,icon,count])=>`<div class="cat-item" onclick="selectCategory('${esc(name)}')"><i class="fa-solid ${icon}"></i><span>${esc(name)}</span><small>${count}</small></div>`).join("");
  if(select)select.innerHTML=categories.map(c=>`<option value="${esc(c[0])}">${esc(c[0])}</option>`).join("");
}
function renderNotifications(){
  const box=document.getElementById("notifications-list");if(!box)return;
  box.innerHTML=notifications.length?notifications.map(n=>`<div class="profile-item"><i class="fa-solid fa-bell"></i><div><span>${esc(n.text)}</span><small style="display:block;color:#94a3b8;font-size:10px;margin-top:3px">${esc(n.time)}</small></div></div>`).join(""):`<div class="empty"><i class="fa-regular fa-bell"></i><p>Уведомлений пока нет</p></div>`;
}
function showMyAds(){
  if(!currentUser){openAuthModal();return;}
  const user=window.currentUser||currentUser; const mine=ads.filter(a=>a.owner===user.uid);
  showPage("home");activeCategory="";document.getElementById("feed-title").textContent="Мои объявления";
  document.getElementById("feed-container").innerHTML=mine.length?mine.map(renderCard).join(""):`<div class="empty"><i class="fa-regular fa-file"></i><p>У вас пока нет объявлений</p><small>Нажмите «+», чтобы разместить первое</small></div>`;
}
function updateProfileUI(){
  const user=window.currentUser||currentUser;
  const name=document.getElementById("user-display-name"),phone=document.getElementById("user-display-phone"),auth=document.getElementById("auth-btn-text");
  if(name)name.textContent=user?.displayName||"Гость";
  if(phone)phone.textContent=user?(user.phone||user.email||"Аккаунт"):"Войдите, чтобы размещать объявления";
  if(auth)auth.textContent=user?"Выйти из аккаунта":"Войти / Зарегистрироваться";
  const isAdmin=!!user&&user.role==="admin";
  document.getElementById("admin-panel-item")?.style && (document.getElementById("admin-panel-item").style.display=isAdmin?"flex":"none");
  const at=document.getElementById("admin-toggle-text");if(at)at.textContent=isAdmin?"Выйти из режима Администратора":"Войти как Администратор";
  const su=document.getElementById("stat-users"),sa=document.getElementById("stat-ads"),so=document.getElementById("stat-orders");
  if(su)su.textContent=currentUser?1:0;if(sa)sa.textContent=ads.length;if(so)so.querySelector("h4").textContent=taxiOrders.length;
}
function openAuthModal(){if(currentUser){if(confirm("Выйти из аккаунта?"))logout();return;}openModal("auth-modal");}
function openModal(id){document.getElementById(id)?.classList.add("active");document.body.classList.add("no-scroll");}
function closeModal(id){document.getElementById(id)?.classList.remove("active");if(!document.querySelector(".modal.active"))document.body.classList.remove("no-scroll");}
function demoLogin(){
  currentUser={uid:"demo-user",displayName:"Демо пользователь",phone:"+77001234567",email:"demo@sairam.live",role:"user"};
  window.currentUser=currentUser;saveJSON(STORAGE.user,currentUser);updateProfileUI();closeModal("auth-modal");notify("Вы вошли как демо-пользователь");
}
function logout(){
  window.firebaseLogout?.(); currentUser=null;window.currentUser=null;saveJSON(STORAGE.user,null);updateProfileUI();notify("Вы вышли из аккаунта");showPage("home");
}
function toggleAdminRole(){
  const user=window.currentUser||currentUser;
  if(!user){openAuthModal();return;}
  if(user.role==="admin"){user.role="user";window.currentUser=user;saveJSON(STORAGE.user,user);updateProfileUI();notify("Режим администратора отключен");return;}
  const pass=prompt("Введите пароль администратора (демо):");
  if(pass==="admin123"){user.role="admin";window.currentUser=user;saveJSON(STORAGE.user,user);updateProfileUI();notify("Режим администратора активирован");showPage("admin");}
  else if(pass!==null)notify("Неверный пароль","error");
}

/* ---------- ФОТО ОБЪЯВЛЕНИЙ ---------- */
function openAddModal(){
  const user=window.currentUser||currentUser;
  if(!user){notify("Сначала войдите или используйте демо-вход","error");openAuthModal();return;}
  pendingPhotos=[];
  document.getElementById("ad-title").value="";
  document.getElementById("ad-price").value="";
  document.getElementById("ad-phone").value=user.phone||user.email||"";
  document.getElementById("ad-desc").value="";
  const input=document.getElementById("ad-photos");if(input)input.value="";
  renderPhotoPreview();renderCategories();openModal("add-modal");
}
function renderPhotoPreview(){
  const box=document.getElementById("photo-preview");if(!box)return;
  box.innerHTML=pendingPhotos.map((p,i)=>`<div class="photo-thumb"><img src="${esc(p)}" alt="Фото ${i+1}"><button type="button" onclick="removePendingPhoto(${i})"><i class="fa-solid fa-xmark"></i></button></div>`).join("");
  const count=document.getElementById("photo-count");if(count)count.textContent=`${pendingPhotos.length}/5`;
}
function removePendingPhoto(i){pendingPhotos.splice(i,1);renderPhotoPreview();}
function compressImage(file){
  return new Promise((resolve,reject)=>{
    if(!file.type.startsWith("image/"))return reject(new Error("not-image"));
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const max=1000;let w=img.width,h=img.height;
        if(Math.max(w,h)>max){const k=max/Math.max(w,h);w=Math.round(w*k);h=Math.round(h*k);}
        const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL("image/jpeg",.72));
      };
      img.onerror=reject;img.src=reader.result;
    };
    reader.onerror=reject;reader.readAsDataURL(file);
  });
}
async function handleAdPhotos(event){
  const files=[...event.target.files];
  if(pendingPhotos.length+files.length>5){notify("Можно добавить максимум 5 фото","error");}
  for(const file of files.slice(0,5-pendingPhotos.length)){
    try{pendingPhotos.push(await compressImage(file));renderPhotoPreview();}
    catch(e){notify("Не удалось прочитать фото","error");}
  }
  event.target.value="";
}
function publishAd(){
  const user=window.currentUser||currentUser;if(!user){notify("Требуется вход","error");return;}
  const title=document.getElementById("ad-title").value.trim(),category=document.getElementById("ad-category").value;
  const price=document.getElementById("ad-price").value.trim(),phone=document.getElementById("ad-phone").value.trim()||user.phone||user.email||"";
  const description=document.getElementById("ad-desc").value.trim();
  if(title.length<3)return notify("Введите название объявления","error");
  if(!price)return notify("Укажите цену","error");
  const ad={id:"ad_"+Date.now(),title,category,price,phone,description,location:"Сайрам",icon:iconFor(category),owner:user.uid,createdAt:Date.now(),photos:[...pendingPhotos]};
  ads.unshift(ad);saveJSON(STORAGE.ads,ads);pendingPhotos=[];closeModal("add-modal");renderFeed();updateProfileUI();notify("Объявление опубликовано");showPage("home");
}
function deleteAd(id){
  const ad=ads.find(a=>a.id===id);if(!ad)return;
  if(ad.owner!==(currentUser?.uid))return;
  if(!confirm("Удалить это объявление?"))return;
  ads=ads.filter(a=>a.id!==id);favorites.delete(id);saveJSON(STORAGE.ads,ads);saveJSON(STORAGE.favs,[...favorites]);renderFeed();renderFavorites();updateProfileUI();notify("Объявление удалено");
}
function iconFor(cat){
  return {"Такси":"fa-taxi","Мастера":"fa-screwdriver-wrench","Скот / Агро":"fa-cow","Авто":"fa-car","Жильё":"fa-house","Электроника":"fa-mobile-screen","Одежда":"fa-shirt","Еда":"fa-utensils","Работа":"fa-briefcase"}[cat]||"fa-box";
}

/* ---------- ТАКСИ ---------- */
function taxiRole(role){
  taxiMode=role;
  document.getElementById("taxi-passenger-panel")?.classList.toggle("hidden",role!=="passenger");
  document.getElementById("taxi-driver-panel")?.classList.toggle("hidden",role!=="driver");
  document.getElementById("taxi-role-passenger")?.classList.toggle("active",role==="passenger");
  document.getElementById("taxi-role-driver")?.classList.toggle("active",role==="driver");
  if(role==="driver")TaxiLive?.start("driver");else TaxiLive?.start("passenger");
}
function taxiMoney(n){return `${Math.round(Number(n)||0).toLocaleString("ru-RU")} ₸`;}
function haversine(a,b){
  if(!a||!b)return 99999;const R=6371,rad=Math.PI/180;
  const dLat=(b.lat-a.lat)*rad,dLon=(b.lng-a.lng)*rad;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function sendTaxiOrder(){
  const from=document.getElementById("taxi-from")?.value.trim(),to=document.getElementById("taxi-to")?.value.trim();
  const price=Number(document.getElementById("taxi-price")?.value),phone=document.getElementById("taxi-phone")?.value.trim();
  if(!from||!to||!price||!phone)return notify("Заполните Откуда, Куда, цену и телефон","error");
  const pickup=window.__taxiPickup||null;
  const order={id:"taxi_"+Date.now(),from,to,price,phone,passengerId:currentUser?.uid||"local-"+Date.now(),pickup,status:"searching",createdAt:Date.now(),passengers:Number(document.getElementById("taxi-passengers")?.value||1),distanceKm:Number(document.getElementById("taxi-distance")?.value||0)};
  taxiOrders.unshift(order);saveJSON(STORAGE.orders,taxiOrders);
  if(window.TaxiLive)TaxiLive.create(order);
  else notify("Заявка создана локально");
}
function initMap(){
  if(mapInitialized)return;
  const mapBox=document.getElementById("map");if(!mapBox||typeof L==="undefined")return;
  map=L.map("map").setView([42.3089,69.7592],14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);
  const marker=L.marker([42.3089,69.7592],{draggable:true}).addTo(map);
  marker.bindPopup("Место подачи").openPopup();
  const setPoint=c=>{window.__taxiPickup={lat:c.lat,lng:c.lng};document.getElementById("taxi-from").value=`Точка на карте: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;};
  marker.on("dragend",e=>setPoint(e.target.getLatLng()));
  map.on("click",e=>{marker.setLatLng(e.latlng);setPoint(e.latlng);});
  mapInitialized=true;
}
function useTaxiLocation(){
  if(!navigator.geolocation)return notify("Геолокация не поддерживается","error");
  navigator.geolocation.getCurrentPosition(p=>{
    const c={lat:p.coords.latitude,lng:p.coords.longitude};window.__taxiPickup=c;
    document.getElementById("taxi-from").value="Моё местоположение";
    if(map){map.setView([c.lat,c.lng],15);map.eachLayer(l=>{if(l instanceof L.Marker)l.setLatLng([c.lat,c.lng]);});}
    notify("Местоположение получено");
  },()=>notify("Разрешите геолокацию","error"));
}
function estimateTaxi(){
  const dist=Math.max(1,Number(document.getElementById("taxi-distance")?.value||1));
  const rec=Math.max(300,Math.round(300+dist*70));
  const el=document.getElementById("taxi-recommended");if(el)el.textContent=taxiMoney(rec);
  const p=document.getElementById("taxi-price");if(p&&!p.value)p.value=rec;
}
function updateDriverUI(data){
  const s=document.getElementById("driver-status"),b=document.getElementById("driver-online-btn");
  if(!s||!b)return;
  const online=!!data?.online;s.textContent=online?"🟢 В сети":"⚪ Офлайн";b.textContent=online?"Выйти с линии":"Выйти на линию";b.classList.toggle("active",online);
}
function renderTaxiOrdersForDriver(list){
  const box=document.getElementById("driver-orders");if(!box)return;
  if(!list.length){box.innerHTML=`<div class="empty"><i class="fa-solid fa-taxi"></i><p>Нет заказов рядом</p><small>Когда пассажир создаст заказ, он появится здесь</small></div>`;return;}
  box.innerHTML=list.slice(0,20).map(o=>`<div class="taxi-order-card">
    <div class="taxi-order-top"><b>${esc(o.from)} → ${esc(o.to)}</b><strong>${taxiMoney(o.price||o.currentPrice)}</strong></div>
    <div class="taxi-order-meta"><span><i class="fa-solid fa-user"></i> ${o.passengers||1} пасс.</span><span><i class="fa-solid fa-clock"></i> ${new Date(o.createdAt||Date.now()).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</span></div>
    <div class="taxi-order-actions"><button class="btn-primary" onclick="TaxiLive.accept('${esc(o.id)}')"><i class="fa-solid fa-check"></i> Принять</button><button class="btn-counter-taxi" onclick="TaxiLive.counter('${esc(o.id)}')">Своя цена</button></div>
  </div>`).join("");
}
function renderPassengerOrder(o){
  const box=document.getElementById("passenger-order-status");if(!box)return;
  if(!o){box.innerHTML="";box.classList.add("hidden");return;}
  box.classList.remove("hidden");
  const status={searching:"🔎 Ищем водителя",bidding:"💰 Водитель предложил цену",accepted:"🚕 Водитель едет к вам",arrived:"📍 Водитель на месте",started:"🛣️ Поездка началась",completed:"✅ Поездка завершена",cancelled:"❌ Заказ отменён"}[o.status]||o.status;
  box.innerHTML=`<div class="taxi-status-card"><div class="taxi-status-head"><b>${status}</b><span>${taxiMoney(o.price||o.currentPrice)}</span></div>
    <div class="taxi-status-route">${esc(o.from)} → ${esc(o.to)}</div>
    ${o.driver?`<div class="taxi-driver-found"><i class="fa-solid fa-user-tie"></i><div><b>${esc(o.driver.name||"Водитель")}</b><small>${esc(o.driver.carModel||"Автомобиль")} • ${esc(o.driver.carNumber||"")}</small></div></div>`:""}
    ${o.driverOffer?`<div class="driver-offer"><b>Водитель предлагает ${taxiMoney(o.driverOffer)}</b><button onclick="TaxiLive.acceptOffer('${esc(o.id)}')">Принять</button></div>`:""}
    ${["searching","bidding","accepted","arrived"].includes(o.status)?`<button class="btn-danger-taxi" onclick="TaxiLive.cancel('${esc(o.id)}')">Отменить заказ</button>`:""}
  </div>`;
}

/* simple fallback taxi service; realtime module upgrades it */
const TaxiLive={
  online:false,
  unsub:null,
  async start(role){
    if(role==="passenger")renderPassengerOrder(taxiOrders.find(o=>o.passengerId===(currentUser?.uid||"local")));
    if(window.FirebaseTaxi?.start) return window.FirebaseTaxi.start(role);
    if(role==="driver")renderTaxiOrdersForDriver(taxiOrders.filter(o=>["searching","bidding"].includes(o.status)));
  },
  create(order){
    if(window.FirebaseTaxi?.create)return window.FirebaseTaxi.create(order);
    notify("Заявка отправлена водителям (локальный режим)");
    renderPassengerOrder(order);
  },
  accept(id){return window.FirebaseTaxi?.accept?window.FirebaseTaxi.accept(id):notify("Firebase такси не подключен","error");},
  counter(id){return window.FirebaseTaxi?.counter?window.FirebaseTaxi.counter(id):notify("Firebase такси не подключен","error");},
  acceptOffer(id){return window.FirebaseTaxi?.acceptOffer?window.FirebaseTaxi.acceptOffer(id):notify("Firebase такси не подключен","error");},
  cancel(id){return window.FirebaseTaxi?.cancel?window.FirebaseTaxi.cancel(id):notify("Firebase такси не подключен","error");},
  toggleDriver(){return window.FirebaseTaxi?.toggleDriver?window.FirebaseTaxi.toggleDriver():notify("Firebase такси не подключен","error");},
  updateStatus(id,s){return window.FirebaseTaxi?.updateStatus?window.FirebaseTaxi.updateStatus(id,s):null}
};

function sendBroadcastNotification(){const msg=prompt("Введите текст уведомления:");if(msg?.trim())notify("Рассылка создана: "+msg.trim());}
function exportData(){
  const data={ads,favorites:[...favorites],notifications,taxiOrders,user:currentUser};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="smart-live-backup.json";a.click();URL.revokeObjectURL(url);notify("Резервная копия скачана");
}
function clearDemoData(){
  if(!confirm("Удалить только добавленные вами тестовые объявления?"))return;
  if(currentUser){ads=ads.filter(a=>a.owner!==currentUser.uid);saveJSON(STORAGE.ads,ads);renderFeed();updateProfileUI();notify("Ваши тестовые объявления удалены");}
}

document.getElementById("search-input")?.addEventListener("input",()=>{activeCategory="";renderFeed();});
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id);}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal.active").forEach(m=>closeModal(m.id));});

function boot(){
  window.currentUser=currentUser;
  renderCategories();renderFeed();renderFavorites();renderNotifications();updateProfileUI();
  document.getElementById("taxi-distance")?.addEventListener("input",estimateTaxi);
  if(!notifications.length){notifications=[{id:1,text:"Добро пожаловать в Smart Live!",time:new Date().toLocaleString("ru-RU")}];saveJSON(STORAGE.notifications,notifications);renderNotifications();}
}
window.addEventListener("load",boot);

window.switchView=id=>showPage(String(id).replace(/^view-/,""));
window.filterCategory=selectCategory;window.renderListings=renderFeed;window.orderTaxi=sendTaxiOrder;window.toggleAuth=openAuthModal;
window.taxiRole=taxiRole;window.useTaxiLocation=useTaxiLocation;window.estimateTaxi=estimateTaxi;
window.sendTaxiOrder=sendTaxiOrder;window.openAddModal=openAddModal;window.publishAd=publishAd;window.handleAdPhotos=handleAdPhotos;window.removePendingPhoto=removePendingPhoto;window.deleteAd=deleteAd;

window.renderPassengerOrder=renderPassengerOrder;
window.renderTaxiOrdersForDriver=renderTaxiOrdersForDriver;
window.taxiOrders=taxiOrders;
