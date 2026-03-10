; ============================================================
; MUSIC ENGINE
; ============================================================
; Required zero-page RAM:
;   MUS_FRAME   - frame countdown (1 byte)
;   MUS_STEP    - step within pattern (1 byte)
;   MUS_PAT_IDX - arrangement index (1 byte)
;   MUS_PLAYING - 0=stopped, 1=playing (1 byte)
;   MUS_PTR     - temp zero-page pointer (2 bytes)
; Required RAM addresses: AUDV0, AUDV1, AUDF0, AUDF1, AUDC0, AUDC1
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
    beq .musEnd
    dec MUS_FRAME
    bne .musEnd
    lda #MUSIC_TEMPO
    sta MUS_FRAME

    ; Calculate arrangement entry offset (5 bytes per entry)
    lda MUS_PAT_IDX
    asl         ; *2
    asl         ; *4
    clc
    adc MUS_PAT_IDX ; +idx = *5
    tax

    ; Get current step
    ldy MUS_STEP

    ; ── Voice 0 note ─────────────────────────────
    lda Shadows_Gather_arrangement,x
    sta MUS_PTR
    lda Shadows_Gather_arrangement+1,x
    sta MUS_PTR+1
    lda (MUS_PTR),y     ; load note code
    beq .v0Silence
    pha
    lsr
    lsr
    lsr
    lsr
    lsr ; driver code → X
    tax
    lda musCtrlTable,x
    sta AUDC0
    pla
    and #%00011111
    sta AUDF0
    ; volume
    lda Shadows_Gather_arrangement+2,x
    sta MUS_PTR
    lda Shadows_Gather_arrangement+3,x
    sta MUS_PTR+1
    lda (MUS_PTR),y
    sta AUDV0
    jmp .v1Note
.v0Silence:
    lda #0
    sta AUDV0

    ; ── Voice 1 note ─────────────────────────────
.v1Note:
    lda Shadows_Gather_arrangement+5,x  ; next entry pointer (v1 notes, +5*n bytes)
    ; NOTE: adjust indexing to match your assembler's word size
    ; (simplified — see documentation for full dual-voice driver)

    ; ── Advance step ──────────────────────────────
    inc MUS_STEP
    lda Shadows_Gather_arrangement+4,x  ; pattern length
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