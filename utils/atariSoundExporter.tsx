// utils/atariSoundExporter.ts
import { SoundEffect } from '@/types';

export const exportToAsm = (soundEffects: SoundEffect[], gameName: string) => {
    let sfxF = 'SFX_F:\n';
    soundEffects.forEach(effect => {
        const frequencies = effect.tones.map(t => t.frequency).reverse().join(', ');
        sfxF += `    .byte 0, ${frequencies} ; ${effect.name}\n`;
    });

    let sfxFChunk = `
; calculate size of SFX_F table and validate size
SFX_Fcount = * -SFX_F
    if SFX_Fcount > 256
        echo "SFX Warning: table SFX_F is too large"
    endif
    `

    let sfxCV = '\nSFX_CV:\n';
    soundEffects.forEach(effect => {
        const cvValues = effect.tones.map(t => `$${t.control.toString(16)}${t.volume.toString(16)}`).reverse().join(', ');
        sfxCV += `    .byte 0,${cvValues} ; ${effect.name}\n`;
        sfxCV += `sfx${effect.name.toUpperCase().replace(/\s+/g, '')} = *-SFX_CV-1\n`;
    });

    let sfxCVChunk =
        `
; calculate size of SFX_CV table and validate size
SFX_CVcount = *-SFX_CV

 if SFX_CVcount > 256
     echo "SFX Warning: table SFX_CV is too large"
 endif
 if SFX_CVcount != SFX_Fcount
    echo "SFX Warning: table SFX_F is not the same size as table SFX_CV"
 endif


SFX_OFF:
    ldx #0             ; silence sound output
    stx SFX_LEFT
    stx SFX_RIGHT
    stx AUDV0
    stx AUDV1
    stx AUDC0
    stx AUDC1
    rts

SFX_TRIGGER:
    ldx SFX_LEFT       ; test left channel
    lda SFX_CV,x        ; CV value will be 0 if channel is idle
    bne .leftnotfree   ; if not 0 then skip ahead
    sty SFX_LEFT       ; channel is idle, use it
    rts                ; all done
.leftnotfree:
    ldx SFX_RIGHT      ; test right channel
    lda SFX_CV,x        ; CV value will be 0 if channel is idle
    bne .rightnotfree  ; if not 0 then skip ahead
    sty SFX_RIGHT      ; channel is idle, use it
    rts                ; all done
.rightnotfree:
    cpy SFX_LEFT       ; test sfx priority with left channel
    bcc .leftnotlower  ; skip ahead if new sfx has lower priority than active sfx
    sty SFX_LEFT       ; new sfx has higher priority so use left channel
    rts                ; all done
.leftnotlower:
    cpy SFX_RIGHT      ; test sfx with right channel
    bcc .rightnotlower ; skip ahead if new sfx has lower priority than active sfx
    sty SFX_RIGHT      ; new sfx has higher priority so use right channel
.rightnotlower:
    rts

SFX_UPDATE:
    ldx SFX_LEFT       ; get the pointer for the left channel
    lda SFX_F,x         ; get the Frequency value
    sta AUDF0          ; update the Frequency register
    lda SFX_CV,x        ; get the combined Control and Volume value
    sta AUDV0          ; update the Volume register
    lsr                ; prep the Control value,
    lsr                ;   it's stored in the upper nybble
    lsr                ;   but must be in the lower nybble
    lsr                ;   when Control is updated
    sta AUDC0          ; update the Control register
    beq .skipleftdec   ; skip ahead if Control = 0
    dec SFX_LEFT       ; update pointer for left channel
.skipleftdec:
    ldx SFX_RIGHT      ; get the pointer for the right channel
    lda SFX_F,x         ; get the Frequency value
    sta AUDF1          ; update the Frequency register
    lda SFX_CV,x        ; get the combined Control and Volume value
    sta AUDV1          ; update the Volume register
    lsr                ; prep the Control value,
    lsr                ;   it's stored in the upper nybble
    lsr                ;   but must be in the lower nybble
    lsr                ;   when Control is updated
    sta AUDC1          ; update the Control register
    beq .skiprightdec  ; skip ahead if Control = 0
    dec SFX_RIGHT      ; update pointer for right channel
.skiprightdec:
    rts                ; all done
`

    const blob = new Blob([sfxF + sfxFChunk + sfxCV + sfxCVChunk], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameName.toLowerCase().replace(/\s+/g, '-')}-sfx.asm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};