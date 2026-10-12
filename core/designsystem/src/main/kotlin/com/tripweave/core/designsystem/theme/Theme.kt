package com.tripweave.core.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

private val LightColorScheme = lightColorScheme(
    primary = SoftTonalPrimaryLight,
    onPrimary = SoftTonalOnPrimaryLight,
    primaryContainer = SoftTonalPrimaryContainerLight,
    onPrimaryContainer = SoftTonalOnPrimaryContainerLight,
    secondaryContainer = SoftTonalSecondaryContainerLight,
    background = SoftTonalBackgroundLight,
    surface = SoftTonalSurfaceLight,
    onSurface = SoftTonalOnSurfaceLight,
    onSurfaceVariant = SoftTonalOnSurfaceVariantLight,
    outline = SoftTonalOutlineLight,
    outlineVariant = SoftTonalOutlineVariantLight,
    error = SoftTonalErrorLight,
    onError = SoftTonalOnErrorLight,
    errorContainer = SoftTonalErrorContainerLight
)

private val DarkColorScheme = darkColorScheme(
    primary = SoftTonalPrimaryDark,
    onPrimary = SoftTonalOnPrimaryDark,
    primaryContainer = SoftTonalPrimaryContainerDark,
    onPrimaryContainer = SoftTonalOnPrimaryContainerDark,
    secondaryContainer = SoftTonalSecondaryContainerDark,
    background = SoftTonalBackgroundDark,
    surface = SoftTonalSurfaceDark,
    onSurface = SoftTonalOnSurfaceDark,
    onSurfaceVariant = SoftTonalOnSurfaceVariantDark,
    outline = SoftTonalOutlineDark,
    outlineVariant = SoftTonalOutlineVariantDark,
    error = SoftTonalErrorDark,
    onError = SoftTonalOnErrorDark,
    errorContainer = SoftTonalErrorContainerDark
)

val LightCustomColors = TripWeaveColors(
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

val DarkCustomColors = TripWeaveColors(
    caution = SoftTonalCautionDark,
    cautionContainer = SoftTonalCautionContainerDark,
    onCaution = SoftTonalOnCautionDark,
    success = SoftTonalSuccessDark,
    successContainer = SoftTonalSuccessContainerDark,
    onSuccess = SoftTonalOnSuccessDark,
    surfaceContainerLow = SoftTonalSurfaceContainerLowDark,
    surfaceContainer = SoftTonalSurfaceContainerDark,
    surfaceContainerHigh = SoftTonalSurfaceContainerHighDark
)

@Composable
fun TripWeaveTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val customColors = if (darkTheme) DarkCustomColors else LightCustomColors

    CompositionLocalProvider(
        LocalTripWeaveColors provides customColors
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = TripWeaveTypography,
            content = content
        )
    }
}
