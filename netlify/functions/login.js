const crypto = require("crypto");
exports.handler = async (event) => {
  const headers = {"Content-Type":"application/json","Access-Control-Allow-Origin":process.env.ADMIN_ORIGIN||"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"POST, OPTIONS"};
  if(event.httpMethod==="OPTIONS") return {statusCode:204,headers,body:""};
  if(event.httpMethod!=="POST") return {statusCode:405,headers,body:JSON.stringify({error:"Method not allowed"})};
  let body={}; try{body=JSON.parse(event.body||"{}")}catch{}
  const password=process.env.ADMIN_PASSWORD, secret=process.env.SESSION_SECRET;
  if(!password||!secret) return {statusCode:500,headers,body:JSON.stringify({error:"Admin environment variables are not configured."})};
  if(!body.password || !crypto.timingSafeEqual(Buffer.from(String(body.password).padEnd(password.length,"\0").slice(0,password.length)),Buffer.from(String(password)))) return {statusCode:401,headers,body:JSON.stringify({error:"Incorrect password"})};
  const expires=Date.now()+8*60*60*1000, payload=Buffer.from(JSON.stringify({exp:expires})).toString("base64url");
  const sig=crypto.createHmac("sha256",secret).update(payload).digest("base64url");
  return {statusCode:200,headers,body:JSON.stringify({token:`${payload}.${sig}`,expires})};
};