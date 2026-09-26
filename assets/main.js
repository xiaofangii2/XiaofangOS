(function(){
'use strict';
const HOME='/home/';
const UBUNTU='/Ubuntu/';
const DESKTOP='/Ubuntu/root/Desktop/';
const RECYCLE='/recycle-bin/';
const BG_DIR='/.config/background/';
const APP_DIR='/Ubuntu/mnt/data/';
const BOOT_COOKIE='xiaofang_booted';
const bootScreen=document.getElementById('bootScreen');
const bootText=document.getElementById('bootText');
const bootSpinner=document.getElementById('bootSpinner');
const desktop=document.getElementById('desktop');
const windowsLayer=document.getElementById('windowsLayer');
const taskbarCenter=document.getElementById('taskbarCenter');
const startMenu=document.getElementById('startMenu');
const startBtn=document.getElementById('startBtn');
const powerEntry=document.getElementById('powerEntry');
const powerSubmenu=document.getElementById('powerSubmenu');
const desktopIcons=document.getElementById('desktopIcons');
const ctxMenu=document.getElementById('ctxMenu');
const dialogOverlay=document.getElementById('dialogOverlay');
const dialogTitle=document.getElementById('dialogTitle');
const dialogBody=document.getElementById('dialogBody');
const dialogFooter=document.getElementById('dialogFooter');
const toastEl=document.getElementById('toast');
let windowZIndex=200;
const windows=new Map();
let nextWindowId=1;
const installedApps=[];
const appConfig={pc:{title:'此电脑',icon:'pc',path:DESKTOP,root:UBUNTU},recycle:{title:'回收站',icon:'recycle',path:RECYCLE,root:RECYCLE}};
function getCookie(name){
const match=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/([.*+?^${}()|[\]\\])/g,'\\$1')+'=([^;]*)'));
return match?decodeURIComponent(match[1]):null;
}
function setCookie(name,value,days){
let expires='';
if(days){const d=new Date();d.setTime(d.getTime()+days*24*60*60*1000);expires='; expires='+d.toUTCString()}
document.cookie=name+'='+encodeURIComponent(value)+expires+'; path=/';
}
function deleteCookie(name){document.cookie=name+'=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'}
function toast(msg,dur){
toastEl.textContent=msg;
toastEl.classList.add('show');
clearTimeout(toastEl._t);
toastEl._t=setTimeout(function(){toastEl.classList.remove('show')},dur||2000);
}
function closeDialog(){dialogOverlay.classList.remove('open');dialogBody.innerHTML='';dialogFooter.innerHTML=''}
function showDialog(opts){
dialogTitle.textContent=opts.title||'提示';
dialogBody.innerHTML='';
if(opts.message){const p=document.createElement('p');p.textContent=opts.message;dialogBody.appendChild(p)}
if(opts.input!==undefined){
const inp=document.createElement('input');
inp.type='text';inp.value=opts.input;inp.id='dialogInput';
dialogBody.appendChild(inp);
setTimeout(function(){inp.focus();inp.select()},50);
}
dialogFooter.innerHTML='';
(opts.buttons||[{text:'确定',primary:true}]).forEach(function(b){
const btn=document.createElement('button');
btn.className='dialog-btn'+(b.primary?' primary':'')+(b.danger?' danger':'');
btn.textContent=b.text;
btn.addEventListener('click',function(){
const inp=document.getElementById('dialogInput');
if(b.onClick)b.onClick(inp?inp.value:null);else closeDialog();
});
dialogFooter.appendChild(btn);
});
dialogOverlay.classList.add('open');
}
function api(action,data){
return fetch('/api.php?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(r){return r.json()});
}
function loadWallpaper(){
const exts=['jpg','png','svg','xml','webp'];
let tried=0;
function tryNext(){
if(tried>=exts.length)return;
const url=BG_DIR+'wallpaper.'+exts[tried++];
const img=new Image();
img.onload=function(){desktop.style.backgroundImage="url('"+url+"')"};
img.onerror=tryNext;
img.src=url;
}
tryNext();
}
function runBootSequence(callback){
const booted=getCookie(BOOT_COOKIE);
if(booted==='restarted'){
bootSpinner.classList.add('show');
bootText.textContent='正在重启...';
setTimeout(function(){
bootText.textContent='XiaofangOS';
bootSpinner.classList.remove('show');
setTimeout(function(){setCookie(BOOT_COOKIE,'yes',365);finishBoot(callback)},1200);
},1000);
}else{
bootText.textContent='XiaofangOS';
setTimeout(function(){setCookie(BOOT_COOKIE,'yes',365);finishBoot(callback)},2600);
}
}
function finishBoot(callback){
loadWallpaper();
bootScreen.classList.add('hide');
desktop.classList.add('show');
setTimeout(function(){bootScreen.style.display='none';if(callback)callback()},700);
}
function detectType(name,isDir){
if(isDir)return 'folder';
const ext=(name.split('.').pop()||'').toLowerCase();
if(ext==='xfapp')return 'xfapp';
if(['txt','md','log','ini','json','xml','html','htm','css','js','conf'].includes(ext))return 'txt';
if(ext==='jar')return 'jar';
if(ext==='java')return 'java';
if(['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext))return 'img';
if(['zip','rar','7z','tar','gz'].includes(ext))return 'zip';
if(ext==='apk')return 'apk';
if(['mp3','mp4','wav','avi','mkv','flac','ogg'].includes(ext))return 'media';
return 'file';
}
function readDir(path){
return new Promise(function(resolve,reject){
let rel=path.replace(/^\//,'');
if(rel.endsWith('/'))rel=rel.slice(0,-1);
fetch('/api.php?action=list&path='+encodeURIComponent(rel)+'&_t='+Date.now()).then(function(r){return r.json()}).then(function(d){
if(!d.ok){reject(new Error(d.error||'read fail'));return}
resolve(d.items.map(function(it){return {name:it.name,isDir:it.isDir}}));
}).catch(function(e){reject(e)});
});
}
function readBinary(path){
return new Promise(function(resolve,reject){
let rel=path.replace(/^\//,'');
const parts=rel.split('/').map(function(s){return encodeURIComponent(s)}).join('/');
fetch('/'+parts+'?_t='+Date.now()).then(function(r){
if(!r.ok){reject(new Error('HTTP '+r.status));return}
return r.arrayBuffer();
}).then(resolve).catch(reject);
});
}
function parseConf(text){
const result={author:'',id:'',version:'',introduce:''};
text.split(/\r?\n/).forEach(function(line){
const idx=line.indexOf(':');
if(idx>0){
const key=line.slice(0,idx).trim().toLowerCase();
const val=line.slice(idx+1).trim();
if(key in result)result[key]=val;
}
});
return result;
}
function scanApps(){
return readDir(APP_DIR).then(function(items){
const xfapps=items.filter(function(f){return !f.isDir&&f.name.toLowerCase().endsWith('.xfapp')});
const promises=xfapps.map(function(f){return loadApp(f.name)});
return Promise.all(promises).then(function(results){return results.filter(function(r){return r!==null})});
}).catch(function(err){console.warn('扫描失败',err);return []});
}
function loadApp(filename){
return readBinary(APP_DIR+filename).then(function(buf){return JSZip.loadAsync(buf)}).then(function(zip){
const confFile=zip.file('XiaofangOS.conf');
const iconFile=zip.file('icon.png');
const htmlFile=zip.file('webui/index.html');
if(!confFile||!htmlFile)return null;
return Promise.all([confFile.async('string'),iconFile?iconFile.async('base64'):Promise.resolve(null),htmlFile.async('string')]).then(function(results){
const conf=parseConf(results[0]);
if(!conf.id)return null;
const iconUrl=results[1]?'data:image/png;base64,'+results[1]:null;
return {file:filename,id:conf.id,name:conf.id,author:conf.author,version:conf.version,introduce:conf.introduce,icon:iconUrl,htmlContent:results[2]};
});
}).catch(function(err){console.warn('解析 '+filename+' 失败',err);return null});
}
function refreshApps(){
scanApps().then(function(apps){
installedApps.length=0;
apps.forEach(function(a){
const dup=installedApps.some(function(x){return x.id===a.id});
if(!dup)installedApps.push(a);
});
renderAppIcons();
});
}
function renderAppIcons(){
installedApps.sort(function(a,b){return a.id.localeCompare(b.id)});
const old=desktopIcons.querySelectorAll('.icon[data-app-icon]');
old.forEach(function(el){el.remove()});
installedApps.forEach(function(app){
const icon=document.createElement('div');
icon.className='icon';
icon.setAttribute('data-app-icon','1');
const g=document.createElement('div');
g.className='icon-graphic';
if(app.icon){
const img=document.createElement('img');img.src=app.icon;g.appendChild(img);
}else{
g.innerHTML='<div style="width:40px;height:40px;background:linear-gradient(135deg,#6ab0e0,#2c6a9c);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700">'+app.name.charAt(0).toUpperCase()+'</div>';
}
const label=document.createElement('div');
label.className='icon-label';label.textContent=app.name;
icon.appendChild(g);icon.appendChild(label);
let timer=null,lastTap=0;
function doOpen(){openAppWindow(app)}
icon.addEventListener('dblclick',function(e){e.preventDefault();if(timer){clearTimeout(timer);timer=null}doOpen()});
icon.addEventListener('click',function(){
if(timer){clearTimeout(timer);timer=null;return}
timer=setTimeout(function(){doOpen();timer=null},250);
});
icon.addEventListener('touchend',function(e){
e.preventDefault();
const now=Date.now();
if(now-lastTap<300){if(timer){clearTimeout(timer);timer=null}doOpen();lastTap=0}
else{lastTap=now;timer=setTimeout(function(){doOpen();timer=null},250)}
},{passive:false});
icon.addEventListener('contextmenu',function(e){
e.preventDefault();e.stopPropagation();
showContextMenu(e.clientX,e.clientY,[
{text:'打开',onClick:function(){openAppWindow(app)}},
{sep:true},
{text:'卸载',danger:true,onClick:function(){
showDialog({title:'卸载应用',message:'确定要删除 "'+app.name+'" 吗？',buttons:[
{text:'取消',onClick:closeDialog},
{text:'卸载',danger:true,onClick:function(){
closeDialog();
api('delete',{target:'Ubuntu/mnt/data/'+app.file}).then(function(r){
if(r.ok){toast('已卸载');refreshApps()}
else{toast('失败：'+(r.error||''))}
});
}}
]});
}}
]);
});
desktopIcons.appendChild(icon);
});
}
function renderDesktopIcons(){
readDir(HOME).then(function(items){
items.sort(function(a,b){if(a.isDir!==b.isDir)return a.isDir?-1:1;return a.name.localeCompare(b.name)});
const old=desktopIcons.querySelectorAll('.icon[data-from-home]');
old.forEach(function(el){el.remove()});
items.forEach(function(f){
const icon=document.createElement('div');
icon.className='icon';
icon.setAttribute('data-from-home','1');
const g=document.createElement('div');
g.className='icon-graphic';
if(f.isDir){
g.innerHTML='<div style="width:44px;height:34px;background:linear-gradient(180deg,#ffd980,#e0a83a);border-radius:4px;position:absolute;top:8px;left:2px"></div><div style="width:20px;height:8px;background:#ffd980;border-radius:4px 4px 0 0;position:absolute;top:3px;left:6px"></div>';
}else{
const type=detectType(f.name,false);
if(type==='xfapp'){
g.innerHTML='<div style="width:32px;height:40px;background:#e8d4f0;border:2px solid #8a5aa8;border-radius:3px 8px 3px 3px;position:absolute;top:4px;left:8px"></div><div style="position:absolute;top:14px;left:12px;font-size:16px;font-weight:900;color:#8a5aa8;font-family:Georgia">X</div>';
}else{
g.innerHTML='<div style="width:32px;height:40px;background:#f8fafd;border:2px solid #8aa2ba;border-radius:3px 8px 3px 3px;position:absolute;top:4px;left:8px"></div><div style="position:absolute;top:12px;left:13px;width:18px;height:2px;background:#a0b4c8;box-shadow:0 6px 0 #a0b4c8,0 12px 0 #a0b4c8"></div>';
}
}
const label=document.createElement('div');
label.className='icon-label';label.textContent=f.name;
icon.appendChild(g);icon.appendChild(label);
let timer=null,lastTap=0;
function doOpen(){if(f.isDir)openApp('pc',HOME+f.name+'/')}
icon.addEventListener('dblclick',function(e){e.preventDefault();if(timer){clearTimeout(timer);timer=null}doOpen()});
icon.addEventListener('click',function(){
if(timer){clearTimeout(timer);timer=null;return}
timer=setTimeout(function(){doOpen();timer=null},250);
});
icon.addEventListener('touchend',function(e){
e.preventDefault();
const now=Date.now();
if(now-lastTap<300){if(timer){clearTimeout(timer);timer=null}doOpen();lastTap=0}
else{lastTap=now;timer=setTimeout(function(){doOpen();timer=null},250)}
},{passive:false});
icon.addEventListener('contextmenu',function(e){
e.preventDefault();e.stopPropagation();
showItemContextMenu(e.clientX,e.clientY,'home/'+f.name,f.name,f.isDir,false);
});
desktopIcons.appendChild(icon);
});
}).catch(function(err){console.warn('桌面读取失败',err)});
}
function openAppWindow(app){
const winId='app-'+app.id+'-'+nextWindowId++;
const winEl=document.createElement('div');
winEl.className='window';
const p=getCenterPosition(720);
winEl.style.left=p.left+'px';
winEl.style.top=p.top+'px';
winEl.style.width='720px';
winEl.style.zIndex=++windowZIndex;
const titleBar=document.createElement('div');
titleBar.className='window-titlebar';
const titleDiv=document.createElement('div');
titleDiv.className='window-title';
if(app.icon){
titleDiv.innerHTML='<span class="title-icon"><img src="'+app.icon+'"></span><span>XiaofangOS - '+app.name+'</span>';
}else{
titleDiv.innerHTML='<span class="title-icon"></span><span>XiaofangOS - '+app.name+'</span>';
}
const controls=document.createElement('div');
controls.className='window-controls';
const closeBtn=document.createElement('button');
closeBtn.className='window-control-btn close';
closeBtn.innerHTML='✕';
closeBtn.addEventListener('click',function(e){e.stopPropagation();closeWindow(winId)});
controls.appendChild(closeBtn);
titleBar.appendChild(titleDiv);titleBar.appendChild(controls);
const contentEl=document.createElement('div');
contentEl.className='window-content app-content';
const iframe=document.createElement('iframe');
iframe.setAttribute('sandbox','allow-scripts allow-forms allow-modals allow-popups allow-same-origin');
iframe.srcdoc=app.htmlContent;
contentEl.appendChild(iframe);
winEl.appendChild(titleBar);winEl.appendChild(contentEl);
windowsLayer.appendChild(winEl);
makeDraggable(winEl,titleBar);
winEl.addEventListener('mousedown',function(){winEl.style.zIndex=++windowZIndex;focusWindow(winId)});
const taskbarBtn=document.createElement('button');
taskbarBtn.className='taskbar-btn active';
if(app.icon){
taskbarBtn.innerHTML='<span class="tb-icon"><img src="'+app.icon+'"></span><span>'+app.name+'</span>';
}else{
taskbarBtn.innerHTML='<span class="tb-icon"></span><span>'+app.name+'</span>';
}
taskbarBtn.addEventListener('click',function(){focusWindow(winId)});
taskbarCenter.appendChild(taskbarBtn);
windows.set(winId,{el:winEl,taskbarBtn:taskbarBtn,config:app});
focusWindow(winId);
}
function openTextEditor(relPath,fileName){
const winId='txt-'+nextWindowId++;
const winEl=document.createElement('div');
winEl.className='window';
const p=getCenterPosition(600);
winEl.style.left=p.left+'px';
winEl.style.top=p.top+'px';
winEl.style.width='600px';
winEl.style.zIndex=++windowZIndex;
const titleBar=document.createElement('div');
titleBar.className='window-titlebar';
const titleDiv=document.createElement('div');
titleDiv.className='window-title';
titleDiv.innerHTML='<span class="title-icon"></span><span>XiaofangOS - '+fileName+'</span>';
const controls=document.createElement('div');
controls.className='window-controls';
const closeBtn=document.createElement('button');
closeBtn.className='window-control-btn close';
closeBtn.innerHTML='✕';
closeBtn.addEventListener('click',function(e){e.stopPropagation();closeWindow(winId)});
controls.appendChild(closeBtn);
titleBar.appendChild(titleDiv);titleBar.appendChild(controls);
const contentEl=document.createElement('div');
contentEl.className='window-content app-content';
contentEl.innerHTML='<div style="height:100%;display:flex;flex-direction:column;background:#f5f7fa"><div style="background:linear-gradient(180deg,#e6edf7,#d3deec);padding:10px 14px;display:flex;gap:8px;border-bottom:1px solid #b8c8da"><button id="txtBtnSave" style="padding:6px 14px;border-radius:6px;border:1px solid #3a8eef;background:#4a9eff;color:#fff;font-size:13px;cursor:pointer;font-family:inherit">保存</button><button id="txtBtnClear" style="padding:6px 14px;border-radius:6px;border:1px solid #b8c8da;background:#f0f4fa;color:#1e2b3a;font-size:13px;cursor:pointer;font-family:inherit">清空</button><span id="txtStatus" style="margin-left:auto;font-size:12px;color:#5b6f82;align-self:center"></span></div><textarea id="txtEditor" style="flex:1;padding:16px;border:none;outline:none;resize:none;font-size:15px;line-height:1.6;background:#fff;color:#1e2b3a;font-family:Consolas,Monaco,monospace"></textarea></div>';
winEl.appendChild(titleBar);winEl.appendChild(contentEl);
windowsLayer.appendChild(winEl);
makeDraggable(winEl,titleBar);
winEl.addEventListener('mousedown',function(){winEl.style.zIndex=++windowZIndex;focusWindow(winId)});
const taskbarBtn=document.createElement('button');
taskbarBtn.className='taskbar-btn active';
taskbarBtn.innerHTML='<span class="tb-icon"></span><span>'+fileName+'</span>';
taskbarBtn.addEventListener('click',function(){focusWindow(winId)});
taskbarCenter.appendChild(taskbarBtn);
windows.set(winId,{el:winEl,taskbarBtn:taskbarBtn,config:{title:fileName}});
focusWindow(winId);
const editor=contentEl.querySelector('#txtEditor');
const status=contentEl.querySelector('#txtStatus');
api('read',{path:relPath}).then(function(r){
if(r.ok){editor.value=r.content;status.textContent='已加载'}
else{status.textContent='读取失败'}
}).catch(function(){status.textContent='读取失败'});
contentEl.querySelector('#txtBtnSave').addEventListener('click',function(){
api('write',{path:relPath,content:editor.value}).then(function(r){
if(r.ok){status.textContent='已保存 '+new Date().toLocaleTimeString();toast('已保存')}
else{status.textContent='保存失败';toast('保存失败')}
});
});
contentEl.querySelector('#txtBtnClear').addEventListener('click',function(){
editor.value='';status.textContent='已清空';
});
}
function renderDir(contentEl,path,win){
contentEl.innerHTML='';
const bar=document.createElement('div');
bar.className='win-toolbar';
const backBtn=document.createElement('button');
backBtn.className='back-btn';backBtn.innerHTML='◀';
const pathDisplay=document.createElement('span');
pathDisplay.className='path-display';pathDisplay.textContent=path;
bar.appendChild(backBtn);bar.appendChild(pathDisplay);
contentEl.appendChild(bar);
if(path===RECYCLE){
const tb=document.createElement('div');
tb.className='recycle-toolbar';
const btn=document.createElement('button');
btn.textContent='清空回收站';
btn.addEventListener('click',emptyTrash);
tb.appendChild(btn);
contentEl.appendChild(tb);
}
function canGoUp(){if(path===UBUNTU)return false;return true}
if(!canGoUp())backBtn.disabled=true;
backBtn.onclick=function(){
if(!canGoUp())return;
let p=path.replace(/\/$/,'');
const idx=p.lastIndexOf('/');
let parent=idx<=0?'/':p.slice(0,idx+1);
if(parent.length<UBUNTU.length)parent=UBUNTU;
win.path=parent;
renderDir(contentEl,parent,win);
};
const list=document.createElement('div');
list.className='item-list';
const loading=document.createElement('div');
loading.className='empty-message';loading.textContent='正在读取...';
list.appendChild(loading);
contentEl.appendChild(list);
readDir(path).then(function(items){
if(path===DESKTOP){
readDir(HOME).then(function(homeItems){
homeItems.forEach(function(h){
let exists=items.some(function(i){return i.name===h.name});
if(!exists)items.push(h);
});
finishRender(items);
}).catch(function(){finishRender(items)});
}else{finishRender(items)}
function finishRender(items){
list.innerHTML='';
if(!items.length){
const em=document.createElement('div');
em.className='empty-message';em.textContent='空文件夹';
list.appendChild(em);return;
}
items.sort(function(a,b){if(a.isDir!==b.isDir)return a.isDir?-1:1;return a.name.localeCompare(b.name)});
items.forEach(function(f){
const type=detectType(f.name,f.isDir);
const item=document.createElement('div');
item.className='list-item';
const icon=document.createElement('div');
icon.className='item-icon ic-'+type;
if(type==='jar'){const s=document.createElement('div');s.className='steam';icon.appendChild(s)}
const info=document.createElement('div');
info.className='item-info';
const nm=document.createElement('div');
nm.className='item-name';nm.textContent=f.name;
const mt=document.createElement('div');
mt.className='item-meta';mt.textContent=f.isDir?'文件夹':'文件';
info.appendChild(nm);info.appendChild(mt);
item.appendChild(icon);item.appendChild(info);
if(f.isDir){
item.addEventListener('dblclick',function(){
if(path===DESKTOP){
const target=HOME+f.name+'/';
win.path=target;renderDir(contentEl,target,win);
}else{
const base=path.replace(/\/$/,'');
const newPath=base+'/'+f.name+'/';
win.path=newPath;renderDir(contentEl,newPath,win);
}
});
}else if(type==='txt'){
item.addEventListener('dblclick',function(){
const base=path.replace(/\/$/,'');
const rel=(base.replace(/^\//,'')+'/'+f.name).replace(/^\/+/,'');
openTextEditor(rel,f.name);
});
}
item.addEventListener('contextmenu',function(e){
e.preventDefault();e.stopPropagation();
const base=path.replace(/\/$/,'');
const rel=base.replace(/^\//,'')+'/'+f.name;
const inRecycle=path.indexOf('recycle-bin')>=0;
showItemContextMenu(e.clientX,e.clientY,rel,f.name,f.isDir,inRecycle);
});
list.appendChild(item);
});
}
}).catch(function(err){
list.innerHTML='';
const em=document.createElement('div');
em.className='empty-message';em.innerHTML='读取失败<br><br>'+err.message;
list.appendChild(em);
});
}
function getCenterPosition(width){
const r=windowsLayer.getBoundingClientRect();
const w=Math.min(width,r.width-20);
const h=360;
let left=(r.width-w)/2+(Math.random()*40-20);
let top=(r.height-h)/2+(Math.random()*40-20);
left=Math.max(10,Math.min(left,r.width-w-10));
top=Math.max(10,Math.min(top,r.height-h-10));
return{left:left,top:top};
}
function makeDraggable(winEl,handleEl){
let sx=0,sy=0,sl=0,st=0,dragging=false;
function pos(e){
if(e.touches&&e.touches.length)return{x:e.touches[0].clientX,y:e.touches[0].clientY};
return{x:e.clientX,y:e.clientY};
}
function onStart(e){
if(e.target.closest('.window-control-btn'))return;
const p=pos(e);
dragging=true;sx=p.x;sy=p.y;
const r=winEl.getBoundingClientRect();
const lr=windowsLayer.getBoundingClientRect();
sl=r.left-lr.left;st=r.top-lr.top;
winEl.style.zIndex=++windowZIndex;
if(e.cancelable)e.preventDefault();
}
function onMove(e){
if(!dragging)return;
const p=pos(e);
let nl=sl+(p.x-sx);
let nt=st+(p.y-sy);
const lw=windowsLayer.clientWidth,lh=windowsLayer.clientHeight;
const ww=winEl.offsetWidth,wh=winEl.offsetHeight;
const mv=40;
nl=Math.max(-ww+mv,Math.min(nl,lw-mv));
nt=Math.max(0,Math.min(nt,lh-mv));
winEl.style.left=nl+'px';winEl.style.top=nt+'px';
if(e.cancelable)e.preventDefault();
}
function onEnd(){dragging=false}
handleEl.addEventListener('mousedown',onStart);
document.addEventListener('mousemove',onMove);
document.addEventListener('mouseup',onEnd);
handleEl.addEventListener('touchstart',onStart,{passive:false});
document.addEventListener('touchmove',onMove,{passive:false});
document.addEventListener('touchend',onEnd);
document.addEventListener('touchcancel',onEnd);
}
function closeWindow(winId){
const rec=windows.get(winId);
if(!rec)return;
const el=rec.el,tb=rec.taskbarBtn;
el.classList.add('closing');
if(tb)tb.classList.remove('active');
el.addEventListener('transitionend',function(){if(el.parentNode)el.remove()},{once:true});
if(tb&&tb.parentNode)tb.remove();
windows.delete(winId);
}
function focusWindow(winId){
const rec=windows.get(winId);
if(!rec)return;
rec.el.style.zIndex=++windowZIndex;
windows.forEach(function(r,id){if(r.taskbarBtn)r.taskbarBtn.classList.toggle('active',id===winId)});
}
function openApp(appId,customPath){
const cfg=appConfig[appId];
if(!cfg)return;
const startPath=customPath||cfg.path;
const winId=appId+'-'+nextWindowId++;
const winEl=document.createElement('div');
winEl.className='window';
const p=getCenterPosition(520);
winEl.style.left=p.left+'px';winEl.style.top=p.top+'px';
winEl.style.zIndex=++windowZIndex;
const titleBar=document.createElement('div');
titleBar.className='window-titlebar';
const titleDiv=document.createElement('div');
titleDiv.className='window-title';
titleDiv.innerHTML='<span class="title-icon '+cfg.icon+'"></span><span>XiaofangOS - '+cfg.title+'</span>';
const controls=document.createElement('div');
controls.className='window-controls';
const closeBtn=document.createElement('button');
closeBtn.className='window-control-btn close';
closeBtn.innerHTML='✕';
closeBtn.addEventListener('click',function(e){e.stopPropagation();closeWindow(winId)});
controls.appendChild(closeBtn);
titleBar.appendChild(titleDiv);titleBar.appendChild(controls);
const contentEl=document.createElement('div');
contentEl.className='window-content';
winEl.appendChild(titleBar);winEl.appendChild(contentEl);
windowsLayer.appendChild(winEl);
makeDraggable(winEl,titleBar);
winEl.addEventListener('mousedown',function(){winEl.style.zIndex=++windowZIndex;focusWindow(winId)});
const win={path:startPath,el:winEl,root:cfg.root};
renderDir(contentEl,startPath,win);
const taskbarBtn=document.createElement('button');
taskbarBtn.className='taskbar-btn active';
taskbarBtn.innerHTML='<span class="tb-icon '+cfg.icon+'"></span><span>'+cfg.title+'</span>';
taskbarBtn.addEventListener('click',function(){focusWindow(winId)});
taskbarCenter.appendChild(taskbarBtn);
windows.set(winId,{el:winEl,taskbarBtn:taskbarBtn,config:cfg,win:win});
focusWindow(winId);
}
function refreshRecycleIfOpen(){
windows.forEach(function(rec){
if(rec.config&&rec.config.title==='回收站'&&rec.win){
const contentEl=rec.el.querySelector('.window-content');
if(contentEl){contentEl.innerHTML='';renderDir(contentEl,rec.win.path,rec.win)}
}
});
}
function bindIcon(iconEl,appId){
let timer=null,lastTap=0;
iconEl.addEventListener('dblclick',function(e){e.preventDefault();if(timer){clearTimeout(timer);timer=null}openApp(appId)});
iconEl.addEventListener('click',function(){
if(timer){clearTimeout(timer);timer=null;return}
timer=setTimeout(function(){openApp(appId);timer=null},250);
});
iconEl.addEventListener('touchend',function(e){
e.preventDefault();
const now=Date.now();
if(now-lastTap<300){if(timer){clearTimeout(timer);timer=null}openApp(appId);lastTap=0}
else{lastTap=now;timer=setTimeout(function(){openApp(appId);timer=null},250)}
},{passive:false});
}
bindIcon(document.getElementById('icon-pc'),'pc');
bindIcon(document.getElementById('icon-recycle'),'recycle');
startBtn.addEventListener('click',function(e){
e.stopPropagation();
startMenu.classList.toggle('open');
if(!startMenu.classList.contains('open')){
powerSubmenu.classList.remove('open');
powerEntry.classList.remove('open');
}
});
startMenu.querySelectorAll('.start-item[data-app]').forEach(function(item){
item.addEventListener('click',function(){
const appId=item.getAttribute('data-app');
openApp(appId);
startMenu.classList.remove('open');
});
});
powerEntry.addEventListener('click',function(e){
e.stopPropagation();
const willOpen=!powerSubmenu.classList.contains('open');
powerSubmenu.classList.toggle('open',willOpen);
powerEntry.classList.toggle('open',willOpen);
});
document.getElementById('menuRestart').addEventListener('click',function(){
deleteCookie(BOOT_COOKIE);setCookie(BOOT_COOKIE,'restarted',365);location.reload();
});
document.getElementById('menuShutdown').addEventListener('click',function(){
deleteCookie(BOOT_COOKIE);
document.body.innerHTML='<div class="shutdown-screen"><div class="shutdown-dots"><span></span><span></span><span></span><span></span><span></span></div><div class="shutdown-text">正在关机...</div></div>';
setTimeout(function(){
document.body.innerHTML='<div class="shutdown-done">已关机</div>';
try{window.close()}catch(e){}
},2200);
});
document.addEventListener('click',function(e){
if(!startMenu.contains(e.target)&&e.target!==startBtn){
startMenu.classList.remove('open');
powerSubmenu.classList.remove('open');
powerEntry.classList.remove('open');
}
if(!ctxMenu.contains(e.target))ctxMenu.classList.remove('open');
});
function updateTime(){
const now=new Date();
document.getElementById('taskbarTime').textContent=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
}
updateTime();setInterval(updateTime,1000);
function showContextMenu(x,y,items){
ctxMenu.innerHTML='';
items.forEach(function(it){
if(it.sep){const s=document.createElement('div');s.className='ctx-sep';ctxMenu.appendChild(s);return}
const el=document.createElement('div');
el.className='ctx-item'+(it.danger?' danger':'');
el.textContent=it.text;
el.addEventListener('click',function(){ctxMenu.classList.remove('open');it.onClick()});
ctxMenu.appendChild(el);
});
const mx=Math.min(x,window.innerWidth-200);
const my=Math.min(y,window.innerHeight-items.length*40-20);
ctxMenu.style.left=mx+'px';ctxMenu.style.top=my+'px';
ctxMenu.classList.add('open');
}
function showItemContextMenu(x,y,relPath,name,isDir,inRecycle){
const items=[];
if(!inRecycle){
if(name.toLowerCase().endsWith('.xfapp')&&!isDir)items.push({text:'安装',onClick:function(){installApp(name)}});
if(!isDir&&name.toLowerCase().endsWith('.txt'))items.push({text:'用文本编辑器打开',onClick:function(){openTextEditor(relPath,name)}});
if(isDir)items.push({text:'打开',onClick:function(){openApp('pc','/home/'+name+'/')}});
items.push({sep:true});
items.push({text:'重命名',onClick:function(){renameItem(relPath,name)}});
items.push({text:'删除',danger:true,onClick:function(){trashItem(relPath)}});
}else{
items.push({text:'还原到 home',onClick:function(){restoreItem(relPath)}});
items.push({sep:true});
items.push({text:'永久删除',danger:true,onClick:function(){deletePermanently(relPath,name)}});
}
showContextMenu(x,y,items);
}
function installApp(filename){
api('install_check',{src:'home/'+filename}).then(function(r){
if(r.error){toast('安装失败：'+r.error,3000);return}
if(r.decision==='fail'){
toast('安装失败：已有更高版本 ('+r.oldVersion+' > '+r.newVersion+')',3500);
return;
}
let msg='';
if(r.reason==='upgrade')msg='将覆盖旧版本 '+r.oldVersion+' → '+r.newVersion+'，继续？\n安装后名称：'+r.id+'.xfapp';
else if(r.reason==='same_version')msg='相同版本 '+r.newVersion+'，覆盖安装？\n安装后名称：'+r.id+'.xfapp';
else msg='确认安装 '+filename+' ？\n安装后名称：'+r.id+'.xfapp';
showDialog({
title:'安装应用',
message:msg,
buttons:[
{text:'取消',onClick:closeDialog},
{text:'安装',primary:true,onClick:function(){closeDialog();doInstall(filename,r.id)}}
]
});
});
}
function doInstall(filename,targetId){
toast('正在安装...',1500);
const xhr=new XMLHttpRequest();
const srcParts=('home/'+filename).split('/').map(function(s){return encodeURIComponent(s)}).join('/');
xhr.open('GET','/'+srcParts,true);
xhr.responseType='arraybuffer';
xhr.onload=function(){
if(xhr.status!==200){toast('读取源文件失败');return}
const buf=xhr.response;
const xhr2=new XMLHttpRequest();
xhr2.open('POST','/api.php?action=install',true);
xhr2.setRequestHeader('X-Target-Path','Ubuntu/mnt/data/'+targetId+'.xfapp');
xhr2.onload=function(){
if(xhr2.status===200){toast('安装成功：'+targetId+'.xfapp');refreshApps();renderDesktopIcons()}
else{toast('安装失败')}
};
xhr2.send(buf);
};
xhr.send();
}
function trashItem(relPath){
api('trash',{target:relPath}).then(function(r){
if(r.ok){toast('已移到回收站');renderDesktopIcons();refreshRecycleIfOpen()}
else{toast('失败：'+(r.error||''))}
});
}
function renameItem(relPath,oldName){
showDialog({
title:'重命名',
message:'重命名 "'+oldName+'"：',
input:oldName,
buttons:[
{text:'取消',onClick:closeDialog},
{text:'确定',primary:true,onClick:function(newName){
closeDialog();
if(!newName||newName===oldName)return;
const parent=relPath.replace(/\/[^\/]*$/,'');
const to=parent+'/'+newName;
api('rename',{from:relPath,to:to}).then(function(r){
if(r.ok){toast('已重命名');renderDesktopIcons();refreshRecycleIfOpen()}
else{toast('失败：'+(r.error||''))}
});
}}
]
});
}
function deletePermanently(relPath,name){
showDialog({
title:'永久删除',
message:'确定要永久删除 "'+name+'" 吗？此操作不可撤销。',
buttons:[
{text:'取消',onClick:closeDialog},
{text:'删除',danger:true,onClick:function(){
closeDialog();
api('delete',{target:relPath}).then(function(r){
if(r.ok){toast('已删除');renderDesktopIcons();refreshApps();refreshRecycleIfOpen()}
else{toast('失败：'+(r.error||''))}
});
}}
]
});
}
function restoreItem(relPath){
api('restore',{target:relPath}).then(function(r){
if(r.ok){toast('已恢复到 home');renderDesktopIcons();refreshRecycleIfOpen()}
else{toast('失败：'+(r.error||''))}
});
}
function emptyTrash(){
showDialog({
title:'清空回收站',
message:'确定要清空回收站吗？所有文件将被永久删除，此操作不可撤销。',
buttons:[
{text:'取消',onClick:closeDialog},
{text:'清空',danger:true,onClick:function(){
closeDialog();
api('empty_trash',{}).then(function(r){
if(r.ok){toast('回收站已清空');refreshRecycleIfOpen()}
else{toast('失败')}
});
}}
]
});
}
function newFolder(){
showDialog({
title:'新建文件夹',
input:'新建文件夹',
buttons:[
{text:'取消',onClick:closeDialog},
{text:'创建',primary:true,onClick:function(name){
closeDialog();
if(!name)return;
api('mkdir',{path:'home/'+name}).then(function(r){
if(r.ok){toast('已创建');renderDesktopIcons()}
else{toast('失败：'+(r.error||''))}
});
}}
]
});
}
function newTextFile(){
showDialog({
title:'新建文本文件',
input:'新建文本.txt',
buttons:[
{text:'取消',onClick:closeDialog},
{text:'创建',primary:true,onClick:function(name){
closeDialog();
if(!name)return;
api('mkfile',{path:'home/'+name}).then(function(r){
if(r.ok){toast('已创建');renderDesktopIcons()}
else{toast('失败：'+(r.error||''))}
});
}}
]
});
}
desktop.addEventListener('contextmenu',function(e){
e.preventDefault();
if(e.target.closest('.window')||e.target.closest('.taskbar')||e.target.closest('.start-menu')||e.target.closest('.icon'))return;
showContextMenu(e.clientX,e.clientY,[
{text:'刷新',onClick:function(){renderDesktopIcons();refreshApps()}},
{sep:true},
{text:'新建文件夹',onClick:newFolder},
{text:'新建文本文件',onClick:newTextFile},
{sep:true},
{text:'扫描已安装应用',onClick:refreshApps}
]);
});
document.addEventListener('contextmenu',function(e){
if(!e.target.closest('.icon')&&!e.target.closest('.list-item')&&!e.target.closest('.desktop'))e.preventDefault();
});
runBootSequence(function(){
renderDesktopIcons();
refreshApps();
setInterval(renderDesktopIcons,8000);
setInterval(refreshApps,15000);
});
})();