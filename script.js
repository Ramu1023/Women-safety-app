// ==== CONFIG ====
const SUPABASE_URL = "https://cubnpddinqtubsptdipi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Ym5wZGRpbnF0dWJzcHRkaXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NDA2MDMsImV4cCI6MjA3MTQxNjYwM30.Gy4XS-Br-DO8nl4Wq_qHhp2A9gd38raRvTokuqdfKqo";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==== UTIL ====
const $ = (s) => document.querySelector(s);
const $all = (s) => document.querySelectorAll(s);

function showBanner(msg, type="info") {
  const b = $("#banner");
  b.textContent = msg;
  b.classList.remove("hidden");
  b.style.background = type==="error"?"#c0392b":(type==="success"?"#2ecc71":"#222");
  setTimeout(()=>b.classList.add("hidden"),3000);
}
function showPage(id) {
  $all(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ==== NAV ====
$all(".nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>showPage(btn.dataset.page));
});

// ==== BOOT ====
document.addEventListener("DOMContentLoaded",()=>{
  const uid = localStorage.getItem("userId");
  if(uid){ gotoApp(uid); } else { showPage("setup-page"); }
});

// ==== SETUP ====
$("#setup-ok-btn").addEventListener("click", async ()=>{
  const name=$("#setup-name").value.trim();
  const age=$("#setup-age").value.trim();
  const gender=$("#setup-gender").value;
  if(!name||!age){ alert("Fill all fields"); return; }

  const {data:user,error:uErr} = await sb.from("users")
    .insert([{name,age:Number(age),gender}]).select().single();
  if(uErr){ console.error(uErr); showBanner("User creation failed","error"); return; }

  const {error:sErr} = await sb.from("device_status").insert([{id:user.id}]);
  if(sErr){ console.error(sErr); showBanner("Device status insert failed","error"); return; }

  localStorage.setItem("userId",user.id);
  gotoApp(user.id);
  showBanner("Setup complete","success");
});

function gotoApp(uid){
  $("#setup-page").classList.remove("active");
  $("#app-container").classList.remove("hidden");
  showPage("home-page");
  startPolling(uid);
  loadSettings(uid);
}

// ==== POLLING ====
let timer=null;
function startPolling(uid){
  fetchData(uid);
  clearInterval(timer);
  timer=setInterval(()=>fetchData(uid),5000);
}
async function fetchData(uid){
  const {data,error}=await sb.from("device_status").select("*").eq("id",uid).single();
  if(error){console.error(error);return;}
  $("#emergency-status").textContent=data.emergency_on?"ON":"OFF";
  $("#emergency-status").className=data.emergency_on?"on":"";
  $("#pin27-status").textContent=data.pin_27_on?"ON":"OFF";
  $("#pin28-status").textContent=data.pin_28_on?"ON":"OFF";
  $("#watch-battery-status").textContent=${data.watch_battery??"--"}%;
  $("#shoe-battery-status").textContent=${data.shoe_battery??"--"}%;
  if(data.latitude&&data.longitude){
    $("#map").innerHTML=<iframe width="100%" height="100%" src="https://www.google.com/maps/embed/v1/place?key=YOUR_GOOGLE_MAPS_KEY&q=${data.latitude},${data.longitude}"></iframe>;
    $("#lat-display").textContent=data.latitude;
    $("#lon-display").textContent=data.longitude;
  }
}

// ==== SOS ====
$("#sos-btn").addEventListener("click",async()=>{
  const uid=localStorage.getItem("userId");
  const {data}=await sb.from("device_status").select("emergency_on").eq("id",uid).single();
  const newStatus=!data.emergency_on;
  await sb.from("device_status").update({emergency_on:newStatus,pin_27_on:newStatus,pin_28_on:newStatus}).eq("id",uid);
  showBanner(Emergency ${newStatus?"ON":"OFF"},"success");
  fetchData(uid);
});

// ==== SETTINGS ====
async function loadSettings(uid){
  const {data:user}=await sb.from("users").select("name,age").eq("id",uid).single();
  if(user){ $("#setting-name").value=user.name; $("#setting-age").value=user.age; }
  loadContacts(uid); loadCycle(uid);
}
$("#save-profile-btn").addEventListener("click",async()=>{
  const uid=localStorage.getItem("userId");
  const name=$("#setting-name").value, age=$("#setting-age").value;
  await sb.from("users").update({name,age:Number(age)}).eq("id",uid);
  showBanner("Profile updated","success");
});
$("#add-contact-btn").addEventListener("click",async()=>{
  const uid=localStorage.getItem("userId");
  const contact_name=$("#contact-name").value, phone_number=$("#contact-phone").value;
  if(!contact_name||!phone_number)return;
  await sb.from("contacts").insert([{user_id:uid,contact_name,phone_number}]);
  $("#contact-name").value="";$("#contact-phone").value="";
  loadContacts(uid);
});
async function loadContacts(uid){
  const {data}=await sb.from("contacts").select("*").eq("user_id",uid);
  const list=$("#contacts-list"); list.innerHTML="";
  data?.forEach(c=>{
    const div=document.createElement("div"); div.textContent=${c.contact_name} — ${c.phone_number};
    list.appendChild(div);
  });
}
$("#save-period-btn").addEventListener("click",async()=>{
  const uid=localStorage.getItem("userId");
  const start_date=$("#period-date").value, notes=$("#period-notes").value;
  await sb.from("menstrual_cycle").insert([{user_id:uid,start_date,notes}]);
  loadCycle(uid);
});
async function loadCycle(uid){
  const {data}=await sb.from("menstrual_cycle").select("start_date").eq("user_id",uid).order("start_date",{ascending:false}).limit(1).maybeSingle();
  if(!data){$("#menstrual-status").textContent="No data";return;}
  const last=new Date(data.start_date), next=new Date(last.getTime()+28*24*60*60*1000);
  $("#menstrual-status").textContent=Last: ${last.toDateString()} • Next: ${next.toDateString()};
}
