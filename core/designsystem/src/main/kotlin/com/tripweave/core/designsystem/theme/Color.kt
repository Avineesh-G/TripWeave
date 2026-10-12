package com.tripweave.core.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// ==========================================
// Soft Tonal Theme Tokens (Seed: #3B5FCC)
// ==========================================

// Light Theme Palette (Primary)
val SoftTonalPrimaryLight = Color(0xFF3B5FCC)
val SoftTonalOnPrimaryLight = Color(0xFFFFFFFF)
val SoftTonalPrimaryContainerLight = Color(0xFFDCE4FF)
val SoftTonalOnPrimaryContainerLight = Color(0xFF0B1F5C)

val SoftTonalSecondaryContainerLight = Color(0xFFE0E7F6)

val SoftTonalBackgroundLight = Color(0xFFFAFAFD)
val SoftTonalSurfaceLight = Color(0xFFFAFAFD)
val SoftTonalSurfaceContainerLowLight = Color(0xFFF2F4FA)
val SoftTonalSurfaceContainerLight = Color(0xFFECEFF7)
val SoftTonalSurfaceContainerHighLight = Color(0xFFE6E9F2)

val SoftTonalOnSurfaceLight = Color(0xFF1B1E28)
val SoftTonalOnSurfaceVariantLight = Color(0xFF454A58)
val SoftTonalOutlineLight = Color(0xFF747A8A)
val SoftTonalOutlineVariantLight = Color(0xFFC4C8D6)

// Custom Semantic Roles (Light)
val SoftTonalCautionLight = Color(0xFF8A5A00)
val SoftTonalCautionContainerLight = Color(0xFFFFE2A8)
val SoftTonalOnCautionLight = Color(0xFFFFFFFF)

val SoftTonalErrorLight = Color(0xFFB3261E)
val SoftTonalErrorContainerLight = Color(0xFFF9DEDC)
val SoftTonalOnErrorLight = Color(0xFFFFFFFF)

val SoftTonalSuccessLight = Color(0xFF1B6E3E)
val SoftTonalSuccessContainerLight = Color(0xFFCFF0DA)
val SoftTonalOnSuccessLight = Color(0xFFFFFFFF)


// Dark Theme Palette (Secondary)
val SoftTonalPrimaryDark = Color(0xFFAEC0FF)
val SoftTonalOnPrimaryDark = Color(0xFF00287D)
val SoftTonalPrimaryContainerDark = Color(0xFF1E43B0)
val SoftTonalOnPrimaryContainerDark = Color(0xFFDCE4FF)

val SoftTonalSecondaryContainerDark = Color(0xFF3F4657)

val SoftTonalBackgroundDark = Color(0xFF111318)
val SoftTonalSurfaceDark = Color(0xFF111318)
val SoftTonalSurfaceContainerLowDark = Color(0xFF1D2028)
val SoftTonalSurfaceContainerDark = Color(0xFF272A33)
val SoftTonalSurfaceContainerHighDark = Color(0xFF31343E)

val SoftTonalOnSurfaceDark = Color(0xFFE2E2EB)
val SoftTonalOnSurfaceVariantDark = Color(0xFFC4C6D0)
val SoftTonalOutlineDark = Color(0xFF8E909A)
val SoftTonalOutlineVariantDark = Color(0xFF44474F)

// Custom Semantic Roles (Dark)
val SoftTonalCautionDark = Color(0xFFFFBA2A)
val SoftTonalCautionContainerDark = Color(0xFF633F00)
val SoftTonalOnCautionDark = Color(0xFF452B00)

val SoftTonalErrorDark = Color(0xFFFFB4AB)
val SoftTonalErrorContainerDark = Color(0xFF93000A)
val SoftTonalOnErrorDark = Color(0xFF690005)

val SoftTonalSuccessDark = Color(0xFF7CD99A)
val SoftTonalSuccessContainerDark = Color(0xFF005327)
val SoftTonalOnSuccessDark = Color(0xFF003919)

@Immutable
data class TripWeaveColors(
    val caution: Color,
    val cautionContainer: Color,
    val onCaution: Color,
    val success: Color,
    val successContainer: Color,
    val onSuccess: Color,
    val surfaceContainerLow: Color,
    val surfaceContainer: Color,
    val surfaceContainerHigh: Color
)

val LocalTripWeaveColors = staticCompositionLocalOf {
    TripWeaveColors(
        caution = SoftTonalCautionLight,
        cautionContainer = SoftTonalCautionContainerLight,
        onCaution = SoftTonalOnCautionLight,
        success = SoftTonalSuccessLight,
        successContainer = SoftTonalSuccessContainerLight,
        onSuccess = SoftTonalOnSuccessLight,
        surfaceContainerLow = SoftTonalSurfaceContainerLowLight,
        surfaceContainer = SoftTonalSurfaceContainerLight,
        surfaceContainerHigh = SoftTonalSurfaceContainerHighLight
    )
}
