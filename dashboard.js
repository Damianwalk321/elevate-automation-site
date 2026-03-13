const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";
const DASHBOARD_API = "https://teixblbxkoershwgqpym.supabase.co/functions/v1/get-dashboard-data";

async function fetchDashboard(email){

const response = await fetch(DASHBOARD_API,{
method:"POST",
headers:{
"Content-Type":"application/json",
"apikey":SUPABASE_ANON_KEY,
"Authorization":`Bearer ${SUPABASE_ANON_KEY}`
},
body:JSON.stringify({email})
});

const data = await response.json();

if(!response.ok){
throw new Error(data.error || "Dashboard load failed");
}

return data;

}

function setText(id,value){
const el=document.getElementById(id);
if(el) el.textContent=value ?? "—";
}

function setStatus(msg,type=""){
const el=document.getElementById("dashboard-status");
if(!el) return;
el.className=`feedback-status ${type}`;
el.textContent=msg;
}

function setCopyStatus(msg,type=""){
const el=document.getElementById("copy-referral-status");
if(!el) return;
el.className=`feedback-status ${type}`;
el.textContent=msg;
}

document.addEventListener("DOMContentLoaded",()=>{

const form=document.getElementById("dashboard-lookup-form");
const content=document.getElementById("dashboard-content");
const copyBtn=document.getElementById("copy-referral-btn");

let referralLink="";

if(copyBtn){

copyBtn.addEventListener("click",async()=>{

if(!referralLink){
setCopyStatus("No referral link");
return;
}

try{
await navigator.clipboard.writeText(referralLink);
setCopyStatus("Referral link copied","success");
}catch(err){
setCopyStatus("Copy failed","error");
}

});

}

form.addEventListener("submit",async(e)=>{

e.preventDefault();

try{

setStatus("Loading dashboard...");
content.classList.add("hidden");

const email=document.getElementById("lookup-email").value.trim();

if(!email){
setStatus("Enter an email","error");
return;
}

const data=await fetchDashboard(email);

if(!data.found){
setStatus("Account not found","error");
return;
}

const user=data.user||{};
const sub=data.subscription||{};
const lic=data.license||{};
const limits=data.posting_limits||{};
const ref=data.referral||{};

setText("dash-name",`${user.first_name||""} ${user.last_name||""}`);
setText("dash-email",user.email);
setText("dash-company",user.company);
setText("dash-province",user.province);

setText("dash-plan",sub.plan_type||lic.plan_type);
setText("dash-subscription-status",sub.subscription_status);
setText("dash-billing-status",sub.billing_status);

setText("dash-license-key",lic.license_key);
setText("dash-access-type",lic.access_type);
setText("dash-license-status",lic.status);

setText("dash-daily-limit",limits.daily_limit);
setText("dash-weekly-limit",limits.weekly_limit);
setText("dash-cooldown",limits.cooldown_minutes?limits.cooldown_minutes+" min":null);

setText("dash-posts-today",limits.posts_today);
setText("dash-posts-week",limits.posts_this_week);
setText("dash-remaining-today",limits.remaining_today);
setText("dash-remaining-week",limits.remaining_week);

setText("dash-referral-code",ref.referral_code);
setText("dash-referral-eligible",ref.is_commission_eligible?"Yes":"No");
setText("dash-referral-link",ref.referral_link);

referralLink=ref.referral_link||"";

content.classList.remove("hidden");
setStatus("Dashboard loaded","success");

}catch(err){

console.error(err);
setStatus("Dashboard load failed","error");

}

});

});
