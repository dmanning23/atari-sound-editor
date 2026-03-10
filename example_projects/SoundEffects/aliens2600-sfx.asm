
; Generic Sound Effect Engine for Atari 2600
; -----------------------------------------



; Sound Effect IDs
SFX_ID_SHOOT = 1
SFX_ID_SCREECH = 2
SFX_ID_ALIENDEATH = 3


; Sound effect lengths for reference
SFX_SHOOT_LENGTH = #21
SFX_SCREECH_LENGTH = #34
SFX_ALIENDEATH_LENGTH = #47


; Sound Effect Data Structures
; Format: 
;   First byte = Length of sound effect
;   Next N bytes = Frequency values
;   Next N bytes = Control/Volume values

sfxSHOOT:
    .byte #21 ; Shoot Length
    ; Frequency values
    .byte 4, 4, 4, 4, 4, 4, 4, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30
    ; Control/Volume values
    .byte $8f, $8f, $8f, $8f, $8f, $8f, $8f, $8f, $8f, $8f, $8e, $8d, $8b, $8a, $89, $88, $67, $66, $65, $64, $62

sfxSCREECH:
    .byte #34 ; Screech Length
    ; Frequency values
    .byte 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 5, 5, 6, 7, 7, 7, 8, 9, 10, 11, 12, 13, 14, 15
    ; Control/Volume values
    .byte $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f, $3f

sfxALIENDEATH:
    .byte #47 ; AlienDeath Length
    ; Frequency values
    .byte 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 27, 29, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
    ; Control/Volume values
    .byte $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7f, $7e, $7d, $7c, $7b, $7a, $79, $78, $e8, $e8, $e8, $e8, $e8, $e8, $e8, $e8, $e8, $e8, $e8, $e8, $e8, $e8, $e9, $ea, $eb, $ec, $ed, $ee, $ef


; Sound Effect Table
SFXTable:
    .word sfxSHOOT ; ID = 1
    .word sfxSCREECH ; ID = 2
    .word sfxALIENDEATH ; ID = 3


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
