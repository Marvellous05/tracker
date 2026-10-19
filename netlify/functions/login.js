const crypto = require("node:crypto");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405,{error:"Method not allowed"});
  let body; try { body=JSON.parse(event.body||"{}"); } catch { return reply(400,{error:"Invalid JSON"}); }
  const password=process.env.ADMIN_PASSWORD;
  const secret=process.env.SESSION_SECRET;
  if(!password||!secret) return reply(503,{error:"Set ADMIN_PASSWORD and SESSION_SECRET in Netlify environment variables."});
  const a=Buffer.from(String(body.password||"")); const b=Buffer.from(password);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return reply(401,{error:"Incorrect password"});
  const exp=Date.now()+12*60*60*1000;
  const payload=Buffer.from(JSON.stringify({exp,role:"admin"})).toString("base64url");
  const sig=crypto.createHmac("sha256",secret).update(payload).digest("base64url");
  return reply(200,{token:payload+"."+sig});
};
function reply(statusCode,body){return {statusCode,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(body)};}
