const crypto=require("crypto");
const {getStore}=require("@netlify/blobs");
function headers(){return {"Content-Type":"application/json","Access-Control-Allow-Origin":process.env.ADMIN_ORIGIN||"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS"}}
function response(status,body){return {statusCode:status,headers:headers(),body:JSON.stringify(body)}}
function validToken(token,secret){try{const [payload,sig]=token.split(".");const expected=crypto.createHmac("sha256",secret).update(payload).digest("base64url");if(sig!==expected)return false;return JSON.parse(Buffer.from(payload,"base64url").toString()).exp>Date.now()}catch{return false}}
exports.handler=async(event)=>{
 if(event.httpMethod==="OPTIONS")return {statusCode:204,headers:headers(),body:""};
 const store=getStore("globaltrack-shipments");
 const q=event.queryStringParameters||{};
 try{
  if(event.httpMethod==="GET"){
   const key=q.trackingNumber;
   if(key){const shipment=await store.get(key.toUpperCase(),{type:"json"});return shipment?response(200,{shipment}):response(404,{error:"Shipment not found"})}
   const auth=(event.headers.authorization||event.headers.Authorization||"").replace(/^Bearer\s+/i,"");
   if(!process.env.SESSION_SECRET||!validToken(auth,process.env.SESSION_SECRET))return response(401,{error:"Please sign in again."});
   const {blobs}=await store.list();const shipments=[];for(const b of blobs){const s=await store.get(b.key,{type:"json"});if(s)shipments.push(s)}shipments.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));return response(200,{shipments});
  }
  const auth=(event.headers.authorization||event.headers.Authorization||"").replace(/^Bearer\s+/i,"");
  if(!process.env.SESSION_SECRET||!validToken(auth,process.env.SESSION_SECRET))return response(401,{error:"Admin access required."});
  if(event.httpMethod==="POST"){const body=JSON.parse(event.body||"{}"),s=body.shipment;if(!s||!s.trackingNumber||!s.origin||!s.destination||!Array.isArray(s.legs)||!s.legs.length)return response(400,{error:"Shipment details and at least one stage are required."});s.trackingNumber=String(s.trackingNumber).toUpperCase().replace(/[^A-Z0-9-]/g,"");await store.setJSON(s.trackingNumber,s);return response(200,{shipment:s})}
  if(event.httpMethod==="DELETE"){if(!q.trackingNumber)return response(400,{error:"Tracking number required."});await store.delete(q.trackingNumber.toUpperCase());return response(200,{ok:true})}
  return response(405,{error:"Method not allowed"});
 }catch(e){return response(500,{error:"Server error. Check Netlify function logs."})}
};