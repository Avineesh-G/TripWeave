package com.tripweave.core.designsystem.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tripweave.core.designsystem.theme.*
import com.tripweave.core.model.*

/**
 * 1. SearchPill: Floating full-width pill with search icon, hint, and trailing avatar
 */
@Composable
fun SearchPill(
    hint: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {}
) {
    val colors = LocalTripWeaveColors.current
    Surface(
        onClick = onClick,
        shape = TripWeaveShapes.pill,
        color = colors.surfaceContainerLow,
        shadowElevation = 2.dp,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = "Search",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = hint,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f)
            )
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer)
            ) {
                Text(
                    text = "A",
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
            }
        }
    }
}

/**
 * 2. FeasibilityRing: Canvas arc. Outer = budget used, Inner = time used
 */
@Composable
fun FeasibilityRing(
    timePercent: Float,
    budgetPercent: Float,
    feasibilityLevel: FeasibilityLevel,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    strokeWidth: Dp = 3.5.dp
) {
    val customColors = LocalTripWeaveColors.current
    val statusColor = when (feasibilityLevel) {
        FeasibilityLevel.FEASIBLE -> customColors.success
        FeasibilityLevel.TIGHT -> customColors.caution
        FeasibilityLevel.INFEASIBLE -> MaterialTheme.colorScheme.error
    }

    val animTime by animateFloatAsState(
        targetValue = (timePercent.coerceIn(0f, 100f) / 100f) * 360f,
        animationSpec = tween(350),
        label = "timeSweep"
    )

    val animBudget by animateFloatAsState(
        targetValue = (budgetPercent.coerceIn(0f, 100f) / 100f) * 360f,
        animationSpec = tween(350),
        label = "budgetSweep"
    )

    val accessibilityText = "Time: ${timePercent.toInt()}% used, Budget: ${budgetPercent.toInt()}% used, Status: ${feasibilityLevel.name}"

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(size)
            .semantics { contentDescription = accessibilityText }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokePx = strokeWidth.toPx()
            val trackColor = statusColor.copy(alpha = 0.16f)

            // Outer ring (Budget)
            drawArc(
                color = trackColor,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )
            drawArc(
                color = statusColor,
                startAngle = -90f,
                sweepAngle = animBudget,
                useCenter = false,
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )

            // Inner ring (Time)
            val inset = strokePx * 1.5f
            val innerSize = this.size.width - inset * 2
            if (innerSize > 0) {
                drawArc(
                    color = trackColor,
                    startAngle = -90f,
                    sweepAngle = 360f,
                    useCenter = false,
                    topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                    size = androidx.compose.ui.geometry.Size(innerSize, innerSize),
                    style = Stroke(width = strokePx * 0.85f, cap = StrokeCap.Round)
                )
                drawArc(
                    color = statusColor.copy(alpha = 0.75f),
                    startAngle = -90f,
                    sweepAngle = animTime,
                    useCenter = false,
                    topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                    size = androidx.compose.ui.geometry.Size(innerSize, innerSize),
                    style = Stroke(width = strokePx * 0.85f, cap = StrokeCap.Round)
                )
            }
        }
    }
}

/**
 * 3. FeasibilityPill: Small ring plus label
 */
@Composable
fun FeasibilityPill(
    feasibilityLevel: FeasibilityLevel,
    timePercent: Float,
    budgetPercent: Float,
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {}
) {
    val customColors = LocalTripWeaveColors.current
    val (bgColor, textColor) = when (feasibilityLevel) {
        FeasibilityLevel.FEASIBLE -> customColors.successContainer to customColors.success
        FeasibilityLevel.TIGHT -> customColors.cautionContainer to customColors.caution
        FeasibilityLevel.INFEASIBLE -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.error
    }

    Surface(
        onClick = onClick,
        shape = TripWeaveShapes.pill,
        color = bgColor,
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            FeasibilityRing(
                timePercent = timePercent,
                budgetPercent = budgetPercent,
                feasibilityLevel = feasibilityLevel,
                size = 20.dp,
                strokeWidth = 2.5.dp
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = label,
                color = textColor,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

/**
 * 4. ConfidenceChip: Icon + label (Calculated, Official, User-entered, Community, Historical, Demo, Live)
 * Estimates use a subtle outline style so color is never the only signal.
 */
@Composable
fun ConfidenceChip(
    sourceType: PriceSourceType,
    confidence: ConfidenceLevel = ConfidenceLevel.CONFIRMED,
    modifier: Modifier = Modifier
) {
    val (label, icon, containerColor, contentColor, isOutlined) = when (sourceType) {
        PriceSourceType.OFFICIAL -> Tuple5("Official", Icons.Default.Verified, Color(0xFFCFF0DA), Color(0xFF1B6E3E), false)
        PriceSourceType.CALCULATED -> Tuple5("Calculated", Icons.Default.Calculate, Color(0xFFDCE4FF), Color(0xFF0B1F5C), false)
        PriceSourceType.USER_ENTERED -> Tuple5("User Added", Icons.Default.Person, Color(0xFFECEFF7), Color(0xFF454A58), false)
        PriceSourceType.COMMUNITY -> Tuple5("Community", Icons.Default.Groups, Color(0xFFFFE2A8), Color(0xFF8A5A00), true)
        PriceSourceType.HISTORICAL -> Tuple5("Historical", Icons.Default.History, Color(0xFFE6E9F2), Color(0xFF454A58), false)
        PriceSourceType.DEMO -> Tuple5("Demo Mode", Icons.Default.Science, Color(0xFFFFE2A8), Color(0xFF8A5A00), true)
    }

    Surface(
        shape = TripWeaveShapes.chipInner,
        color = containerColor,
        border = if (isOutlined) BorderStroke(1.dp, contentColor.copy(alpha = 0.4f)) else null,
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = label,
                color = contentColor,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

private data class Tuple5<A, B, C, D, E>(val a: A, val b: B, val c: C, val d: D, val e: E)

/**
 * 5. ScenarioSwitch: Segmented button for Low / Typical / High
 */
@Composable
fun ScenarioSwitch(
    selectedScenario: String,
    onScenarioSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LocalTripWeaveColors.current
    Surface(
        shape = TripWeaveShapes.pill,
        color = colors.surfaceContainer,
        modifier = modifier
            .fillMaxWidth()
            .height(44.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(4.dp)
        ) {
            val scenarios = listOf("low" to "Low", "typical" to "Typical", "high" to "High")
            for ((key, title) in scenarios) {
                val isSelected = selectedScenario.equals(key, ignoreCase = true)
                Surface(
                    onClick = { onScenarioSelected(key) },
                    shape = TripWeaveShapes.pill,
                    color = if (isSelected) MaterialTheme.colorScheme.surface else Color.Transparent,
                    shadowElevation = if (isSelected) 1.dp else 0.dp,
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

/**
 * 6. DurationStepper: - value + with quick chips (30m, 1h, 2h)
 */
@Composable
fun DurationStepper(
    durationMinutes: Int,
    onDurationChange: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LocalTripWeaveColors.current
    Column(modifier = modifier) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "Visit Duration",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { onDurationChange(maxOf(15, durationMinutes - 15)) },
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(Icons.Default.Remove, contentDescription = "Decrease")
                }
                Text(
                    text = "${durationMinutes}m",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp)
                )
                IconButton(
                    onClick = { onDurationChange(durationMinutes + 15) },
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Increase")
                }
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(30, 60, 120).forEach { mins ->
                SuggestionChip(
                    onClick = { onDurationChange(mins) },
                    label = { Text(if (mins < 60) "${mins}m" else "${mins / 60}h") }
                )
            }
        }
    }
}

/**
 * 7. LanguageCard: Large tonal card showing language in its own script
 */
@Composable
fun LanguageCard(
    code: String,
    nativeName: String,
    englishName: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LocalTripWeaveColors.current
    Surface(
        onClick = onClick,
        shape = TripWeaveShapes.cardSmall,
        color = if (isSelected) MaterialTheme.colorScheme.primaryContainer else colors.surfaceContainerLow,
        border = if (isSelected) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null,
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.padding(horizontal = 16.dp)
        ) {
            Column {
                Text(
                    text = nativeName,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = englishName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (isSelected) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * 8. Timeline Connector
 */
@Composable
fun TimelineSpine(
    travelDurationMinutes: Int,
    distanceKm: Double,
    modifier: Modifier = Modifier
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier.width(36.dp)
    ) {
        Box(
            modifier = Modifier
                .width(2.5.dp)
                .height(44.dp)
                .background(MaterialTheme.colorScheme.outlineVariant)
        )
    }
}
