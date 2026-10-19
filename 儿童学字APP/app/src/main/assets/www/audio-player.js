(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ZiyaAudio=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function create(options){
    const bridge=options.bridge,AudioClass=options.AudioClass;let sequence=0,player=null,active=null;
    const state=(id,status)=>options.onState&&options.onState(id,status);
    function stop(){sequence++;if(player){player.pause();player.removeAttribute('src');player.load();player=null;}if(bridge&&bridge.stopAudio)bridge.stopAudio();if(active)state(active,'stopped');active=null;}
    function play(id){
      if(!/^(c\d{4}|[if]_[a-z]{1,3})$/.test(id))return false;
      stop();const token=sequence;active=id;state(id,'loading');
      if(bridge&&bridge.playAudio){try{bridge.playAudio(id,token);return true;}catch(e){fail(token,id);return false;}}
      if(!AudioClass){fail(token,id);return false;}
      const audio=new AudioClass('audio/'+id+'.mp3');player=audio;audio.preload='auto';
      audio.onplaying=()=>{if(token===sequence)state(id,'playing');};
      audio.onended=()=>{if(token===sequence){active=null;player=null;state(id,'ended');}};
      audio.onerror=()=>fail(token,id);
      try{const p=audio.play();if(p&&p.catch)p.catch(()=>fail(token,id));}catch(e){fail(token,id);return false;}
      return true;
    }
    function fail(token,id){if(token!==sequence)return;active=null;if(player){player.pause();player=null;}state(id,'error');if(options.onError)options.onError('声音暂时无法播放，请检查媒体音量后重试');}
    function nativeStatus(token,id,status){if(token!==sequence||active!==id)return;if(status==='error'){fail(token,id);return;}if(status==='ended'||status==='stopped')active=null;state(id,status);}
    return {play,stop,nativeStatus,active:()=>active};
  }
  return {create};
});
