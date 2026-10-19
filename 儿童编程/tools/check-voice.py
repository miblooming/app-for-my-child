"""Spot-check local speech with the shared Whisper model; no model downloads."""
from pathlib import Path
import json, os, math, re
import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly
from transformers import WhisperProcessor, WhisperForConditionalGeneration

ROOT=Path(__file__).resolve().parents[1]
SHARED=Path(os.environ.get('LOCAL_AI_HOME',r'K:\ai-model'))
registry=json.loads((SHARED/'registry.json').read_text(encoding='utf-8'))
model_path=SHARED/registry['models']['whisper-base']['path']
device='cuda' if torch.cuda.is_available() else 'cpu'
dtype=torch.float16 if device=='cuda' else torch.float32
processor=WhisperProcessor.from_pretrained(str(model_path),local_files_only=True)
model=WhisperForConditionalGeneration.from_pretrained(str(model_path),dtype=dtype,local_files_only=True).to(device).eval()
jobs=json.loads((ROOT/'voice-jobs.json').read_text(encoding='utf-8'))['jobs']
report=[]
for job in jobs:
    data,rate=sf.read(ROOT/'audio'/f'{job["id"]}.wav',dtype='float32')
    seconds=len(data)/rate
    if data.ndim>1:data=data.mean(axis=1)
    divisor=math.gcd(rate,16000);data=resample_poly(data,16000//divisor,rate//divisor)
    pieces=[]
    for offset in range(0,len(data),16000*25):
        inputs=processor(data[offset:offset+16000*25],sampling_rate=16000,return_tensors='pt',return_attention_mask=True)
        with torch.inference_mode():
            tokens=model.generate(inputs.input_features.to(device,dtype=dtype),attention_mask=inputs.attention_mask.to(device),language='zh',task='transcribe',num_beams=3,max_new_tokens=256)
        pieces.append(processor.batch_decode(tokens,skip_special_tokens=True)[0])
    text=''.join(pieces)
    report.append(dict(id=job['id'],expected=job['text'],transcript=text,seconds=round(seconds,3)))
    print(job['id']+': '+text,flush=True)
(ROOT/'audio'/'读音抽查.json').write_text(json.dumps({'note':'Whisper 辅助读音抽查，不替代人工试听或真机验收。','clips':report},ensure_ascii=False,indent=2),encoding='utf-8')
