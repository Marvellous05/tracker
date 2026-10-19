const crypto=require("node:crypto");
const {getStore}=require("@netlify/blobs");
function reply(statusCode,body){return {statusCode,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(body)}}
function authorized(event){try{const secret=process.env.SESSION_SECRET;if(!secret)return false;const h=event.headers.authorization||event.headers.Authorization||"";const token=h.replace(/^Bearer\s+/i,"");const [payload,sig]=token.split(".");if(!payload||!sig)return false;const expected=crypto.createHmac("sha256",secret).update(payload).digest("base64url");const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;const data=JSON.parse(Buffer.from(payload,"base64url").toString());return data.role==="admin"&&data.exp>Date.now()}catch{return false}}
async function readAll(store){return await store.get("shipments",{type:"json"})||[]}
exports.handler=async(event)=>{
 const store=getStore("globaltrack-shipments");
 if(event.httpMethod==="GET"){
   const id=event.queryStringParameters?.id;
   if(id){const all=await readAll(store);const s=all.find(x=>x.id===id);if(!s||s.visibility==="private")return reply(404,{error:"Not found"});return reply(200,{shipment:publicRecord(s)})}
   const all=await readAll(store);const visible=authorized(event)?all:all.filter(s=>s.visibility!=="private");return reply(200,{shipments:visible.map(publicRecord)})
 }
 if(!authorized(event))return reply(401,{error:"Unauthorized"});
 if(event.httpMethod==="POST"){
   let s;try{s=JSON.parse(event.body||"{}")}catch{return reply(400,{error:"Invalid JSON"})}
   if(!s.id||!s.tracking||!s.start||!s.end||!Number.isFinite(Number(s.durationDays))||Number(s.durationDays)<=0||!s.startAt)return reply(400,{error:"Missing or invalid shipment fields"});
   const all=await readAll(store);if(all.some(x=>x.tracking===s.tracking&&x.id!==s.id))return reply(409,{error:"Tracking number already exists"});
   const i=all.findIndex(x=>x.id===s.id);if(i>=0)all[i]=s;else all.unshift(s);await store.setJSON("shipments",all);return reply(200,{shipment:s});
 }
 if(event.httpMethod==="DELETE"){
   const id=event.queryStringParameters?.id;if(!id)return reply(400,{error:"Missing id"});const all=await readAll(store);await store.setJSON("shipments",all.filter(x=>x.id!==id));return reply(200,{ok:true});
 }
 return reply(405,{error:"Method not allowed"});
};
function publicRecord(s){const {id,name,tracking,start,end,startCoords,endCoords,startLabel,endLabel,mode,durationDays,startAt,visibility,note,createdAt}=s;return {id,name,tracking,start,end,startCoords,endCoords,startLabel,endLabel,mode,durationDays,startAt,visibility,note,createdAt}}
