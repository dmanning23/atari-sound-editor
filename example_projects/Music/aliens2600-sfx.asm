
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


