const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static('public'));
const questions = {
  'ریاضی': [
    {q:'حاصل ۷ × ۸ چند است؟',o:['۵۴','۵۶','۶۴','۴۸'],a:1},
    {q:'اگر x + 5 = 12 باشد، x چند است؟',o:['۵','۶','۷','۸'],a:2},
    {q:'مساحت مربع با ضلع ۶ چقدر است؟',o:['۱۲','۲۴','۳۶','۴۲'],a:2},
    {q:'نصف ۹۰ چند است؟',o:['۳۰','۴۰','۴۵','۵۰'],a:2}
  ],
  'علوم': [
    {q:'کدام سیاره به خورشید نزدیک‌تر است؟',o:['زمین','مریخ','زهره','عطارد'],a:3},
    {q:'آب در فشار معمولی در چند درجه سانتی‌گراد می‌جوشد؟',o:['۰','۵۰','۱۰۰','۲۰۰'],a:2},
    {q:'گیاهان بیشتر کدام گاز را برای فتوسنتز مصرف می‌کنند؟',o:['اکسیژن','دی‌اکسید کربن','هیدروژن','نیتروژن'],a:1},
    {q:'قلب انسان چند حفره اصلی دارد؟',o:['۲','۳','۴','۵'],a:2}
  ],
  'فارسی': [
    {q:'کدام گزینه اسم است؟',o:['دویدن','کتاب','زیبا','رفت'],a:1},
    {q:'مترادف «شاد» کدام است؟',o:['غمگین','خوشحال','خسته','آرام'],a:1},
    {q:'کدام واژه جمع است؟',o:['دانش‌آموزان','مدرسه','کتاب','معلم'],a:0},
    {q:'شاعر شاهنامه کیست؟',o:['حافظ','سعدی','فردوسی','مولانا'],a:2}
  ],
  'اطلاعات عمومی': [
    {q:'پایتخت ایران کدام است؟',o:['تبریز','تهران','شیراز','اصفهان'],a:1},
    {q:'بزرگ‌ترین اقیانوس جهان کدام است؟',o:['اطلس','هند','آرام','منجمد شمالی'],a:2},
    {q:'چند روز در یک هفته وجود دارد؟',o:['۵','۶','۷','۸'],a:2},
    {q:'کدام رنگ از ترکیب آبی و زرد به دست می‌آید؟',o:['سبز','بنفش','نارنجی','قرمز'],a:0}
  ]
};
const rooms = new Map();
function makeCode(){let c;do c=crypto.randomBytes(3).toString('hex').toUpperCase();while(rooms.has(c));return c;}
function state(r){return {code:r.code,subject:r.subject,started:r.started,finished:r.finished,qi:r.qi,total:r.questions.length,question:r.started&&!r.finished?r.questions[r.qi].q:'',options:r.started&&!r.finished?r.questions[r.qi].o:[],players:[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,answered:p.answered}))};}
function broadcast(r){io.to(r.code).emit('state',state(r));}
function advance(r){r.qi++;for(const p of r.players.values())p.answered=false;if(r.qi>=r.questions.length){r.finished=true;r.started=false;}broadcast(r);}
app.get('/health',(_,res)=>res.json({ok:true}));
io.on('connection',socket=>{
 socket.on('createRoom',({name,subject},cb)=>{name=String(name||'').trim().slice(0,30);subject=questions[subject]?subject:'اطلاعات عمومی';if(!name)return cb?.({ok:false,error:'نام خود را وارد کنید.'});const code=makeCode();const r={code,subject,questions:[...questions[subject]],qi:0,started:false,finished:false,players:new Map(),hostId:socket.id};rooms.set(code,r);r.players.set(socket.id,{id:socket.id,name,score:0,answered:false});socket.join(code);socket.data.room=code;cb?.({ok:true,code});broadcast(r);});
 socket.on('joinRoom',({code,name},cb)=>{code=String(code||'').trim().toUpperCase();name=String(name||'').trim().slice(0,30);const r=rooms.get(code);if(!r)return cb?.({ok:false,error:'اتاق پیدا نشد.'});if(r.started)return cb?.({ok:false,error:'مسابقه شروع شده است.'});if(!name)return cb?.({ok:false,error:'نام خود را وارد کنید.'});if(r.players.size>=20)return cb?.({ok:false,error:'ظرفیت اتاق کامل است.'});r.players.set(socket.id,{id:socket.id,name,score:0,answered:false});socket.join(code);socket.data.room=code;cb?.({ok:true,code});broadcast(r);});
 socket.on('start',({code})=>{const r=rooms.get(code);if(!r||r.hostId!==socket.id||!r.players.size)return;r.started=true;r.finished=false;r.qi=0;for(const p of r.players.values()){p.score=0;p.answered=false;}broadcast(r);});
 socket.on('answer',({code,index})=>{const r=rooms.get(code),p=r?.players.get(socket.id);if(!r||!p||!r.started||r.finished||p.answered)return;const q=r.questions[r.qi];p.answered=true;if(Number(index)===q.a)p.score+=10;const all=[...r.players.values()].every(x=>x.answered);if(all)setTimeout(()=>{if(rooms.get(code)===r&&r.started&&!r.finished)advance(r);},700);else broadcast(r);});
 socket.on('disconnect',()=>{const code=socket.data.room,r=rooms.get(code);if(!r)return;r.players.delete(socket.id);if(r.hostId===socket.id){const next=r.players.values().next().value;r.hostId=next?.id||null;}if(!r.players.size)rooms.delete(code);else broadcast(r);});
});
server.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
