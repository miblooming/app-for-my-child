"""Verify all real speech files against the application's exact voice timeline."""
from pathlib import Path
import json
import wave

ROOT=Path(__file__).resolve().parents[1]

def validate():
    assets=ROOT/'app'/'src'/'main'/'assets'
    pack=json.loads((assets/'voice-pack.json').read_text(encoding='utf-8'))
    assert pack['syntheticVoice'] and pack['model']=='Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice'
    expected={f'n{n:03d}.wav' for n in range(1,301)}|{'ready.wav','go.wav','success.wav'}
    assert {p.name for p in (assets/'audio').glob('*.wav')}==expected
    for filename in expected:
        with wave.open(str(assets/'audio'/filename)) as f:
            assert f.getnchannels()==1 and f.getsampwidth()==2 and f.getframerate()==pack['sampleRate']
            duration=f.getnframes()/f.getframerate()
            if filename.startswith('n'): assert .10<duration<.98,filename
            elif filename=='ready.wav': assert duration*1000<pack['readySlotMs']
            elif filename=='go.wav': assert duration*1000<pack['goSlotMs']
            else: assert duration*1000<=pack['successAudioMs']
    assert 400<=pack['readySlotMs']<=20000 and 400<=pack['goSlotMs']<=10000
    print('PASS: all 303 neural voice files match the adaptive timeline and numeral slots.')
    return pack

if __name__=='__main__': validate()
