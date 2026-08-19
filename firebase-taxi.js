import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getDatabase, ref, set, push, update, onValue, get } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYgfp3qrAzC4wTe6uhMXkdRhmGVMCt0gs",
  authDomain: "smatrlive.firebaseapp.com",
  projectId: "smatrlive",
  storageBucket: "smatrlive.firebasestorage.app",
  messagingSenderId: "42821091789",
  appId: "1:42821091789:web:9596abf558af79d88e4484",
  measurementId: "G-CWBNC3D4TW",
  databaseURL: "https://smatrlive-default-rtdb.firebaseio.com"
};

let db=null,auth=null,role="passenger",unsubscribe=null,driverUnsubscribe=null;
let driver={...JSON.parse(localStorage.getItem("sairam_live_driver_v2")||"{}")};
let online=false;

function getApp(){
  return getApps().length?getApps()[0]:initializeApp(firebaseConfig);
}
function uid(){
  return auth?.currentUser?.uid || null;
}
function toast(m,t="success"){window.notify?.(m,t);}
function money(n){return Math.round(Number(n)||0).toLocaleString("ru-RU")+" ₸";}

try{
  const app=getApp();
  auth=getAuth(app);
  db=getDatabase(app);
}catch(e){
  console.warn("Firebase Realtime Database недоступна:",e);
}

function localUser(){
  return window.currentUser || null;
}
function localId(){
  return localUser()?.uid || null;
}
function validRemoteUser(){return !!uid();}
function stop(){
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  if(driverUnsubscribe){driverUnsubscribe();driverUnsubscribe=null;}
}

async function create(order){
  if(!db || !validRemoteUser()){
    window.renderPassengerOrder?.(order);
    toast("Заказ создан в локальном режиме. Для работы между телефонами войдите через Google.");
    return order.id;
  }
  const r=push(ref(db,"taxiOrders"));
  const remote={
    ...order,
    id:r.key,
    passengerId:uid(),
    currentPrice:Number(order.price)||0,
    status:"searching",
    createdAt:Date.now()
  };
  try{
    await set(r,remote);
    toast("Заявка отправлена ближайшим водителям");
    listenPassenger();
    return r.key;
  }catch(e){
    console.error(e);toast("Не удалось отправить заказ. Проверьте Firebase Database Rules.","error");
    return null;
  }
}

function start(r){
  role=r;stop();
  if(!db || !validRemoteUser()){
    if(r==="driver") window.renderTaxiOrdersForDriver?.((window.taxiOrders||[]).filter(o=>["searching","bidding"].includes(o.status)));
    return;
  }
  if(r==="passenger")listenPassenger();
  if(r==="driver")loadDriver();
}

function listenPassenger(){
  if(!db||!uid())return;
  const all=ref(db,"taxiOrders");
  unsubscribe=onValue(all,s=>{
    const data=s.val()||{};
    const arr=Object.values(data).filter(o=>o.passengerId===uid()).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    window.renderPassengerOrder?.(arr[0]||null);
  },e=>console.warn(e));
}

async function loadDriver(){
  if(!db||!uid())return;
  try{
    const s=await get(ref(db,"drivers/"+uid()));
    if(s.exists()){
      driver={...driver,...s.val()};
      online=!!driver.online;
      localStorage.setItem("sairam_live_driver_v2",JSON.stringify(driver));
      fillDriver();
    }
  }catch(e){console.warn(e);}
  listenDriverOrders();
}
function fillDriver(){
  const n=document.getElementById("driver-name"),c=document.getElementById("driver-car"),num=document.getElementById("driver-number");
  if(n)n.value=driver.name||"";
  if(c)c.value=driver.carModel||"";
  if(num)num.value=driver.carNumber||"";
  updateDriverStatus();
}
function updateDriverStatus(){
  const s=document.getElementById("driver-status"),b=document.getElementById("driver-online-btn");
  if(s)s.textContent=online?"🟢 В сети":"⚪ Офлайн";
  if(b){b.textContent=online?"Выйти с линии":"Выйти на линию";b.classList.toggle("active",online);}
}
async function saveDriver(){
  const name=document.getElementById("driver-name")?.value.trim();
  const carModel=document.getElementById("driver-car")?.value.trim();
  const carNumber=document.getElementById("driver-number")?.value.trim();
  if(!name||!carModel||!carNumber)return toast("Заполните имя, автомобиль и госномер.","error");
  driver={...driver,name,carModel,carNumber,online,updatedAt:Date.now()};
  localStorage.setItem("sairam_live_driver_v2",JSON.stringify(driver));
  if(db&&uid()){
    try{await set(ref(db,"drivers/"+uid()),{...driver,uid:uid()});toast("Профиль водителя сохранён");}
    catch(e){toast("Профиль сохранён на телефоне, но Firebase отклонил запись.","error");}
  }else toast("Профиль сохранён на этом телефоне");
  updateDriverStatus();
}
async function toggleDriver(){
  if(!navigator.geolocation)return toast("Для водителя нужна геолокация.","error");
  navigator.geolocation.getCurrentPosition(async p=>{
    const loc={lat:p.coords.latitude,lng:p.coords.longitude};
    online=!online;
    driver={...driver,...loc,online,updatedAt:Date.now()};
    localStorage.setItem("sairam_live_driver_v2",JSON.stringify(driver));
    if(db&&uid()){
      try{await set(ref(db,"drivers/"+uid()),{...driver,uid:uid()});}catch(e){console.warn(e);}
    }
    updateDriverStatus();
    if(online)toast("Вы вышли на линию. Новые заказы будут появляться здесь.");
    else toast("Вы вышли с линии");
    if(online)listenDriverOrders();
  },()=>toast("Разрешите геолокацию для режима водителя.","error"),{enableHighAccuracy:true});
}
function listenDriverOrders(){
  if(!db||!uid())return;
  if(driverUnsubscribe)driverUnsubscribe();
  driverUnsubscribe=onValue(ref(db,"taxiOrders"),s=>{
    const data=s.val()||{};
    let arr=Object.values(data).filter(o=>["searching","bidding"].includes(o.status));
    arr.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(online)window.renderTaxiOrdersForDriver?.(arr);
    else window.renderTaxiOrdersForDriver?.([]);
  },e=>console.warn(e));
}
async function accept(id){
  if(!db||!uid())return toast("Войдите через Google, чтобы принимать заказы.","error");
  const s=await get(ref(db,"taxiOrders/"+id)),o=s.val();
  if(!o||!["searching","bidding"].includes(o.status))return toast("Заказ уже принят другим водителем.","error");
  const d={id:uid(),name:driver.name,carModel:driver.carModel,carNumber:driver.carNumber};
  if(!d.name||!d.carModel||!d.carNumber)return toast("Сначала сохраните профиль водителя.","error");
  try{
    await update(ref(db,"taxiOrders/"+id),{status:"accepted",driver:d,driverId:uid(),acceptedAt:Date.now(),currentPrice:Number(o.currentPrice||o.price)});
    toast("Заказ принят. Пассажир увидит ваши данные.");
  }catch(e){toast("Не удалось принять заказ.","error");}
}
async function counter(id){
  if(!db||!uid())return toast("Войдите через Google.","error");
  const p=Number(prompt("Введите вашу цену в ₸:"));
  if(!p||p<300)return toast("Минимум 300 ₸","error");
  const s=await get(ref(db,"taxiOrders/"+id)),o=s.val();
  if(!o||!["searching","bidding"].includes(o.status))return toast("Заказ уже занят.","error");
  await update(ref(db,"taxiOrders/"+id),{status:"bidding",driverOffer:p,driverOfferBy:uid(),driverOfferDriver:{id:uid(),name:driver.name,carModel:driver.carModel,carNumber:driver.carNumber}});
  toast("Ваша цена отправлена пассажиру.");
}
async function acceptOffer(id){
  if(!db||!uid())return;
  const s=await get(ref(db,"taxiOrders/"+id)),o=s.val();
  if(!o?.driverOffer)return;
  await update(ref(db,"taxiOrders/"+id),{status:"accepted",currentPrice:o.driverOffer,driverId:o.driverOfferBy||null,driver:o.driverOfferDriver||null,acceptedAt:Date.now()});
  toast("Цена принята. Водитель едет к вам.");
}
async function cancel(id){
  if(!db||!uid())return;
  await update(ref(db,"taxiOrders/"+id),{status:"cancelled",cancelledAt:Date.now()});
  toast("Заказ отменён.");
}
async function updateStatus(id,status){
  if(!db||!uid())return;
  const allowed=["arrived","started","completed"];
  if(!allowed.includes(status))return;
  await update(ref(db,"taxiOrders/"+id),{status,[status+"At"]:Date.now()});
  toast(status==="arrived"?"Пассажир уведомлён: вы на месте":status==="started"?"Поездка началась":"Поездка завершена");
}

window.FirebaseTaxi={start,create,saveDriver,toggleDriver,accept,counter,acceptOffer,cancel,updateStatus};
window.TaxiLive={start,create,accept,counter,acceptOffer,cancel,toggleDriver,updateStatus};
