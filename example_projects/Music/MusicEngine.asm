; ============================================================
; MUSIC ENGINE
; ============================================================
; Required zero-page RAM:
;   MUS_FRAME   - frame countdown (1 byte)
;   MUS_STEP    - step within pattern (1 byte)
;   MUS_PAT_IDX - arrangement index (1 byte)
;   MUS_PLAYING - 0=stopped, 1=playing (1 byte)
;   MUS_ARR_OFF - saved arrangement byte offset (1 byte)
;   MUS_PTR     - temp zero-page pointer (2 bytes)
; Required RAM addresses: AUDV0, AUDV1, AUDF0, AUDF1, AUDC0, AUDC1
; ============================================================
; SoundEngine coexistence:
;   Requires SFX_LEFT and SFX_RIGHT from SoundEngine.
;   If SFX_LEFT != 0, music skips channel 0 (SFX owns it).
;   If SFX_RIGHT != 0, music skips channel 1 (SFX owns it).
;   Music resumes automatically once the SFX finishes.
; ============================================================
;
; Arrangement entry layout (9 bytes each):
;   +0,+1  .word  voice 0 note codes ptr
;   +2,+3  .word  voice 0 volumes ptr
;   +4,+5  .word  voice 1 note codes ptr
;   +6,+7  .word  voice 1 volumes ptr
;   +8     .byte  pattern length
; ============================================================

; Driver code → TIA AUDC lookup table
musCtrlTable:
    .byte 4, 6, 7, 8, 15, 12, 1, 3

; ── MUSIC_INIT ─────────────────────────────────────────────────────────
; Call once at startup to begin playback from the beginning
MUSIC_INIT:
    lda #MUSIC_TEMPO
    sta MUS_FRAME
    lda #0
    sta MUS_STEP
    sta MUS_PAT_IDX
    lda #1
    sta MUS_PLAYING
    rts

; ── MUSIC_STOP ─────────────────────────────────────────────────────────
MUSIC_STOP:
    lda #0
    sta MUS_PLAYING
    sta AUDV0
    sta AUDV1
    rts

; ── MUSIC_UPDATE ───────────────────────────────────────────────────────
; Call once per frame (during vertical blank recommended)
MUSIC_UPDATE:
    lda MUS_PLAYING
    beq .musExit        ; not playing → return (branch target is nearby)
    dec MUS_FRAME
    beq .musStep        ; frame expired → do step (invert: fall through = not done)
.musExit:
    rts

.musStep:
    lda #MUSIC_TEMPO
    sta MUS_FRAME

    ; Calculate arrangement entry byte offset (9 bytes per entry)
    lda MUS_PAT_IDX
    asl             ; *2
    asl             ; *4
    asl             ; *8
    clc
    adc MUS_PAT_IDX ; +idx = *9
    tax
    stx MUS_ARR_OFF ; save offset — AUDC table lookup will clobber X

    ; Get current step
    ldy MUS_STEP

    ; ── Voice 0 note ─────────────────────────────
    lda SFX_LEFT                       ; skip channel 0 if SFX owns it
    bne .v1Note
    lda Shadows_Gather_arrangement,x   ; v0 notes ptr lo
    sta MUS_PTR
    lda Shadows_Gather_arrangement+1,x ; v0 notes ptr hi
    sta MUS_PTR+1
    lda (MUS_PTR),y                    ; load note code
    beq .v0Silence
    pha                                ; save note code
    lsr
    lsr
    lsr
    lsr
    lsr                                ; driver code (0-7)
    tax
    lda musCtrlTable,x
    sta AUDC0
    pla                                ; restore note code
    and #%00011111
    sta AUDF0
    ldx MUS_ARR_OFF                    ; restore arrangement offset
    lda Shadows_Gather_arrangement+2,x ; v0 vols ptr lo
    sta MUS_PTR
    lda Shadows_Gather_arrangement+3,x ; v0 vols ptr hi
    sta MUS_PTR+1
    lda (MUS_PTR),y
    sta AUDV0
    jmp .v1Note
.v0Silence:
    lda #0
    sta AUDV0

    ; ── Voice 1 note ─────────────────────────────
.v1Note:
    lda SFX_RIGHT                      ; skip channel 1 if SFX owns it
    bne .advanceStep
    ldx MUS_ARR_OFF                    ; restore arrangement offset
    lda Shadows_Gather_arrangement+4,x ; v1 notes ptr lo
    sta MUS_PTR
    lda Shadows_Gather_arrangement+5,x ; v1 notes ptr hi
    sta MUS_PTR+1
    lda (MUS_PTR),y                    ; load note code
    beq .v1Silence
    pha                                ; save note code
    lsr
    lsr
    lsr
    lsr
    lsr                                ; driver code (0-7)
    tax
    lda musCtrlTable,x
    sta AUDC1
    pla                                ; restore note code
    and #%00011111
    sta AUDF1
    ldx MUS_ARR_OFF                    ; restore arrangement offset
    lda Shadows_Gather_arrangement+6,x ; v1 vols ptr lo
    sta MUS_PTR
    lda Shadows_Gather_arrangement+7,x ; v1 vols ptr hi
    sta MUS_PTR+1
    lda (MUS_PTR),y
    sta AUDV1
    jmp .advanceStep
.v1Silence:
    lda #0
    sta AUDV1

    ; ── Advance step ──────────────────────────────
.advanceStep:
    ldx MUS_ARR_OFF
    inc MUS_STEP
    lda Shadows_Gather_arrangement+8,x ; pattern length
    cmp MUS_STEP
    bne .musEnd
    lda #0
    sta MUS_STEP
    inc MUS_PAT_IDX
    lda MUS_PAT_IDX
    cmp #MUSIC_NUM_PATS
    bne .musEnd
    lda #0
    sta MUS_PAT_IDX
.musEnd:
    rts
