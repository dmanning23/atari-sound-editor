// utils/atariSoundExporter.ts
import { SoundEffect } from '@/types';

export const exportToAsm = (soundEffects: SoundEffect[], gameName: string) => {
    let soundEffectData = '';
    let soundEffectTable = '\n; Sound Effect Table\nSFXTable:\n';
    let soundEffectIDs = '\n; Sound Effect IDs\n';
    let soundEffectLengths = '\n; Sound effect lengths for reference\n';

    // Generate sound effect data structures
    soundEffects.forEach((effect, index) => {
        const effectId = index + 1; // IDs start at 1
        const effectName = effect.name.toUpperCase().replace(/\s+/g, '');

        // Add sound effect ID constant
        soundEffectIDs += `SFX_ID_${effectName} = ${effectId}\n`;

        // Add sound effect length constant
        soundEffectLengths += `SFX_${effectName}_LENGTH = #${effect.tones.length}\n`;

        // Add table entry
        soundEffectTable += `    .word sfx${effectName} ; ID = ${effectId}\n`;

        // Start building sound effect data
        soundEffectData += `\nsfx${effectName}:\n`;
        soundEffectData += `    .byte #${effect.tones.length} ; ${effect.name} Length\n`;

        // Add frequency values - reversed order from the original
        const frequencies = effect.tones.map(t => t.frequency);
        soundEffectData += `    ; Frequency values\n`;
        soundEffectData += `    .byte ${frequencies.join(', ')}\n`;

        // Add control/volume values - reversed order from the original
        const cvValues = effect.tones.map(t => `$${t.control.toString(16)}${t.volume.toString(16)}`);
        soundEffectData += `    ; Control/Volume values\n`;
        soundEffectData += `    .byte ${cvValues.join(', ')}\n`;
    });

    // Generate the main sound engine code
    const soundEngineCode = `
; Generic Sound Effect Engine for Atari 2600
; -----------------------------------------


${soundEffectIDs}
${soundEffectLengths}

; Sound Effect Data Structures
; Format: 
;   First byte = Length of sound effect
;   Next N bytes = Frequency values
;   Next N bytes = Control/Volume values
${soundEffectData}
${soundEffectTable}

; Turn off all sound
; Call this during game initialization
SFX_OFF:
    ldx #0             ; Silence sound output
    stx SFX_LEFT
    stx SFX_RIGHT
    stx AUDV0
    stx AUDV1
    stx AUDC0
    stx AUDC1
    stx SFX_LEFT_TIMER
    stx SFX_RIGHT_TIMER
    rts

; Trigger a sound effect
; Input: Y register = sound effect ID (1, 2, 3, etc.)
; Higher numbered IDs have higher priority
SFX_TRIGGER:
    lda SFX_LEFT       ; Test left channel, will be 0 if channel is idle
    bne .leftnotfree   ; If not 0 then skip ahead
    sty SFX_LEFT       ; Channel is idle, use it
    lda #0             ; Reset the timer for the left channel
    sta SFX_LEFT_TIMER
    rts                ; All done
.leftnotfree:
    lda SFX_RIGHT      ; Test right channel, will be 0 if channel is idle
    bne .rightnotfree  ; If not 0 then skip ahead
    sty SFX_RIGHT      ; Channel is idle, use it
    lda #0             ; Reset the timer for the right channel
    sta SFX_RIGHT_TIMER
    rts                ; All done
.rightnotfree:
    cpy SFX_LEFT       ; Test sfx priority with left channel
    bcc .leftnotlower  ; Skip ahead if new sfx has lower priority than active sfx
    sty SFX_LEFT       ; New sfx has higher priority so use left channel
    lda #0             ; Reset the timer for the left channel
    sta SFX_LEFT_TIMER
    rts                ; All done
.leftnotlower:
    cpy SFX_RIGHT      ; Test sfx with right channel
    bcc .rightnotlower ; Skip ahead if new sfx has lower priority than active sfx
    sty SFX_RIGHT      ; New sfx has higher priority so use right channel
    lda #0             ; Reset the timer for the right channel
    sta SFX_RIGHT_TIMER
.rightnotlower:
    rts

; Update sound effects - call this once per frame
SFX_UPDATE:
    ;----- LEFT CHANNEL UPDATE -----
    lda SFX_LEFT          ; Load the left channel sound effect ID
    beq .updateRight      ; If 0, no sound playing, jump to right channel
    
    ; Increment the left channel timer
    inc SFX_LEFT_TIMER
    
    ; Calculate table index (ID-1)*2
    tax                   ; Sound effect ID in X
    dex                   ; Adjust for 0-based indexing
    txa
    asl                   ; Multiply by 2 (for 16-bit address)
    tax                   ; Put index back in X
    
    ; Load sound effect address into TempWord
    lda SFXTable,x
    sta TempWord
    lda SFXTable+1,x
    sta TempWord+1
    
    ; Get length of the sound effect
    ldy #0
    lda (TempWord),y          ; Get length byte
    
    ; Check if sound effect is finished
    cmp SFX_LEFT_TIMER
    bne .leftContinue
    
    ; Sound effect is finished
    lda #0
    sta SFX_LEFT
    sta SFX_LEFT_TIMER
    sta AUDV0             ; Silence channel
    jmp .updateRight
    
.leftContinue:
    ; Get frequency value
    ldy SFX_LEFT_TIMER
    iny                   ; Skip length byte
    lda (TempWord),y          ; Get frequency
    sta AUDF0             
    
    ; Calculate offset to control/volume data
    ldy #0
    lda (TempWord),y          ; Get length again
    clc
    adc #1                ; Add 1 to skip length byte
    adc SFX_LEFT_TIMER    ; Add current timer position
    tay                   ; Index in Y
    
    ; Get control/volume value
    lda (TempWord),y          ; Get CV byte
    
    ; Split into volume and control
    tax                   ; Save full value in X
    and #$0F              ; Mask for volume (low 4 bits)
    sta AUDV0             ; Set volume
    
    txa                   ; Get full value back
    lsr                   ; Shift right 4 times for control
    lsr
    lsr
    lsr
    sta AUDC0             ; Set control
    
    ;----- RIGHT CHANNEL UPDATE -----
.updateRight:
    lda SFX_RIGHT         ; Load the right channel sound effect ID
    beq .done             ; If 0, no sound playing, we're done
    
    ; Increment the right channel timer
    inc SFX_RIGHT_TIMER
    
    ; Calculate table index (ID-1)*2
    tax                   ; Sound effect ID in X
    dex                   ; Adjust for 0-based indexing
    txa
    asl                   ; Multiply by 2 (for 16-bit address)
    tax                   ; Put index back in X
    
    ; Load sound effect address into TempWord
    lda SFXTable,x
    sta TempWord
    lda SFXTable+1,x
    sta TempWord+1
    
    ; Get length of the sound effect
    ldy #0
    lda (TempWord),y          ; Get length byte
    
    ; Check if sound effect is finished
    cmp SFX_RIGHT_TIMER
    bne .rightContinue
    
    ; Sound effect is finished
    lda #0
    sta SFX_RIGHT
    sta SFX_RIGHT_TIMER
    sta AUDV1             ; Silence channel
    jmp .done
    
.rightContinue:
    ; Get frequency value
    ldy SFX_RIGHT_TIMER
    iny                   ; Skip length byte
    lda (TempWord),y          ; Get frequency
    sta AUDF1             
    
    ; Calculate offset to control/volume data
    ldy #0
    lda (TempWord),y          ; Get length again
    clc
    adc #1                ; Add 1 to skip length byte
    adc SFX_RIGHT_TIMER   ; Add current timer position
    tay                   ; Index in Y
    
    ; Get control/volume value
    lda (TempWord),y          ; Get CV byte
    
    ; Split into volume and control
    tax                   ; Save full value in X
    and #$0F              ; Mask for volume (low 4 bits)
    sta AUDV1             ; Set volume
    
    txa                   ; Get full value back
    lsr                   ; Shift right 4 times for control
    lsr
    lsr
    lsr
    sta AUDC1             ; Set control
    
.done:
    rts

; Example of how to use the sound engine:
; 1. Initialize the sound engine
;    jsr SFX_OFF
;
; 2. Trigger a sound effect
;    ldy #SFX_ID_SHOOT (replace with your sound effect ID)
;    jsr SFX_TRIGGER
;
; 3. Update the sound engine once per frame (in your main game loop)
;    jsr SFX_UPDATE
`;

    const blob = new Blob([soundEngineCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameName.toLowerCase().replace(/\s+/g, '-')}-sfx.asm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};