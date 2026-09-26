(function(){
'use strict';
const TERMINAL_HOME='/storage/emulated/0/Android/media/com.xiaofang.os/cmd/';
let nextTerminalWindowId=1;

function esc(s){
return String(s==null?'':s).replace(/[&<>"']/g,function(c){
return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
});
}

function getLang(){
try{return window.XiaofangI18N||{};}catch(e){return {};}
}

function t(key,params){
const L=getLang();
let s=L[key]||key;
if(params){
Object.keys(params).forEach(function(k){
s=s.replace(new RegExp('\\{'+k+'\\}','g'),params[k]);
});
}
return s;
}

function normalizePath(p){
if(!p)return TERMINAL_HOME;
let abs=p;
if(abs==='~')abs=TERMINAL_HOME;
else if(abs.indexOf('~/')===0)abs=TERMINAL_HOME+abs.slice(2);
else if(abs.charAt(0)!=='/')abs=TERMINAL_HOME+abs;
const parts=abs.split('/');
const out=[];
parts.forEach(function(seg){
if(seg===''||seg==='.')return;
if(seg==='..'){
if(out.length>0)out.pop();
}else{
out.push(seg);
}
});
return '/'+out.join('/');
}

function joinPath(cwd,arg){
if(!arg)return cwd;
if(arg==='~')return TERMINAL_HOME;
if(arg.indexOf('~/')===0)return TERMINAL_HOME+arg.slice(2);
if(arg.charAt(0)==='/')return normalizePath(arg);
return normalizePath(cwd+'/'+arg);
}

function getPromptPath(cwd){
let p=cwd||TERMINAL_HOME;
if(p.charAt(p.length-1)!=='/')p+='/';
if(p===TERMINAL_HOME)return '~';
if(p.indexOf(TERMINAL_HOME)===0){
const rest=p.slice(TERMINAL_HOME.length).replace(/\/$/,'');
return rest?'~/'+rest:'~';
}
return p.replace(/\/$/,'')||'/';
}

function openTerminal(){
const winId='term-'+nextTerminalWindowId++;
let cwd=TERMINAL_HOME;
const winEl=document.createElement('div');
winEl.className='window';
const layerEl=document.getElementById('windowsLayer');
const r=layerEl.getBoundingClientRect();
const winW=Math.min(680,r.width-20);
winEl.style.width=winW+'px';
winEl.style.height=Math.min(440,r.height-20)+'px';
let left=(r.width-winW)/2+(Math.random()*40-20);
let top=(r.height-440)/2+(Math.random()*40-20);
left=Math.max(10,Math.min(left,r.width-winW-10));
top=Math.max(10,Math.min(top,r.height-300));
winEl.style.left=left+'px';
winEl.style.top=top+'px';
winEl.style.zIndex=window.XiaofangGetZIndex?window.XiaofangGetZIndex():999;
const titleBar=document.createElement('div');
titleBar.className='window-titlebar';
const titleDiv=document.createElement('div');
titleDiv.className='window-title';
titleDiv.innerHTML='<span class="title-icon"></span><span>'+esc(t('win.terminal')||'终端')+'</span>';
const controls=document.createElement('div');
controls.className='window-controls';
const closeBtn=document.createElement('button');
closeBtn.className='window-control-btn close';
closeBtn.innerHTML='✕';
closeBtn.addEventListener('click',function(e){
e.stopPropagation();
if(window.XiaofangCloseWindow)window.XiaofangCloseWindow(winId);
});
controls.appendChild(closeBtn);
titleBar.appendChild(titleDiv);
titleBar.appendChild(controls);
const contentEl=document.createElement('div');
contentEl.className='window-content app-content';
contentEl.style.padding='0';
contentEl.style.position='relative';
contentEl.style.overflow='hidden';
contentEl.innerHTML='<div class="terminal-wrap"><div class="terminal-output" id="termOut-'+winId+'"></div></div>';
const hiddenInput=document.createElement('input');
hiddenInput.type='text';
hiddenInput.setAttribute('autocomplete','off');
hiddenInput.setAttribute('autocorrect','off');
hiddenInput.setAttribute('autocapitalize','off');
hiddenInput.setAttribute('spellcheck','false');
hiddenInput.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;border:none;outline:none;padding:0;margin:0;background:transparent;color:transparent;caret-color:transparent;font-size:16px;z-index:1';
contentEl.appendChild(hiddenInput);
winEl.appendChild(titleBar);
winEl.appendChild(contentEl);
const resizeHandle=document.createElement('div');
resizeHandle.className='window-resize';
winEl.appendChild(resizeHandle);
layerEl.appendChild(winEl);
if(window.XiaofangMakeDraggable)window.XiaofangMakeDraggable(winEl,titleBar);
if(window.XiaofangMakeResizable)window.XiaofangMakeResizable(winEl,resizeHandle);
winEl.addEventListener('mousedown',function(){
winEl.style.zIndex=window.XiaofangGetZIndex?window.XiaofangGetZIndex():999;
if(window.XiaofangFocusWindow)window.XiaofangFocusWindow(winId);
});
if(window.XiaofangRegisterWindow)window.XiaofangRegisterWindow(winId,winEl,{title:t('win.terminal')||'终端',iconClass:'terminal'});

const outputEl=contentEl.querySelector('#termOut-'+winId);

let currentLine=null;
let currentInput='';
let busy=false;
let history=[];
let historyIdx=-1;

function scrollBottom(){
outputEl.scrollTop=outputEl.scrollHeight;
}

function appendLine(html,cls){
const line=document.createElement('div');
line.className='terminal-line'+(cls?' '+cls:'');
line.innerHTML=html;
outputEl.appendChild(line);
scrollBottom();
return line;
}

function promptHtml(){
return '<span class="terminal-prompt">'+esc(getPromptPath(cwd))+' $</span> ';
}

function newPromptLine(){
const line=document.createElement('div');
line.className='terminal-line terminal-active';
line.innerHTML=promptHtml()+'<span class="terminal-input-text"></span><span class="terminal-caret"></span>';
outputEl.appendChild(line);
currentLine=line;
const textSpan=line.querySelector('.terminal-input-text');
textSpan.textContent=currentInput;
scrollBottom();
}

function refreshCurrentLine(){
if(!currentLine)return;
const textSpan=currentLine.querySelector('.terminal-input-text');
if(textSpan)textSpan.textContent=currentInput;
scrollBottom();
}

function freezeCurrentLine(){
if(!currentLine)return;
currentLine.classList.remove('terminal-active');
const caret=currentLine.querySelector('.terminal-caret');
if(caret)caret.remove();
currentLine=null;
}

function printBanner(){
appendLine('<span class="terminal-info">XiaofangOS Terminal 3.0.0</span>');
appendLine('<span class="terminal-info">Type "help" for a list of commands.</span>');
appendLine('');
}

async function runCommand(cmd){
busy=true;
freezeCurrentLine();
if(cmd.trim()){
history.push(cmd);
historyIdx=history.length;
}
try{
await execute(cmd);
}catch(e){
appendLine('错误：'+esc(e.message||String(e)),'terminal-err');
}
busy=false;
currentInput='';
newPromptLine();
}

async function execute(cmd){
cmd=cmd.trim();
if(!cmd)return;

if(cmd==='clear'||cmd==='cls'){
outputEl.innerHTML='';
return;
}
if(cmd==='exit'){
if(window.XiaofangCloseWindow)window.XiaofangCloseWindow(winId);
return;
}
if(cmd==='help'){
appendLine('Built-in commands:');
appendLine('  help        显示此帮助');
appendLine('  clear/cls   清屏');
appendLine('  exit        关闭终端');
appendLine('  pwd         显示当前目录');
appendLine('  cd <dir>    切换目录（支持相对、绝对、..、~）');
appendLine('');
appendLine('其他命令通过 Termux 后端执行，如:');
appendLine('  ls, cat, echo, mkdir, rm, mv, cp, touch,');
appendLine('  xfpkg list, xfpkg install <id>, xfpkg remove <id>');
appendLine('  php -v, python --version, git --version ...');
appendLine('');
return;
}
if(cmd==='pwd'){
appendLine(esc(cwd));
return;
}
if(cmd==='cd'){
cwd=TERMINAL_HOME;
return;
}
if(cmd.indexOf('cd ')===0){
const target=cmd.slice(3).trim();
const newPath=joinPath(cwd,target);
try{
const res=await fetch('/api.php?action=list&path='+encodeURIComponent(newPath.replace(/^\//,''))+'&_t='+Date.now());
if(!res.ok)throw new Error('HTTP '+res.status);
const data=await res.json();
if(data.ok){
cwd=newPath;
}else{
appendLine('cd: 目录不存在: '+esc(target),'terminal-err');
}
}catch(e){
appendLine('cd: 无法访问: '+esc(target),'terminal-err');
}
return;
}
try{
const res=await fetch('/api.php?action=shell',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({cmd:cmd,cwd:cwd})
});
const data=await res.json();
if(!data.ok){
appendLine('错误: '+esc(data.error||'unknown'),'terminal-err');
return;
}
if(data.cwd)cwd=data.cwd;
const out=data.output||'';
if(out===''){
appendLine('');
}else{
const lines=out.split('\n');
lines.forEach(function(line,i){
if(i===lines.length-1&&line==='')return;
appendLine(esc(line));
});
}
}catch(e){
appendLine('网络错误: '+esc(e.message),'terminal-err');
}
}

function submitCommand(){
if(busy)return;
const cmd=currentInput;
currentInput='';
refreshCurrentLine();
runCommand(cmd);
}

function handleSpecialKey(e){
if(e.key==='Enter'){
e.preventDefault();
submitCommand();
return true;
}
if(e.key==='Backspace'){
e.preventDefault();
currentInput=currentInput.slice(0,-1);
refreshCurrentLine();
return true;
}
if(e.key==='ArrowUp'){
e.preventDefault();
if(history.length===0)return true;
if(historyIdx>0)historyIdx--;
currentInput=history[historyIdx]||'';
refreshCurrentLine();
return true;
}
if(e.key==='ArrowDown'){
e.preventDefault();
if(history.length===0)return true;
if(historyIdx<history.length-1){
historyIdx++;
currentInput=history[historyIdx]||'';
}else{
historyIdx=history.length;
currentInput='';
}
refreshCurrentLine();
return true;
}
if(e.key==='c'&&e.ctrlKey){
e.preventDefault();
appendLine('^C');
currentInput='';
refreshCurrentLine();
return true;
}
if(e.key==='l'&&e.ctrlKey){
e.preventDefault();
outputEl.innerHTML='';
return true;
}
return false;
}

hiddenInput.addEventListener('input',function(){
if(busy){hiddenInput.value='';return}
const val=hiddenInput.value;
if(val.length>0){
currentInput+=val;
hiddenInput.value='';
refreshCurrentLine();
}
});

hiddenInput.addEventListener('keydown',function(e){
if(busy&&e.key!=='Enter'){return}
if(handleSpecialKey(e))return;
if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
e.preventDefault();
currentInput+=e.key;
refreshCurrentLine();
hiddenInput.value='';
}
});

hiddenInput.addEventListener('blur',function(){
setTimeout(function(){
if(document.activeElement!==hiddenInput&&outputEl.isConnected){
hiddenInput.focus();
}
},80);
});

contentEl.addEventListener('click',function(){
hiddenInput.focus();
});
contentEl.addEventListener('touchstart',function(){
hiddenInput.focus();
},{passive:true});
winEl.addEventListener('mousedown',function(){
hiddenInput.focus();
});
winEl.addEventListener('touchstart',function(){
hiddenInput.focus();
},{passive:true});

const observer=new MutationObserver(function(){
if(!currentLine&&!busy){
newPromptLine();
}
});
observer.observe(outputEl,{childList:true});

printBanner();
newPromptLine();

setTimeout(function(){
hiddenInput.focus();
},200);
}

window.XiaofangOpenTerminal=openTerminal;
})();